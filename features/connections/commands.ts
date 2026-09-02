import "server-only";

import { eq, isNotNull } from "drizzle-orm";

import { getLatestAirbyteSync } from "@/lib/airbyte/client";
import type { AirbyteConfiguration } from "@/lib/airbyte/config";
import { db } from "@/lib/db";
import { providerAuthorization, syncSnapshot } from "@/lib/db/schema";

export async function refreshLinkedAirbyteSnapshots(configuration: AirbyteConfiguration) {
  const authorizations = await db
    .select({ id: providerAuthorization.id, connectionId: providerAuthorization.airbyteConnectionId })
    .from(providerAuthorization)
    .where(isNotNull(providerAuthorization.airbyteConnectionId));

  let updated = 0;
  let unavailable = 0;

  for (const authorization of authorizations) {
    if (!authorization.connectionId) continue;
    const latest = await getLatestAirbyteSync(configuration, authorization.connectionId);
    if (latest.state === "empty") continue;
    if (latest.state !== "found") {
      unavailable += 1;
      continue;
    }

    const [current] = await db
      .select({ lastSuccessfulAt: syncSnapshot.lastSuccessfulAt })
      .from(syncSnapshot)
      .where(eq(syncSnapshot.authorizationId, authorization.id))
      .limit(1);
    const lastSuccessfulAt = latest.snapshot.status === "succeeded"
      ? latest.snapshot.completedAt
      : current?.lastSuccessfulAt ?? null;

    await db
      .insert(syncSnapshot)
      .values({ authorizationId: authorization.id, ...latest.snapshot, lastSuccessfulAt })
      .onConflictDoUpdate({
        target: syncSnapshot.authorizationId,
        set: { ...latest.snapshot, lastSuccessfulAt, updatedAt: new Date() },
      });
    updated += 1;
  }

  return { linked: authorizations.length, updated, unavailable };
}
