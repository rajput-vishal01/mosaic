import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agencyAccount, agencyProfile, member, providerAuthorization, sourceAccount, syncSnapshot, user, userAccountGrant } from "@/lib/db/schema";
import { deriveConnectionHealth } from "@/features/connections/health";

async function queryGrantedAccountScopes(userId: string, agencyId: string) {
  return db
    .select({
      sourceAccountId: sourceAccount.id,
      accountScopeId: sourceAccount.accountScopeId,
      name: sourceAccount.name,
      provider: providerAuthorization.provider,
      authorizationStatus: providerAuthorization.status,
      credentialStatus: providerAuthorization.credentialStatus,
      airbyteConnectionId: providerAuthorization.airbyteConnectionId,
      syncStatus: syncSnapshot.status,
      failureType: syncSnapshot.failureType,
      lastSuccessfulAt: syncSnapshot.lastSuccessfulAt,
    })
    .from(userAccountGrant)
    .innerJoin(member, eq(member.id, userAccountGrant.memberId))
    .innerJoin(user, eq(user.id, member.userId))
    .innerJoin(agencyAccount, eq(agencyAccount.id, userAccountGrant.agencyAccountId))
    .innerJoin(agencyProfile, eq(agencyProfile.organizationId, agencyAccount.agencyId))
    .innerJoin(sourceAccount, eq(sourceAccount.id, agencyAccount.sourceAccountId))
    .innerJoin(providerAuthorization, eq(providerAuthorization.id, sourceAccount.authorizationId))
    .leftJoin(syncSnapshot, eq(syncSnapshot.authorizationId, providerAuthorization.id))
    .where(and(
      eq(member.userId, userId),
      eq(member.organizationId, agencyId),
      eq(agencyAccount.agencyId, agencyId),
      eq(agencyProfile.status, "active"),
      eq(user.banned, false),
      eq(providerAuthorization.status, "active"),
    ))
    .orderBy(providerAuthorization.provider, sourceAccount.name);
}

export async function resolveUserAccountScopes(userId: string, agencyId: string) {
  const rows = await queryGrantedAccountScopes(userId, agencyId);
  return rows.map(({ sourceAccountId, accountScopeId, provider }) => ({ sourceAccountId, accountScopeId, provider }));
}

export async function getGrantedAccountDisplay(userId: string, agencyId: string) {
  const rows = await queryGrantedAccountScopes(userId, agencyId);
  return rows.map((row) => ({
    sourceAccountId: row.sourceAccountId,
    accountScopeId: row.accountScopeId,
    name: row.name,
    provider: row.provider,
    lastSuccessfulAt: row.lastSuccessfulAt,
    health: deriveConnectionHealth({
      authorizationStatus: row.authorizationStatus,
      credentialStatus: row.credentialStatus,
      airbyteConnectionId: row.airbyteConnectionId,
      syncStatus: row.syncStatus,
      failureType: row.failureType,
      lastSuccessfulAt: row.lastSuccessfulAt,
    }),
  }));
}
