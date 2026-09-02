"use server";

import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/features/audit/commands";
import { refreshLinkedAirbyteSnapshots } from "@/features/connections/commands";
import { probeAirbyte, type AirbyteProbeResult } from "@/lib/airbyte/client";
import { getAirbyteConfiguration } from "@/lib/airbyte/config";
import { requireSuperadmin } from "@/lib/auth/session";

export type AirbyteTestState =
  | { status: "idle" }
  | { status: "configuration_error"; message: string }
  | { status: "complete"; result: AirbyteProbeResult };

export async function testAirbyteConnection(): Promise<AirbyteTestState> {
  const session = await requireSuperadmin();
  const configuration = getAirbyteConfiguration();

  if (configuration.state !== "ready") {
    const message = configuration.state === "unconfigured"
      ? "Add the Airbyte environment variables before testing the service."
      : "Complete and correct the Airbyte environment configuration before testing the service.";
    return { status: "configuration_error", message };
  }

  const result = await probeAirbyte(configuration.configuration);
  await recordAuditEvent({
    actorUserId: session.user.id,
    resourceType: "connection",
    resourceId: "airbyte",
    action: "airbyte.health_check",
    result: "allowed",
    details: { healthState: result.state },
  });

  return { status: "complete", result };
}

export type SyncRefreshState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "complete"; message: string };

export async function refreshSynchronizationStatus(): Promise<SyncRefreshState> {
  const session = await requireSuperadmin();
  const configuration = getAirbyteConfiguration();
  if (configuration.state !== "ready") return { status: "error", message: "Complete the Airbyte configuration before refreshing synchronization status." };

  const result = await refreshLinkedAirbyteSnapshots(configuration.configuration);
  await recordAuditEvent({
    actorUserId: session.user.id,
    resourceType: "connection",
    resourceId: "airbyte",
    action: "airbyte.sync_status_refresh",
    result: "allowed",
    details: result,
  });
  revalidatePath("/dashboard/connections");

  if (result.unavailable > 0) return { status: "error", message: `Updated ${result.updated} connections; ${result.unavailable} could not be refreshed.` };
  return { status: "complete", message: result.updated === 1 ? "Updated 1 connection." : `Updated ${result.updated} connections.` };
}
