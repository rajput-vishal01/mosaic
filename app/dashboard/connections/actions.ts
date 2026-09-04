"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { recordAuditEvent } from "@/features/audit/commands";
import { refreshLinkedAirbyteSnapshots } from "@/features/connections/commands";
import { createGa4OauthState, discardGa4OauthState, getActiveGa4Connection, recordGa4RevocationResult, recordTriggeredGa4Sync } from "@/features/connections/ga4";
import { ga4SetupSchema } from "@/features/connections/ga4-schema";
import { publishCanonicalWarehouseScopes } from "@/features/connections/warehouse";
import { deleteAirbyteSourceAndConnection, initiateGa4OAuth, probeAirbyte, triggerAirbyteSync, type AirbyteProbeResult } from "@/lib/airbyte/client";
import { getAirbyteConfiguration, isGa4OauthConfigured } from "@/lib/airbyte/config";
import { requireSuperadmin } from "@/lib/auth/session";
import { getWarehouseScopeConfiguration } from "@/lib/warehouse/config";

export type AirbyteTestState =
  | { status: "idle" }
  | { status: "configuration_error"; message: string }
  | { status: "complete"; result: AirbyteProbeResult };

export async function testAirbyteConnection(): Promise<AirbyteTestState> {
  const session = await requireSuperadmin();
  const configuration = getAirbyteConfiguration();

  if (configuration.state !== "ready") {
    const message = configuration.state === "unconfigured"
      ? "Add the Airbyte environment variables before testing the service."
      : "Complete and correct the Airbyte environment configuration before testing the service.";
    return { status: "configuration_error", message };
  }

  const result = await probeAirbyte(configuration.configuration);
  await recordAuditEvent({
    actorUserId: session.user.id,
    resourceType: "connection",
    resourceId: "airbyte",
    action: "airbyte.health_check",
    result: "allowed",
    details: { healthState: result.state },
  });

  return { status: "complete", result };
}

export type SyncRefreshState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "complete"; message: string };

export async function refreshSynchronizationStatus(): Promise<SyncRefreshState> {
  const session = await requireSuperadmin();
  const configuration = getAirbyteConfiguration();
  if (configuration.state !== "ready") return { status: "error", message: "Complete the Airbyte configuration before refreshing synchronization status." };

  const reconciliation = await refreshLinkedAirbyteSnapshots(configuration.configuration);
  const result = {
    linked: reconciliation.linked,
    updated: reconciliation.updated,
    unavailable: reconciliation.unavailable,
    runsObserved: reconciliation.runsObserved,
  };
  await recordAuditEvent({
    actorUserId: session.user.id,
    resourceType: "connection",
    resourceId: "airbyte",
    action: "airbyte.sync_status_refresh",
    result: "allowed",
    details: result,
  });
  revalidatePath("/dashboard/connections");

  if (result.unavailable > 0) return { status: "error", message: `Updated ${result.updated} connections; ${result.unavailable} could not be refreshed.` };
  const runCopy = result.runsObserved === 1 ? "1 recent run" : `${result.runsObserved} recent runs`;
  return { status: "complete", message: result.updated === 1 ? `Updated 1 connection and retained ${runCopy}.` : `Updated ${result.updated} connections and retained ${runCopy}.` };
}

export type Ga4SetupState = { status: "idle" } | { status: "error"; message: string };

