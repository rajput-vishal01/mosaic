import { describe, expect, it } from "vitest";

import { deriveConnectionHealth } from "./health";

const now = new Date("2026-09-02T12:00:00.000Z");
const healthyInput = {
  authorizationStatus: "active" as const,
  credentialStatus: "healthy" as const,
  airbyteConnectionId: "connection-id",
  syncStatus: "succeeded" as const,
  failureType: null,
  lastSuccessfulAt: new Date("2026-09-02T11:00:00.000Z"),
  now,
};

describe("connection health state", () => {
  it("does not represent fixture authorization metadata as a live connection", () => {
    expect(deriveConnectionHealth({ ...healthyInput, airbyteConnectionId: null })).toMatchObject({ state: "not_connected" });
  });

  it("prioritizes credential reconnection over job status", () => {
    expect(deriveConnectionHealth({ ...healthyInput, credentialStatus: "reconnect_required", syncStatus: "running" })).toMatchObject({ state: "reconnect_required" });
  });

  it("preserves the last successful data after a classified failure", () => {
    const health = deriveConnectionHealth({ ...healthyInput, syncStatus: "failed", failureType: "rate_limit" });
    expect(health).toMatchObject({ state: "stale" });
    expect(health.message).toContain("last successful data remains available");
  });

  it("distinguishes a first-run failure from stale previously synced data", () => {
    expect(deriveConnectionHealth({ ...healthyInput, syncStatus: "failed", failureType: "upstream", lastSuccessfulAt: null })).toMatchObject({ state: "failed" });
  });

  it("marks successful data stale after the configured freshness window", () => {
    expect(deriveConnectionHealth({ ...healthyInput, lastSuccessfulAt: new Date("2026-08-31T09:00:00.000Z") })).toMatchObject({ state: "stale" });
  });

  it("returns healthy only for a recent successful synchronization", () => {
    expect(deriveConnectionHealth(healthyInput)).toMatchObject({ state: "healthy" });
  });
});
