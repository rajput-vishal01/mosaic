import type { ConnectionHealth } from "./health";

type AccountFreshness = {
  health: ConnectionHealth;
  lastSuccessfulAt: Date | null;
};

export type DashboardFreshness = {
  state: "healthy" | "syncing" | "partial" | "stale" | "reconnect_required" | "unavailable";
  label: string;
  message: string;
  lastSuccessfulAt: Date | null;
};

export function deriveDashboardFreshness(accounts: AccountFreshness[]): DashboardFreshness {
  const successfulDates = accounts.flatMap((account) => account.lastSuccessfulAt ? [account.lastSuccessfulAt] : []);
  const lastSuccessfulAt = successfulDates.length > 0
    ? new Date(Math.min(...successfulDates.map((date) => date.getTime())))
    : null;
  const states = new Set(accounts.map((account) => account.health.state));
  const readableCount = accounts.filter((account) => account.lastSuccessfulAt).length;

  if (accounts.length === 0 || readableCount === 0) {
    return { state: "unavailable", label: "Data unavailable", message: "No assigned account has completed a successful synchronization yet.", lastSuccessfulAt: null };
  }
  if (states.has("reconnect_required")) {
    return { state: "reconnect_required", label: "Reconnect required", message: "Previously synchronized data remains available, but the operator must renew a provider authorization.", lastSuccessfulAt };
  }
  if (readableCount < accounts.length || states.has("failed") || (states.size > 1 && (states.has("stale") || states.has("not_connected")))) {
    return { state: "partial", label: "Partial data", message: "Some assigned accounts are unavailable or stale. Available historical data is still shown.", lastSuccessfulAt };
  }
  if (states.has("stale") || states.has("not_connected")) {
    return { state: "stale", label: "Data is stale", message: "The last successful data remains available while synchronization needs attention.", lastSuccessfulAt };
  }
  if (states.has("syncing")) {
    return { state: "syncing", label: "Refreshing data", message: "A synchronization is running. The last successful data remains available until it finishes.", lastSuccessfulAt };
  }
  return { state: "healthy", label: "Data is current", message: "All assigned accounts are within the expected synchronization window.", lastSuccessfulAt };
}
