"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { recordAuditEvent } from "@/features/audit/commands";
import { refreshLinkedAirbyteSnapshots } from "@/features/connections/commands";
import { createGa4OauthState, discardGa4OauthState, getGa4ConnectionForRevocation, recordGa4RevocationResult } from "@/features/connections/ga4";
import { ga4SetupSchema } from "@/features/connections/ga4-schema";
import { deleteAirbyteSourceAndConnection, initiateGa4OAuth, probeAirbyte, type AirbyteProbeResult } from "@/lib/airbyte/client";
import { getAirbyteConfiguration, isGa4OauthConfigured } from "@/lib/airbyte/config";
import { requireSuperadmin } from "@/lib/auth/session";

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

  const result = await refreshLinkedAirbyteSnapshots(configuration.configuration);
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
  return { status: "complete", message: result.updated === 1 ? "Updated 1 connection." : `Updated ${result.updated} connections.` };
}

export type Ga4SetupState = { status: "idle" } | { status: "error"; message: string };

export async function startGa4Authorization(_state: Ga4SetupState, formData: FormData): Promise<Ga4SetupState> {
  const session = await requireSuperadmin();
  const parsed = ga4SetupSchema.safeParse({ label: formData.get("label"), propertyIds: formData.get("propertyIds"), startDate: formData.get("startDate") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the GA4 setup details." };

  const configuration = getAirbyteConfiguration();
  if (configuration.state !== "ready") return { status: "error", message: "Complete the Airbyte configuration before connecting GA4." };
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

export async function revokeGa4Connection(_state: RevokeConnectionState, formData: FormData): Promise<RevokeConnectionState> {
  const session = await requireSuperadmin();
  const parsed = z.uuid().safeParse(formData.get("authorizationId"));
  if (!parsed.success) return { status: "error", message: "The selected connection is invalid." };
  const authorization = await getGa4ConnectionForRevocation(parsed.data);
  if (!authorization) return { status: "error", message: "The GA4 connection is no longer active." };
  const configuration = getAirbyteConfiguration();
  if (configuration.state !== "ready") return { status: "error", message: "Airbyte must be configured before disconnecting this source." };

  const result = await deleteAirbyteSourceAndConnection(configuration.configuration, { sourceId: authorization.sourceId, connectionId: authorization.connectionId });
  if (result.state === "deleted" || result.state === "partial") await recordGa4RevocationResult(authorization.id, result.state);
  await recordAuditEvent({
    actorUserId: session.user.id,
    resourceType: "connection",
    resourceId: authorization.id,
    action: "ga4.revoke",
    result: result.state === "deleted" ? "allowed" : "denied",
    details: { outcome: result.state },
  });
  revalidatePath("/dashboard/connections");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/analytics");

  return result.state === "deleted"
    ? { status: "complete", message: `${authorization.label} was disconnected. Historical warehouse data was retained.` }
    : { status: "error", message: result.message };
}
