import type { providerAuthorization, syncSnapshot } from "@/lib/db/schema";

type AuthorizationStatus = typeof providerAuthorization.$inferSelect.status;
type CredentialStatus = typeof providerAuthorization.$inferSelect.credentialStatus;
type SyncStatus = typeof syncSnapshot.$inferSelect.status;
type FailureType = NonNullable<typeof syncSnapshot.$inferSelect.failureType>;

export type ConnectionHealth =
  | { state: "not_connected"; label: "Not connected"; message: string }
  | { state: "reconnect_required"; label: "Reconnect required"; message: string }
  | { state: "syncing"; label: "Syncing"; message: string }
  | { state: "healthy"; label: "Healthy"; message: string }
  | { state: "stale"; label: "Stale"; message: string }
  | { state: "failed"; label: "Failed"; message: string };

type ConnectionHealthInput = {
  authorizationStatus: AuthorizationStatus;
  credentialStatus: CredentialStatus;
  airbyteConnectionId: string | null;
  syncStatus: SyncStatus | null;
  failureType: FailureType | null;
  lastSuccessfulAt: Date | null;
  now?: Date;
  staleAfterMs?: number;
};

const failureMessages: Record<FailureType, string> = {
  authentication: "The provider credentials are no longer valid.",
  authorization: "The provider account no longer permits this connection.",
  configuration: "The connection configuration needs operator attention.",
  rate_limit: "The provider delayed this synchronization because of its request limit.",
  upstream: "The provider or ingestion service is temporarily unavailable.",
  unknown: "The synchronization failed for an unclassified reason.",
};

export function deriveConnectionHealth(input: ConnectionHealthInput): ConnectionHealth {
  if (!input.airbyteConnectionId || input.authorizationStatus === "revoked") {
    return { state: "not_connected", label: "Not connected", message: "No live Airbyte connection is linked to this authorization." };
  }

  if (input.credentialStatus === "reconnect_required") {
    return { state: "reconnect_required", label: "Reconnect required", message: "The operator must renew the provider authorization before new data can sync." };
  }

  if (input.syncStatus === "pending" || input.syncStatus === "running") {
    return { state: "syncing", label: "Syncing", message: "Airbyte is currently refreshing this provider's data." };
  }

  if (input.authorizationStatus === "error" || input.credentialStatus === "error" || input.syncStatus === "failed" || input.syncStatus === "cancelled") {
    const message = input.failureType ? failureMessages[input.failureType] : "The connection needs operator attention.";
    return input.lastSuccessfulAt
      ? { state: "stale", label: "Stale", message: `${message} The last successful data remains available.` }
      : { state: "failed", label: "Failed", message };
  }

  if (!input.lastSuccessfulAt) {
    return { state: "failed", label: "Failed", message: "The connection has not completed its first successful synchronization." };
  }

  const now = input.now ?? new Date();
  const staleAfterMs = input.staleAfterMs ?? 26 * 60 * 60 * 1_000;
  if (now.getTime() - input.lastSuccessfulAt.getTime() > staleAfterMs) {
    return { state: "stale", label: "Stale", message: "The latest successful data is older than the expected synchronization window." };
  }

  return { state: "healthy", label: "Healthy", message: "Provider credentials and the latest synchronization are healthy." };
}
