import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agencyAccount, agencyProfile, member, providerAuthorization, sourceAccount, user, userAccountGrant } from "@/lib/db/schema";

async function queryGrantedAccountScopes(userId: string, agencyId: string) {
  return db
    .select({
      sourceAccountId: sourceAccount.id,
      accountScopeId: sourceAccount.accountScopeId,
      name: sourceAccount.name,
      provider: providerAuthorization.provider,
    })
    .from(userAccountGrant)
    .innerJoin(member, eq(member.id, userAccountGrant.memberId))
    .innerJoin(user, eq(user.id, member.userId))
    .innerJoin(agencyAccount, eq(agencyAccount.id, userAccountGrant.agencyAccountId))
    .innerJoin(agencyProfile, eq(agencyProfile.organizationId, agencyAccount.agencyId))
    .innerJoin(sourceAccount, eq(sourceAccount.id, agencyAccount.sourceAccountId))
    .innerJoin(providerAuthorization, eq(providerAuthorization.id, sourceAccount.authorizationId))
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
  return queryGrantedAccountScopes(userId, agencyId);
}
