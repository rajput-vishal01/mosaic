import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getLatestAirbyteSync, probeAirbyte } from "./client";
import type { AirbyteConfiguration } from "./config";

const configuration: AirbyteConfiguration = {
  apiUrl: "http://airbyte.test/v1",
  clientId: "client-id",
  clientSecret: "client-secret",
  workspaceId: "11111111-1111-4111-8111-111111111111",
  destinationId: "22222222-2222-4222-8222-222222222222",
  requestTimeoutMs: 2_000,
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Airbyte health probe", () => {
  it("verifies health, fresh credentials, and workspace access", async () => {
    server.use(
      http.get("http://airbyte.test/v1/health", () => HttpResponse.json({})),
      http.post("http://airbyte.test/v1/applications/token", async ({ request }) => {
        expect(await request.json()).toEqual({ client_id: "client-id", client_secret: "client-secret", "grant-type": "client_credentials" });
        return HttpResponse.json({ access_token: "short-lived-token", expires_in: 180 });
      }),
      http.get(`http://airbyte.test/v1/workspaces/${configuration.workspaceId}`, ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer short-lived-token");
        return HttpResponse.json({ workspaceId: configuration.workspaceId, name: "Mosaic warehouse" });
      }),
    );

    await expect(probeAirbyte(configuration)).resolves.toMatchObject({ state: "healthy", workspaceName: "Mosaic warehouse" });
  });

  it("translates credential rejection without leaking the upstream payload", async () => {
    server.use(
      http.get("http://airbyte.test/v1/health", () => HttpResponse.json({})),
      http.post("http://airbyte.test/v1/applications/token", () => HttpResponse.json({ detail: "secret contents" }, { status: 403 })),
    );

    const result = await probeAirbyte(configuration);
    expect(result).toMatchObject({ state: "authentication_failed" });
    expect(JSON.stringify(result)).not.toContain("secret contents");
  });

  it("rejects a workspace response for a different scope", async () => {
    server.use(
      http.get("http://airbyte.test/v1/health", () => HttpResponse.json({})),
      http.post("http://airbyte.test/v1/applications/token", () => HttpResponse.json({ access_token: "token" })),
      http.get(`http://airbyte.test/v1/workspaces/${configuration.workspaceId}`, () =>
        HttpResponse.json({ workspaceId: "33333333-3333-4333-8333-333333333333", name: "Wrong workspace" }),
      ),
    );

    await expect(probeAirbyte(configuration)).resolves.toMatchObject({ state: "invalid_response" });
  });
});

describe("Airbyte latest synchronization", () => {
  it("normalizes the latest documented sync job into Mosaic's snapshot contract", async () => {
    server.use(
      http.post("http://airbyte.test/v1/applications/token", () => HttpResponse.json({ access_token: "token" })),
      http.get("http://airbyte.test/v1/jobs", ({ request }) => {
        const query = new URL(request.url).searchParams;
        expect(query.get("connectionId")).toBe("connection-id");
        expect(query.get("jobType")).toBe("sync");
        expect(query.get("limit")).toBe("1");
        expect(query.get("orderBy")).toBe("updatedAt|DESC");
        return HttpResponse.json({ data: [{ jobId: 42, status: "succeeded", jobType: "sync", startTime: "2026-09-02T08:00:00.000Z", lastUpdatedAt: "2026-09-02T08:03:00.000Z", connectionId: "connection-id", rowsSynced: 1200 }] });
      }),
    );

    await expect(getLatestAirbyteSync(configuration, "connection-id")).resolves.toEqual({
      state: "found",
      snapshot: {
        jobId: "42",
        status: "succeeded",
        recordsSynced: 1200,
        startedAt: new Date("2026-09-02T08:00:00.000Z"),
        completedAt: new Date("2026-09-02T08:03:00.000Z"),
        failureType: null,
      },
    });
  });

  it("rejects a job returned for a different connection", async () => {
    server.use(
      http.post("http://airbyte.test/v1/applications/token", () => HttpResponse.json({ access_token: "token" })),
      http.get("http://airbyte.test/v1/jobs", () => HttpResponse.json({ data: [{ jobId: 43, status: "running", jobType: "sync", startTime: "2026-09-02T08:00:00.000Z", connectionId: "another-connection" }] })),
    );

    await expect(getLatestAirbyteSync(configuration, "connection-id")).resolves.toMatchObject({ state: "invalid_response" });
  });
});
