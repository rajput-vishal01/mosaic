import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createAirbyteConnection, createGa4Source, deleteAirbyteSourceAndConnection, getLatestAirbyteSync, getRecentAirbyteSyncs, initiateGa4OAuth, probeAirbyte } from "./client";
import type { AirbyteConfiguration } from "./config";

const configuration: AirbyteConfiguration = {
  apiUrl: "http://airbyte.test/v1",
  clientId: "client-id",
  clientSecret: "client-secret",
  workspaceId: "11111111-1111-4111-8111-111111111111",
  destinationId: "22222222-2222-4222-8222-222222222222",
  requestTimeoutMs: 2_000,
  syncFrequencyHours: 6,
};

const server = setupServer();
const ga4SourceId = "33333333-3333-4333-8333-333333333333";
const ga4ConnectionId = "44444444-4444-4444-8444-444444444444";

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

  it("normalizes recent runs and computes terminal durations", async () => {
    server.use(
      http.post("http://airbyte.test/v1/applications/token", () => HttpResponse.json({ access_token: "token" })),
      http.get("http://airbyte.test/v1/jobs", ({ request }) => {
        expect(new URL(request.url).searchParams.get("limit")).toBe("10");
        return HttpResponse.json({ data: [
          { jobId: 45, status: "running", jobType: "sync", startTime: "2026-09-02T09:00:00.000Z", connectionId: "connection-id", rowsSynced: 200 },
          { jobId: 44, status: "failed", jobType: "sync", startTime: "2026-09-02T08:00:00.000Z", lastUpdatedAt: "2026-09-02T08:01:31.000Z", connectionId: "connection-id" },
        ] });
      }),
    );

    await expect(getRecentAirbyteSyncs(configuration, "connection-id")).resolves.toMatchObject({
      state: "found",
      runs: [
        { jobId: "45", status: "running", durationSeconds: null, failureType: null },
        { jobId: "44", status: "failed", durationSeconds: 91, failureType: "unknown" },
      ],
    });
  });
});

