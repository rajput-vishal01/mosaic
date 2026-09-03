import "server-only";

import { count, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { providerAuthorization, sourceAccount, syncRun, syncSnapshot } from "@/lib/db/schema";
import { deriveConnectionHealth } from "./health";

export async function listConnectionSummaries() {
  const rows = await db
    .select({
      id: providerAuthorization.id,
      provider: providerAuthorization.provider,
      label: providerAuthorization.label,
      status: providerAuthorization.status,
      credentialStatus: providerAuthorization.credentialStatus,
      externalReference: providerAuthorization.externalReference,
      airbyteSourceId: providerAuthorization.airbyteSourceId,
      airbyteConnectionId: providerAuthorization.airbyteConnectionId,
      accountCount: count(sourceAccount.id),
      syncStatus: syncSnapshot.status,
      failureType: syncSnapshot.failureType,
      lastSuccessfulAt: syncSnapshot.lastSuccessfulAt,
      updatedAt: providerAuthorization.updatedAt,
    })
    .from(providerAuthorization)
    .leftJoin(sourceAccount, eq(sourceAccount.authorizationId, providerAuthorization.id))
    .leftJoin(syncSnapshot, eq(syncSnapshot.authorizationId, providerAuthorization.id))
    .groupBy(providerAuthorization.id, syncSnapshot.authorizationId)
    .orderBy(providerAuthorization.provider, providerAuthorization.label);

  return rows.map((row) => ({
    ...row,
    health: deriveConnectionHealth({
      authorizationStatus: row.status,
      credentialStatus: row.credentialStatus,
      airbyteConnectionId: row.airbyteConnectionId,
      syncStatus: row.syncStatus,
      failureType: row.failureType,
      lastSuccessfulAt: row.lastSuccessfulAt,
    }),
  }));
}

export async function listRecentSyncRuns(limit = 50) {
  return db
    .select({
      id: syncRun.id,
      jobId: syncRun.jobId,
      provider: providerAuthorization.provider,
      connectionLabel: providerAuthorization.label,
      status: syncRun.status,
      recordsSynced: syncRun.recordsSynced,
      startedAt: syncRun.startedAt,
      completedAt: syncRun.completedAt,
      durationSeconds: syncRun.durationSeconds,
      failureType: syncRun.failureType,
      failureSummary: syncRun.failureSummary,
    })
    .from(syncRun)
    .innerJoin(providerAuthorization, eq(providerAuthorization.id, syncRun.authorizationId))
    .orderBy(desc(syncRun.startedAt))
    .limit(Math.max(1, Math.min(100, Math.trunc(limit))));
}