export async function startGa4Authorization(_state: Ga4SetupState, formData: FormData): Promise<Ga4SetupState> {
  const session = await requireSuperadmin();
  const parsed = ga4SetupSchema.safeParse({ label: formData.get("label"), propertyIds: formData.get("propertyIds"), startDate: formData.get("startDate") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the GA4 setup details." };

  const configuration = getAirbyteConfiguration();
  if (configuration.state !== "ready") return { status: "error", message: "Complete the Airbyte configuration before connecting GA4." };
  if (getWarehouseScopeConfiguration().state !== "ready") return { status: "error", message: "Configure the warehouse scope publisher before connecting GA4." };
  if (!isGa4OauthConfigured()) return { status: "error", message: "Configure the GA4 OAuth credential override in Airbyte before connecting GA4." };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return { status: "error", message: "Configure the public Mosaic application URL before connecting GA4." };
  const parsedAppUrl = URL.canParse(appUrl) ? new URL(appUrl) : null;
  if (!parsedAppUrl || parsedAppUrl.protocol !== "https:") return { status: "error", message: "GA4 authorization requires an HTTPS Mosaic application URL." };

  const oauthState = await createGa4OauthState({ actorUserId: session.user.id, ...parsed.data });
  if (oauthState.state === "duplicate") return { status: "error", message: "A GA4 connection already uses that name." };

  const callbackUrl = new URL("/api/connections/ga4/callback", parsedAppUrl);
  callbackUrl.searchParams.set("state", oauthState.id);
  const initiated = await initiateGa4OAuth(configuration.configuration, callbackUrl.toString());
  if (initiated.state !== "ready") {
    await discardGa4OauthState(oauthState.id, session.user.id);
    return { status: "error", message: initiated.message };
  }

  redirect(initiated.consentUrl);
}

export type RevokeConnectionState = { status: "idle" } | { status: "error" | "complete"; message: string };

export type TriggerSyncState = { status: "idle" } | { status: "error" | "complete"; message: string };

export async function triggerGa4Synchronization(_state: TriggerSyncState, formData: FormData): Promise<TriggerSyncState> {
  const session = await requireSuperadmin();
  const parsed = z.uuid().safeParse(formData.get("authorizationId"));
  if (!parsed.success) return { status: "error", message: "The selected connection is invalid." };

  const authorization = await getActiveGa4Connection(parsed.data);
  if (!authorization) return { status: "error", message: "The GA4 connection is no longer active." };
  const configuration = getAirbyteConfiguration();
  if (configuration.state !== "ready") return { status: "error", message: "Complete the Airbyte configuration before starting a synchronization." };

  const result = await triggerAirbyteSync(configuration.configuration, authorization.connectionId);
  if (result.state === "started") {
    try {
      await recordTriggeredGa4Sync({ authorizationId: authorization.id, jobId: result.jobId, status: result.status });
    } catch {
      return { status: "error", message: "Airbyte accepted the synchronization, but Mosaic could not record it yet." };
    }
  }

  const accepted = result.state === "started" || result.state === "already_running";
  await recordAuditEvent({
    actorUserId: session.user.id,
    resourceType: "connection",
    resourceId: authorization.id,
    action: "ga4.sync_trigger",
    result: accepted ? "allowed" : "denied",
    details: { outcome: result.state },
  });
  revalidatePath("/dashboard/connections");

  if (result.state === "started") return { status: "complete", message: `${authorization.label} is syncing now.` };
  if (result.state === "already_running") return { status: "complete", message: `${authorization.label} already has an active sync.` };
  return { status: "error", message: result.message };
}

export async function revokeGa4Connection(_state: RevokeConnectionState, formData: FormData): Promise<RevokeConnectionState> {
  const session = await requireSuperadmin();
  const parsed = z.uuid().safeParse(formData.get("authorizationId"));
  if (!parsed.success) return { status: "error", message: "The selected connection is invalid." };
  const authorization = await getActiveGa4Connection(parsed.data);
  if (!authorization) return { status: "error", message: "The GA4 connection is no longer active." };
  const configuration = getAirbyteConfiguration();
  if (configuration.state !== "ready") return { status: "error", message: "Airbyte must be configured before disconnecting this source." };

  const result = await deleteAirbyteSourceAndConnection(configuration.configuration, { sourceId: authorization.sourceId, connectionId: authorization.connectionId });
  if (result.state === "deleted" || result.state === "partial") await recordGa4RevocationResult(authorization.id, result.state);
  const warehouseConfiguration = getWarehouseScopeConfiguration();
  const scopeResult = (result.state === "deleted" || result.state === "partial") && warehouseConfiguration.state === "ready"
    ? await publishCanonicalWarehouseScopes(warehouseConfiguration.configuration)
    : null;
  await recordAuditEvent({
    actorUserId: session.user.id,
    resourceType: "connection",
    resourceId: authorization.id,
    action: "ga4.revoke",
    result: result.state === "deleted" && scopeResult?.state === "published" ? "allowed" : "denied",
    details: { outcome: result.state, warehouseOutcome: scopeResult?.state ?? "not_attempted" },
  });
  revalidatePath("/dashboard/connections");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/analytics");

  return result.state === "deleted"
    ? scopeResult?.state === "published"
      ? { status: "complete", message: `${authorization.label} was disconnected and its warehouse scopes were deactivated.` }
      : { status: "error", message: `${authorization.label} was disconnected, but warehouse scope deactivation needs a retry.` }
    : { status: "error", message: result.message };
}

export type WarehouseScopeSyncState = { status: "idle" } | { status: "error" | "complete"; message: string };

export async function syncWarehouseAccountScopes(): Promise<WarehouseScopeSyncState> {
  const session = await requireSuperadmin();
  const configuration = getWarehouseScopeConfiguration();
  if (configuration.state !== "ready") return { status: "error", message: "Configure the warehouse scope publisher before publishing mappings." };
  const result = await publishCanonicalWarehouseScopes(configuration.configuration);
  await recordAuditEvent({ actorUserId: session.user.id, resourceType: "connection", resourceId: "warehouse", action: "warehouse.scope_publish", result: result.state === "published" ? "allowed" : "denied", details: { outcome: result.state, count: result.state === "published" ? result.count : 0 } });
  return result.state === "published"
    ? { status: "complete", message: result.count === 1 ? "Published 1 account scope." : `Published ${result.count} account scopes.` }
    : { status: "error", message: result.message };
}
