import "server-only";

import { and, eq, gt, isNull, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { connectorOauthState, providerAuthorization, sourceAccount, syncRun, syncSnapshot } from "@/lib/db/schema";

export async function createGa4OauthState(input: { actorUserId: string; label: string; propertyIds: string[]; startDate?: string }) {
  const [existing] = await db
    .select({ id: providerAuthorization.id })
    .from(providerAuthorization)
    .where(and(eq(providerAuthorization.provider, "ga4"), eq(providerAuthorization.label, input.label)))
    .limit(1);
  if (existing) return { state: "duplicate" } as const;

  const [created] = await db
    .insert(connectorOauthState)
    .values({
      actorUserId: input.actorUserId,
      provider: "ga4",
      label: input.label,
      propertyIds: input.propertyIds,
      startDate: input.startDate,
      expiresAt: new Date(Date.now() + 10 * 60 * 1_000),
    })
    .returning({ id: connectorOauthState.id });
  if (!created) throw new Error("The OAuth state could not be created.");
  return { state: "created", id: created.id } as const;
}

export async function discardGa4OauthState(id: string, actorUserId: string) {
  await db.delete(connectorOauthState).where(and(eq(connectorOauthState.id, id), eq(connectorOauthState.actorUserId, actorUserId)));
}

export async function claimGa4OauthState(id: string, actorUserId: string) {
  const [claimed] = await db
    .update(connectorOauthState)
    .set({ consumedAt: new Date() })
    .where(and(
      eq(connectorOauthState.id, id),
      eq(connectorOauthState.actorUserId, actorUserId),
      eq(connectorOauthState.provider, "ga4"),
      isNull(connectorOauthState.consumedAt),
      gt(connectorOauthState.expiresAt, new Date()),
    ))
    .returning({
      id: connectorOauthState.id,
      label: connectorOauthState.label,
      propertyIds: connectorOauthState.propertyIds,
      startDate: connectorOauthState.startDate,
    });
  return claimed ?? null;
}

export async function registerGa4Source(input: { label: string; sourceId: string; propertyIds: string[] }) {
  return db.transaction(async (transaction) => {
    const [authorization] = await transaction
      .insert(providerAuthorization)
      .values({
        provider: "ga4",
        label: input.label,
        status: "error",
        credentialStatus: "healthy",
        airbyteSourceId: input.sourceId,
        credentialsCheckedAt: new Date(),
      })
      .returning({ id: providerAuthorization.id });
    if (!authorization) throw new Error("The GA4 authorization could not be registered.");

    await transaction.insert(sourceAccount).values(input.propertyIds.map((propertyId) => ({
      authorizationId: authorization.id,
      externalAccountId: propertyId,
      name: `GA4 property ${propertyId}`,
      metadata: { propertyId, discovery: "operator_supplied" },
    })));
    return authorization;
  });
}

export async function completeGa4Connection(input: { authorizationId: string; connectionId: string; propertyIds: string[] }) {
  await db.transaction(async (transaction) => {
    await transaction
      .update(providerAuthorization)
      .set({ airbyteConnectionId: input.connectionId, status: "active", updatedAt: new Date() })
      .where(eq(providerAuthorization.id, input.authorizationId));
    for (const propertyId of input.propertyIds) {
      await transaction
        .insert(sourceAccount)
        .values({
          authorizationId: input.authorizationId,
          externalAccountId: propertyId,
          name: `GA4 property ${propertyId}`,
          metadata: { propertyId, discovery: "operator_supplied" },
        })
        .onConflictDoNothing({ target: [sourceAccount.authorizationId, sourceAccount.externalAccountId] });
    }
  });
}

export async function recordTriggeredGa4Sync(input: {
  authorizationId: string;
  jobId: string;
  status: "pending" | "running";
  triggeredAt?: Date;
}) {
  const triggeredAt = input.triggeredAt ?? new Date();
  await db.transaction(async (transaction) => {
    await transaction
      .insert(syncRun)
      .values({
        authorizationId: input.authorizationId,
        jobId: input.jobId,
        status: input.status,
        startedAt: triggeredAt,
      })
      .onConflictDoNothing({ target: [syncRun.authorizationId, syncRun.jobId] });

    await transaction
      .insert(syncSnapshot)
      .values({
        authorizationId: input.authorizationId,
        jobId: input.jobId,
        status: input.status,
        startedAt: triggeredAt,
      })
      .onConflictDoUpdate({
        target: syncSnapshot.authorizationId,
        set: {
          jobId: input.jobId,
          status: input.status,
          recordsSynced: null,
          startedAt: triggeredAt,
          completedAt: null,
          failureType: null,
          updatedAt: new Date(),
        },
      });
  });
}

export async function getActiveGa4Connection(authorizationId: string) {
  const [authorization] = await db
    .select({
      id: providerAuthorization.id,
      label: providerAuthorization.label,
      sourceId: providerAuthorization.airbyteSourceId,
      connectionId: providerAuthorization.airbyteConnectionId,
    })
    .from(providerAuthorization)
    .where(and(eq(providerAuthorization.id, authorizationId), eq(providerAuthorization.provider, "ga4"), eq(providerAuthorization.status, "active")))
    .limit(1);
  return authorization?.sourceId && authorization.connectionId ? { ...authorization, sourceId: authorization.sourceId, connectionId: authorization.connectionId } : null;
}

export async function getRemovableGa4Source(authorizationId: string) {
  const [authorization] = await db
    .select({
      id: providerAuthorization.id,
      label: providerAuthorization.label,
      sourceId: providerAuthorization.airbyteSourceId,
      connectionId: providerAuthorization.airbyteConnectionId,
      status: providerAuthorization.status,
    })
    .from(providerAuthorization)
    .where(and(
      eq(providerAuthorization.id, authorizationId),
      eq(providerAuthorization.provider, "ga4"),
      ne(providerAuthorization.status, "revoked"),
    ))
    .limit(1);
  return authorization?.sourceId ? { ...authorization, sourceId: authorization.sourceId } : null;
}

export async function getRecoverableGa4Source(authorizationId: string) {
  const [authorization] = await db
    .select({
      id: providerAuthorization.id,
      label: providerAuthorization.label,
      sourceId: providerAuthorization.airbyteSourceId,
    })
    .from(providerAuthorization)
    .where(and(
      eq(providerAuthorization.id, authorizationId),
      eq(providerAuthorization.provider, "ga4"),
      eq(providerAuthorization.status, "error"),
      isNull(providerAuthorization.airbyteConnectionId),
    ))
    .limit(1);
  if (!authorization?.sourceId) return null;

  const accounts = await db
    .select({ propertyId: sourceAccount.externalAccountId })
    .from(sourceAccount)
    .where(eq(sourceAccount.authorizationId, authorization.id));
  if (accounts.length === 0) return null;
  return { ...authorization, sourceId: authorization.sourceId, propertyIds: accounts.map((account) => account.propertyId) };
}

export async function recordGa4RevocationResult(authorizationId: string, state: "deleted" | "partial") {
  await db
    .update(providerAuthorization)
    .set(state === "deleted"
      ? { status: "revoked", credentialStatus: "reconnect_required", airbyteSourceId: null, airbyteConnectionId: null, updatedAt: new Date() }
      : { status: "error", credentialStatus: "error", airbyteConnectionId: null, updatedAt: new Date() })
    .where(eq(providerAuthorization.id, authorizationId));
}
