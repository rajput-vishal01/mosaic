import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { requireAgencyManager, requireSession, requireSuperadmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { agencyAccount, auditEvent, member, organization, providerAuthorization, sourceAccount, user, userAccountGrant } from "@/lib/db/schema";

export async function getAgencyAccountManagement(agencyId: string) {
  const manager = await requireAgencyManager(agencyId);
  const catalog = await db
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
    .where(manager.role === "superadmin" ? undefined : eq(agencyAccount.agencyId, agencyId))
    .orderBy(providerAuthorization.provider, sourceAccount.name);

  const clients = await db
    .select({ memberId: member.id, userId: user.id, name: user.name, email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, agencyId), eq(member.role, "member")))
    .orderBy(user.name);

  const grants = await db
    .select({ agencyAccountId: userAccountGrant.agencyAccountId, memberId: userAccountGrant.memberId })
    .from(userAccountGrant)
    .innerJoin(agencyAccount, eq(agencyAccount.id, userAccountGrant.agencyAccountId))
    .where(eq(agencyAccount.agencyId, agencyId));

  return { manager, catalog, clients, grants };
}

export async function getCurrentUserGrantedAccounts() {
  const session = await requireSession();
  return db
    .select({
      id: sourceAccount.id,
      name: sourceAccount.name,
      provider: providerAuthorization.provider,
      agencyId: agencyAccount.agencyId,
      agencyName: organization.name,
    })
    .from(userAccountGrant)
    .innerJoin(member, eq(member.id, userAccountGrant.memberId))
    .innerJoin(agencyAccount, eq(agencyAccount.id, userAccountGrant.agencyAccountId))
    .innerJoin(organization, eq(organization.id, agencyAccount.agencyId))
    .innerJoin(sourceAccount, eq(sourceAccount.id, agencyAccount.sourceAccountId))
    .innerJoin(providerAuthorization, eq(providerAuthorization.id, sourceAccount.authorizationId))
    .where(and(eq(member.userId, session.user.id), eq(member.organizationId, agencyAccount.agencyId)))
    .orderBy(organization.name, providerAuthorization.provider, sourceAccount.name);
}

export async function listAuditEvents() {
  await requireSuperadmin();
  return db
    .select({
      id: auditEvent.id,
      actorName: user.name,
      agencyName: organization.name,
      resourceType: auditEvent.resourceType,
      resourceId: auditEvent.resourceId,
      action: auditEvent.action,
      result: auditEvent.result,
      details: auditEvent.details,
      correlationId: auditEvent.correlationId,
      createdAt: auditEvent.createdAt,
    })
    .from(auditEvent)
    .leftJoin(user, eq(user.id, auditEvent.actorUserId))
    .leftJoin(organization, eq(organization.id, auditEvent.agencyId))
    .orderBy(desc(auditEvent.createdAt))
    .limit(100);
}
