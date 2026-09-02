import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createSupersetGuestToken } from "./client";
import type { SupersetConfiguration } from "./config";

const configuration: SupersetConfiguration = {
  url: "https://superset.test",
  username: "mosaic-service",
  password: "service-password",
  ga4DashboardId: "33333333-3333-4333-8333-333333333333",
  requestTimeoutMs: 2_000,
};
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Superset guest token", () => {
  it("authenticates server-side and issues a dashboard token with exact RLS", async () => {
    server.use(
      http.post("https://superset.test/api/v1/security/login", async ({ request }) => {
        expect(await request.json()).toEqual({ username: "mosaic-service", password: "service-password", provider: "db", refresh: true });
        return HttpResponse.json({ access_token: "service-access-token" });
      }),
      http.post("https://superset.test/api/v1/security/guest_token/", async ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer service-access-token");
        expect(await request.json()).toEqual({
          resources: [{ type: "dashboard", id: configuration.ga4DashboardId }],
          rls: [{ clause: "account_scope_id IN ('11111111-1111-4111-8111-111111111111')" }],
          user: { username: "mosaic:user-1", first_name: "Vishal", last_name: "Rajput" },
        });
        return HttpResponse.json({ token: "short-lived-guest-token" });
      }),
    );

    await expect(createSupersetGuestToken(configuration, { userId: "user-1", userName: "Vishal Rajput", accountScopeIds: ["11111111-1111-4111-8111-111111111111"] })).resolves.toEqual({ state: "created", token: "short-lived-guest-token" });
  });

  it("does not expose Superset's authentication error payload", async () => {
    server.use(http.post("https://superset.test/api/v1/security/login", () => HttpResponse.json({ message: "service-password" }, { status: 401 })));
    const result = await createSupersetGuestToken(configuration, { userId: "user-1", userName: "Client", accountScopeIds: [] });
    expect(result).toMatchObject({ state: "authentication_failed" });
    expect(JSON.stringify(result)).not.toContain("service-password");
  });
});