describe("Airbyte GA4 provisioning", () => {
  it("initiates OAuth with an exact Mosaic callback", async () => {
    server.use(
      http.post("http://airbyte.test/v1/applications/token", () => HttpResponse.json({ access_token: "token" })),
      http.post("http://airbyte.test/v1/sources/initiateOAuth", async ({ request }) => {
        expect(await request.json()).toEqual({ redirectUrl: "https://mosaic.test/api/connections/ga4/callback?state=state-id", workspaceId: configuration.workspaceId, sourceType: "google-analytics-data-api" });
        return HttpResponse.json({ redirect_url: "https://accounts.google.com/o/oauth2/auth?client_id=airbyte" });
      }),
    );
    await expect(initiateGa4OAuth(configuration, "https://mosaic.test/api/connections/ga4/callback?state=state-id")).resolves.toMatchObject({ state: "ready" });
  });

  it("creates a GA4 source and warehouse connection without returning the OAuth secret", async () => {
    server.use(
      http.post("http://airbyte.test/v1/applications/token", () => HttpResponse.json({ access_token: "token" })),
      http.post("http://airbyte.test/v1/sources", async ({ request }) => {
        expect(await request.json()).toEqual({ name: "Main GA4", workspaceId: configuration.workspaceId, secretId: "opaque-secret-id", configuration: { sourceType: "google-analytics-data-api", property_ids: ["123456789", "987654321"], custom_reports_array: [{ name: "mga4", dimensions: ["date", "sessionDefaultChannelGroup", "country", "deviceCategory"], metrics: ["sessions", "totalUsers", "newUsers", "engagedSessions", "eventCount", "keyEvents", "totalRevenue"] }], window_in_days: 1, lookback_window: 2, date_ranges_start_date: "2025-01-01" } });
        return HttpResponse.json({ sourceId: ga4SourceId });
      }),
      http.get("http://airbyte.test/v1/streams", ({ request }) => {
        const query = new URL(request.url).searchParams;
        expect(query.get("sourceId")).toBe(ga4SourceId);
        expect(query.get("destinationId")).toBe(configuration.destinationId);
        expect(query.get("ignoreCache")).toBe("true");
        return HttpResponse.json([
          { streamName: "mga4", syncModes: ["incremental_append"] },
          { streamName: "mga4Property987654321", syncModes: ["incremental_append"] },
        ]);
      }),
      http.post("http://airbyte.test/v1/connections", async ({ request }) => {
        expect(await request.json()).toEqual({ name: "Main GA4", sourceId: ga4SourceId, destinationId: configuration.destinationId, configurations: { streams: [{ name: "mga4", syncMode: "incremental_append" }, { name: "mga4Property987654321", syncMode: "incremental_append" }] }, namespaceDefinition: "custom_format", namespaceFormat: "mosaic_airbyte", prefix: "m_3333333333334333833333333333_", schedule: { scheduleType: "cron", cronExpression: "0 0 */6 * * ?" }, nonBreakingSchemaUpdatesBehavior: "disable_connection", status: "active" });
        return HttpResponse.json({ connectionId: ga4ConnectionId });
      }),
    );
    await expect(createGa4Source(configuration, { name: "Main GA4", secretId: "opaque-secret-id", propertyIds: ["123456789", "987654321"], startDate: "2025-01-01" })).resolves.toEqual({ state: "created", sourceId: ga4SourceId });
    await expect(createAirbyteConnection(configuration, { name: "Main GA4", sourceId: ga4SourceId, propertyIds: ["123456789", "987654321"] })).resolves.toEqual({ state: "created", connectionId: ga4ConnectionId });
  });

  it("refuses to create a connection when the approved GA4 stream contract is unavailable", async () => {
    server.use(
      http.post("http://airbyte.test/v1/applications/token", () => HttpResponse.json({ access_token: "token" })),
      http.get("http://airbyte.test/v1/streams", () => HttpResponse.json([{ streamName: "website_overview", syncModes: ["incremental_append"] }])),
    );
    await expect(createAirbyteConnection(configuration, { name: "Main GA4", sourceId: ga4SourceId, propertyIds: ["123456789"] })).resolves.toMatchObject({ state: "invalid_response" });
  });

  it("rejects a non-HTTPS consent URL", async () => {
    server.use(
      http.post("http://airbyte.test/v1/applications/token", () => HttpResponse.json({ access_token: "token" })),
      http.post("http://airbyte.test/v1/sources/initiateOAuth", () => HttpResponse.json({ redirect_url: "http://unsafe.test/oauth" })),
    );
    await expect(initiateGa4OAuth(configuration, "https://mosaic.test/callback")).resolves.toMatchObject({ state: "invalid_response" });
  });

  it("deletes the warehouse connection before its credential-bearing source", async () => {
    const operations: string[] = [];
    server.use(
      http.post("http://airbyte.test/v1/applications/token", () => HttpResponse.json({ access_token: "token" })),
      http.delete("http://airbyte.test/v1/connections/connection-id", () => {
        operations.push("connection");
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete("http://airbyte.test/v1/sources/source-id", () => {
        operations.push("source");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await expect(deleteAirbyteSourceAndConnection(configuration, { sourceId: "source-id", connectionId: "connection-id" })).resolves.toEqual({ state: "deleted" });
    expect(operations).toEqual(["connection", "source"]);
  });

  it("reports partial cleanup when the connection is gone but the source remains", async () => {
    server.use(
      http.post("http://airbyte.test/v1/applications/token", () => HttpResponse.json({ access_token: "token" })),
      http.delete("http://airbyte.test/v1/connections/connection-id", () => new HttpResponse(null, { status: 404 })),
      http.delete("http://airbyte.test/v1/sources/source-id", () => HttpResponse.json({}, { status: 403 })),
    );
    await expect(deleteAirbyteSourceAndConnection(configuration, { sourceId: "source-id", connectionId: "connection-id" })).resolves.toMatchObject({ state: "partial" });
  });
});
