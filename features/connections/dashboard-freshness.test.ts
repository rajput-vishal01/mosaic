import { describe, expect, it } from "vitest";

import { deriveDashboardFreshness } from "./dashboard-freshness";

const date = new Date("2026-09-02T04:00:00.000Z");
const health = {
  healthy: { state: "healthy", label: "Healthy", message: "Healthy." },
  stale: { state: "stale", label: "Stale", message: "Stale." },
  failed: { state: "failed", label: "Failed", message: "Failed." },
  not_connected: { state: "not_connected", label: "Not connected", message: "Disconnected." },
  syncing: { state: "syncing", label: "Syncing", message: "Syncing." },
  reconnect_required: { state: "reconnect_required", label: "Reconnect required", message: "Reconnect." },
} as const;

describe("deriveDashboardFreshness", () => {
  it("uses the oldest successful account timestamp as the dashboard data boundary", () => {
    const older = new Date("2026-09-01T04:00:00.000Z");
    expect(deriveDashboardFreshness([
      { health: health.healthy, lastSuccessfulAt: date },
      { health: health.healthy, lastSuccessfulAt: older },
    ])).toMatchObject({ state: "healthy", lastSuccessfulAt: older });
  });

  it("keeps historical data readable when a refresh fails", () => {
    expect(deriveDashboardFreshness([{ health: health.stale, lastSuccessfulAt: date }])).toMatchObject({ state: "stale", lastSuccessfulAt: date });
    expect(deriveDashboardFreshness([{ health: health.reconnect_required, lastSuccessfulAt: date }])).toMatchObject({ state: "reconnect_required", lastSuccessfulAt: date });
  });

  it("classifies mixed or never-synchronized account sets safely", () => {
    expect(deriveDashboardFreshness([
      { health: health.healthy, lastSuccessfulAt: date },
      { health: health.failed, lastSuccessfulAt: null },
    ])).toMatchObject({ state: "partial" });
    expect(deriveDashboardFreshness([{ health: health.failed, lastSuccessfulAt: null }])).toMatchObject({ state: "unavailable", lastSuccessfulAt: null });
    expect(deriveDashboardFreshness([{ health: health.not_connected, lastSuccessfulAt: date }])).toMatchObject({ state: "stale" });
    expect(deriveDashboardFreshness([
      { health: health.healthy, lastSuccessfulAt: date },
      { health: health.not_connected, lastSuccessfulAt: date },
    ])).toMatchObject({ state: "partial" });
  });

  it("reports an in-progress refresh without hiding the prior snapshot", () => {
    expect(deriveDashboardFreshness([{ health: health.syncing, lastSuccessfulAt: date }])).toMatchObject({ state: "syncing", lastSuccessfulAt: date });
  });
});
