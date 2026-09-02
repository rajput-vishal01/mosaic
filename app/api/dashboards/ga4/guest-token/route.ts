import { NextResponse, type NextRequest } from "next/server";

import { resolveUserAccountScopes } from "@/features/account-grants/authorization";
import { recordAuditEvent } from "@/features/audit/commands";
import { isAgencyAdmin, isSuperadmin } from "@/lib/auth/roles";
import { auth } from "@/lib/auth/server";
import { getAgencyContext } from "@/lib/auth/session";
import { createSupersetGuestToken } from "@/lib/superset/client";
import { getSupersetConfiguration, isSupersetEmbedConfigured } from "@/lib/superset/config";

function json(body: Record<string, string>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private" } });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || isSuperadmin(session.user.role)) return json({ error: "Dashboard access denied." }, 403);
  const agency = await getAgencyContext();
  if (!agency || isAgencyAdmin(agency.role)) return json({ error: "Dashboard access denied." }, 403);

  const scopes = (await resolveUserAccountScopes(session.user.id, agency.id)).filter((scope) => scope.provider === "ga4");
  if (scopes.length === 0) {
    await recordAuditEvent({ actorUserId: session.user.id, agencyId: agency.id, resourceType: "dashboard", resourceId: "ga4", action: "dashboard.guest_token", result: "denied", details: { reason: "no_current_ga4_grants" } });
    return json({ error: "No GA4 accounts are assigned." }, 403);
  }

  const configuration = getSupersetConfiguration();
  if (configuration.state !== "ready" || !isSupersetEmbedConfigured()) return json({ error: "The analytics service is not configured." }, 503);
  const result = await createSupersetGuestToken(configuration.configuration, {
    userId: session.user.id,
    userName: session.user.name,
    accountScopeIds: scopes.map((scope) => scope.accountScopeId),
  });
  await recordAuditEvent({
    actorUserId: session.user.id,
    agencyId: agency.id,
    resourceType: "dashboard",
    resourceId: configuration.configuration.ga4DashboardId,
    action: "dashboard.guest_token",
    result: result.state === "created" ? "allowed" : "denied",
    details: { outcome: result.state, scopeCount: scopes.length },
  });
  return result.state === "created" ? json({ token: result.token }, 200) : json({ error: result.message }, 502);
}
