import "server-only";

import createClient from "openapi-fetch";
import { z } from "zod";

import type { SupersetApiPaths } from "./api-schema";
import type { SupersetConfiguration } from "./config";
import { buildAccountScopeClause } from "./rls";

const loginSchema = z.object({ access_token: z.string().min(1) });
const guestTokenSchema = z.object({ token: z.string().min(1) });

export type SupersetGuestTokenResult =
  | { state: "created"; token: string }
  | { state: "authentication_failed" | "invalid_response" | "upstream_error" | "unavailable"; message: string };

function client(configuration: SupersetConfiguration, token?: string) {
  return createClient<SupersetApiPaths>({
    baseUrl: configuration.url,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    fetch: async (request) => fetch(request, { signal: AbortSignal.timeout(configuration.requestTimeoutMs) }),
  });
}

export async function createSupersetGuestToken(configuration: SupersetConfiguration, input: { userId: string; userName: string; accountScopeIds: string[] }): Promise<SupersetGuestTokenResult> {
  try {
    const login = await client(configuration).POST("/api/v1/security/login", {
      body: { username: configuration.username, password: configuration.password, provider: "db", refresh: true },
    });
    if (login.response.status === 401) return { state: "authentication_failed", message: "Superset rejected the configured service account." };
    if (!login.response.ok) return { state: "upstream_error", message: "Superset could not authenticate the service account." };
    const access = loginSchema.safeParse(login.data);
    if (!access.success) return { state: "invalid_response", message: "Superset returned an invalid login response." };

    const displayNames = input.userName.trim().split(/\s+/);
    const firstName = displayNames[0] ?? "Mosaic";
    const lastName = displayNames.slice(1).join(" ") || "Client";
    const guest = await client(configuration, access.data.access_token).POST("/api/v1/security/guest_token/", {
      body: {
        resources: [{ type: "dashboard", id: configuration.ga4DashboardId }],
        rls: [{ clause: buildAccountScopeClause(input.accountScopeIds) }],
        user: { username: `mosaic:${input.userId}`, first_name: firstName, last_name: lastName },
      },
    });
    if (guest.response.status === 401) return { state: "authentication_failed", message: "Superset rejected guest-token issuance." };
    if (!guest.response.ok) return { state: "upstream_error", message: "Superset could not issue a dashboard token." };
    const parsed = guestTokenSchema.safeParse(guest.data);
    return parsed.success ? { state: "created", token: parsed.data.token } : { state: "invalid_response", message: "Superset returned an invalid guest-token response." };
  } catch {
    return { state: "unavailable", message: "Mosaic could not reach Superset." };
  }
}
