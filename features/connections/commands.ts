import "server-only";

import { eq, isNotNull, sql } from "drizzle-orm";

import { getRecentAirbyteSyncs } from "@/lib/airbyte/client";
import type { AirbyteConfiguration } from "@/lib/airbyte/config";
import { db } from "@/lib/db";
import { providerAuthorization, syncRun, syncSnapshot } from "@/lib/db/schema";

function sanitizedFailureSummary(status: typeof syncRun.$inferInsert.status) {
  if (status === "failed") return "Airbyte reported a failed synchronization. Review the private Airbyte logs for technical details.";
  if (status === "cancelled") return "The synchronization was cancelled before completion.";
  return null;
}

export async function refreshLinkedAirbyteSnapshots(configuration: AirbyteConfiguration) {
  const authorizations = await db
    .select({ id: providerAuthorization.id, sourceId: providerAuthorization.airbyteSourceId, connectionId: providerAuthorization.airbyteConnectionId })
    .from(providerAuthorization)
    .where(isNotNull(providerAuthorization.airbyteConnectionId));

  let updated = 0;
  let unavailable = 0;
  let runsObserved = 0;
  const transformEligibleSourceIds: string[] = [];

  for (const authorization of authorizations) {
    if (!authorization.connectionId) continue;
    const recent = await getRecentAirbyteSyncs(configuration, authorization.connectionId);
    if (recent.state === "empty") continue;
    if (recent.state !== "found") {
      unavailable += 1;
      continue;
    }
    const latest = recent.runs[0];
    if (!latest) continue;
    if (latest.status === "succeeded" && authorization.sourceId) transformEligibleSourceIds.push(authorization.sourceId);

    await db.transaction(async (transaction) => {
      for (const run of recent.runs) {
        const values = {
          authorizationId: authorization.id,
          ...run,
          failureSummary: sanitizedFailureSummary(run.status),
        };
        await transaction
          .insert(syncRun)
          .values(values)
          .onConflictDoUpdate({
            target: [syncRun.authorizationId, syncRun.jobId],
            set: { ...run, failureSummary: values.failureSummary, updatedAt: new Date() },
          });
      }
      await transaction.execute(sql`
        DELETE FROM ${syncRun}
        WHERE ${syncRun.authorizationId} = ${authorization.id}
          AND ${syncRun.id} NOT IN (
            SELECT ${syncRun.id}
            FROM ${syncRun}
            WHERE ${syncRun.authorizationId} = ${authorization.id}
            ORDER BY ${syncRun.startedAt} DESC
            LIMIT 100
          )
      `);
    });
    runsObserved += recent.runs.length;

    const [current] = await db
      .select({ lastSuccessfulAt: syncSnapshot.lastSuccessfulAt })
      .from(syncSnapshot)
      .where(eq(syncSnapshot.authorizationId, authorization.id))
      .limit(1);
    const snapshot = {
      jobId: latest.jobId,
      status: latest.status,
      recordsSynced: latest.recordsSynced,
      startedAt: latest.startedAt,
      completedAt: latest.completedAt,
      failureType: latest.failureType,
    };
    const lastSuccessfulAt = snapshot.status === "succeeded"
      ? snapshot.completedAt
      : current?.lastSuccessfulAt ?? null;

    await db
      .insert(syncSnapshot)
      .values({ authorizationId: authorization.id, ...snapshot, lastSuccessfulAt })
      .onConflictDoUpdate({
        target: syncSnapshot.authorizationId,
        set: { ...snapshot, lastSuccessfulAt, updatedAt: new Date() },
      });
    updated += 1;
  }

  return { linked: authorizations.length, updated, unavailable, runsObserved, transformEligibleSourceIds };
}
