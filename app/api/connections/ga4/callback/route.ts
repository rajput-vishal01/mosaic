import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { recordAuditEvent } from "@/features/audit/commands";
import { claimGa4OauthState, completeGa4Connection, registerGa4Source } from "@/features/connections/ga4";
import { publishCanonicalWarehouseScopes } from "@/features/connections/warehouse";
import { createAirbyteConnection, createGa4Source } from "@/lib/airbyte/client";
import { getAirbyteConfiguration } from "@/lib/airbyte/config";
import { isSuperadmin } from "@/lib/auth/roles";
import { auth } from "@/lib/auth/server";
import { getWarehouseScopeConfiguration } from "@/lib/warehouse/config";

const callbackSchema = z.object({ state: z.uuid(), secretId: z.string().min(1).max(500) });

function connectionRedirect(request: NextRequest, result: string) {
  const url = new URL("/dashboard/connections", request.url);
  url.searchParams.set("ga4", result);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !isSuperadmin(session.user.role)) return connectionRedirect(request, "session_expired");

  const parsed = callbackSchema.safeParse({ state: request.nextUrl.searchParams.get("state"), secretId: request.nextUrl.searchParams.get("secret_id") });
  if (!parsed.success) {
    await recordAuditEvent({ actorUserId: session.user.id, resourceType: "connection", resourceId: "ga4", action: "ga4.oauth_callback", result: "denied", details: { reason: "malformed_callback" } });
    return connectionRedirect(request, "invalid_callback");
  }
  const configuration = getAirbyteConfiguration();
  if (configuration.state !== "ready") return connectionRedirect(request, "configuration_error");

  const oauthState = await claimGa4OauthState(parsed.data.state, session.user.id);
  if (!oauthState) {
    await recordAuditEvent({ actorUserId: session.user.id, resourceType: "connection", resourceId: parsed.data.state, action: "ga4.oauth_callback", result: "denied", details: { reason: "expired_consumed_or_wrong_actor" } });
    return connectionRedirect(request, "invalid_state");
  }

  const source = await createGa4Source(configuration.configuration, {
    name: oauthState.label,
    secretId: parsed.data.secretId,
    propertyIds: oauthState.propertyIds,
    ...(oauthState.startDate ? { startDate: oauthState.startDate } : {}),
  });
  if (source.state !== "created") {
    await recordAuditEvent({ actorUserId: session.user.id, resourceType: "connection", resourceId: oauthState.id, action: "ga4.source_create", result: "allowed", details: { outcome: source.state } });
    return connectionRedirect(request, "source_error");
  }

  let authorization: { id: string };
  try {
    authorization = await registerGa4Source({ label: oauthState.label, sourceId: source.sourceId });
  } catch {
    return connectionRedirect(request, "registration_error");
  }
  const connection = await createAirbyteConnection(configuration.configuration, { name: oauthState.label, sourceId: source.sourceId });
  if (connection.state !== "created") {
    await recordAuditEvent({ actorUserId: session.user.id, resourceType: "connection", resourceId: authorization.id, action: "ga4.connection_create", result: "allowed", details: { outcome: connection.state } });
    return connectionRedirect(request, "connection_error");
  }

  await completeGa4Connection({ authorizationId: authorization.id, connectionId: connection.connectionId, propertyIds: oauthState.propertyIds });
  const warehouseConfiguration = getWarehouseScopeConfiguration();
  const scopeResult = warehouseConfiguration.state === "ready"
    ? await publishCanonicalWarehouseScopes(warehouseConfiguration.configuration)
    : { state: "unavailable" as const };
  await recordAuditEvent({ actorUserId: session.user.id, resourceType: "connection", resourceId: authorization.id, action: "ga4.connect", result: scopeResult.state === "published" ? "allowed" : "denied", details: { propertyCount: oauthState.propertyIds.length, warehouseOutcome: scopeResult.state } });
  if (scopeResult.state !== "published") return connectionRedirect(request, "warehouse_error");
  return connectionRedirect(request, "connected");
}
