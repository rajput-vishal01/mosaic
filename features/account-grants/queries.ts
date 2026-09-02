import "server-only";

import { and, count, eq, ilike, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type { inferParserType } from "nuqs/server";

import { requireAgencyManager, getAgencyContext, requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { agencyAccount, member, providerAuthorization, sourceAccount, user, userAccountGrant } from "@/lib/db/schema";
import { getGrantedAccountDisplay } from "./authorization";
import { accountSearchParsers } from "./search-params";

const accountPageSize = 20;
const clientPageSize = 30;

export async function getAgencyAccountManagement(agencyId: string, filters: inferParserType<typeof accountSearchParsers>) {
  const manager = await requireAgencyManager(agencyId);
  const accountQuery = filters.q.trim();
  const clientQuery = filters.client.trim();
  const catalogConditions = [
    manager.role === "superadmin" ? undefined : eq(agencyAccount.agencyId, agencyId),
    filters.provider ? eq(providerAuthorization.provider, filters.provider) : undefined,
    manager.role === "superadmin" && filters.availability === "available" ? isNotNull(agencyAccount.id) : undefined,
    manager.role === "superadmin" && filters.availability === "unavailable" ? isNull(agencyAccount.id) : undefined,
    accountQuery ? or(ilike(sourceAccount.name, `%${accountQuery}%`), ilike(sourceAccount.externalAccountId, `%${accountQuery}%`)) : undefined,
  ];
  const clientConditions = [
    eq(member.organizationId, agencyId),
    eq(member.role, "member"),
    clientQuery ? or(ilike(user.name, `%${clientQuery}%`), ilike(user.email, `%${clientQuery}%`)) : undefined,
  ];

  const catalogBase = () => db
    .select({
      id: sourceAccount.id,
      name: sourceAccount.name,
      provider: providerAuthorization.provider,
      externalAccountId: sourceAccount.externalAccountId,
      agencyAccountId: agencyAccount.id,
    })
    .from(sourceAccount)
    .innerJoin(providerAuthorization, eq(providerAuthorization.id, sourceAccount.authorizationId))
    .leftJoin(agencyAccount, and(eq(agencyAccount.sourceAccountId, sourceAccount.id), eq(agencyAccount.agencyId, agencyId)))
    .where(and(...catalogConditions));

  const requestedPage = Math.max(filters.page, 1);
  const [catalogCount, sourceCount, clientCount] = await Promise.all([
    db.select({ total: count() }).from(sourceAccount).innerJoin(providerAuthorization, eq(providerAuthorization.id, sourceAccount.authorizationId)).leftJoin(agencyAccount, and(eq(agencyAccount.sourceAccountId, sourceAccount.id), eq(agencyAccount.agencyId, agencyId))).where(and(...catalogConditions)),
    db.select({ total: count() }).from(sourceAccount).innerJoin(providerAuthorization, eq(providerAuthorization.id, sourceAccount.authorizationId)).leftJoin(agencyAccount, and(eq(agencyAccount.sourceAccountId, sourceAccount.id), eq(agencyAccount.agencyId, agencyId))).where(manager.role === "superadmin" ? undefined : eq(agencyAccount.agencyId, agencyId)),
    db.select({ total: count() }).from(member).innerJoin(user, eq(user.id, member.userId)).where(and(...clientConditions)),
  ]);
  const catalogTotal = catalogCount[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(catalogTotal / accountPageSize));
  const page = Math.min(requestedPage, totalPages);

  const [catalog, clients] = await Promise.all([
    catalogBase()
      .orderBy(providerAuthorization.provider, sourceAccount.name)
      .limit(accountPageSize)
      .offset((page - 1) * accountPageSize),
    db
      .select({ memberId: member.id, userId: user.id, name: user.name, email: user.email })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(and(...clientConditions))
      .orderBy(user.name)
      .limit(clientPageSize),
  ]);

  const agencyAccountIds = catalog.flatMap((account) => account.agencyAccountId ? [account.agencyAccountId] : []);
  const memberIds = clients.map((client) => client.memberId);
  const grants = agencyAccountIds.length > 0 && memberIds.length > 0 ? await db
    .select({ agencyAccountId: userAccountGrant.agencyAccountId, memberId: userAccountGrant.memberId })
    .from(userAccountGrant)
    .innerJoin(agencyAccount, eq(agencyAccount.id, userAccountGrant.agencyAccountId))
    .where(and(eq(agencyAccount.agencyId, agencyId), inArray(userAccountGrant.agencyAccountId, agencyAccountIds), inArray(userAccountGrant.memberId, memberIds))) : [];

  return {
    manager,
    catalog,
    clients,
    grants,
    page,
    totalPages,
    catalogTotal,
    sourceTotal: sourceCount[0]?.total ?? 0,
    clientTotal: clientCount[0]?.total ?? 0,
    accountPageSize,
    clientPageSize,
  };
}

export async function getCurrentUserGrantedAccounts() {
  const session = await requireSession();
  const agency = await getAgencyContext();
  if (!agency) return [];
  const accounts = await getGrantedAccountDisplay(session.user.id, agency.id);
  return accounts.map((account) => ({ id: account.sourceAccountId, name: account.name, provider: account.provider, agencyId: agency.id, agencyName: agency.name, health: account.health, lastSuccessfulAt: account.lastSuccessfulAt }));
}
