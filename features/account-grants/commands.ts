import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agencyAccount, member, providerAuthorization, sourceAccount, userAccountGrant } from "@/lib/db/schema";
import { recordAuditEvent } from "@/features/audit/commands";
import { fixtureAuthorizationLabel, fixtureSourceAccounts } from "./fixtures";
import { isGrantScopeValid } from "./policy";

export async function seedFixtureAccounts(actorUserId: string) {
  for (const fixture of fixtureSourceAccounts) {
    const [authorization] = await db
      .insert(providerAuthorization)
      .values({ provider: fixture.provider, label: fixtureAuthorizationLabel })
      .onConflictDoUpdate({
        target: [providerAuthorization.provider, providerAuthorization.label],
        set: { status: "active", updatedAt: new Date() },
      })
      .returning({ id: providerAuthorization.id });

    if (!authorization) throw new Error("The fixture authorization could not be created.");

    await db
      .insert(sourceAccount)
      .values({
        authorizationId: authorization.id,
        externalAccountId: fixture.externalAccountId,
        name: fixture.name,
        metadata: fixture.metadata,
      })
      .onConflictDoNothing({ target: [sourceAccount.authorizationId, sourceAccount.externalAccountId] });
  }

  await recordAuditEvent({
    actorUserId,
    resourceType: "connection",
    resourceId: fixtureAuthorizationLabel,
    action: "fixture_catalog.seed",
    result: "allowed",
    details: { accountCount: fixtureSourceAccounts.length },
  });
}

export async function makeSourceAccountAvailable(input: { actorUserId: string; agencyId: string; sourceAccountId: string }) {
  const [account] = await db.select({ id: sourceAccount.id }).from(sourceAccount).where(eq(sourceAccount.id, input.sourceAccountId)).limit(1);
  if (!account) {
    await recordAuditEvent({ ...input, resourceType: "agency_account", resourceId: input.sourceAccountId, action: "agency_account.create", result: "denied", details: { reason: "source_account_not_found" } });
    return false;
  }

  await db.insert(agencyAccount).values({ agencyId: input.agencyId, sourceAccountId: input.sourceAccountId }).onConflictDoNothing();
  await recordAuditEvent({ ...input, resourceType: "agency_account", resourceId: input.sourceAccountId, action: "agency_account.create", result: "allowed" });
  return true;
}

export async function removeSourceAccountAvailability(input: { actorUserId: string; agencyId: string; agencyAccountId: string }) {
  const removed = await db
    .delete(agencyAccount)
    .where(and(eq(agencyAccount.id, input.agencyAccountId), eq(agencyAccount.agencyId, input.agencyId)))
    .returning({ id: agencyAccount.id, sourceAccountId: agencyAccount.sourceAccountId });
  const record = removed[0];
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    agencyId: input.agencyId,
    resourceType: "agency_account",
    resourceId: input.agencyAccountId,
    action: "agency_account.remove",
    result: record ? "allowed" : "denied",
    details: record ? { sourceAccountId: record.sourceAccountId } : { reason: "agency_account_not_found" },
  });
  return Boolean(record);
}

export async function setMemberAccountGrant(input: { actorUserId: string; agencyId: string; agencyAccountId: string; memberId: string; enabled: boolean }) {
  const [scope] = await db
    .select({ accountAgencyId: agencyAccount.agencyId, memberAgencyId: member.organizationId, memberRole: member.role })
    .from(agencyAccount)
    .innerJoin(member, eq(member.id, input.memberId))
    .where(eq(agencyAccount.id, input.agencyAccountId))
    .limit(1);

  const validScope = isGrantScopeValid({
    requestedAgencyId: input.agencyId,
    accountAgencyId: scope?.accountAgencyId,
    memberAgencyId: scope?.memberAgencyId,
    memberRole: scope?.memberRole,
  });
  if (!validScope) {
    await recordAuditEvent({
      actorUserId: input.actorUserId,
      agencyId: input.agencyId,
      resourceType: "account_grant",
      resourceId: `${input.agencyAccountId}:${input.memberId}`,
      action: input.enabled ? "account_grant.create" : "account_grant.revoke",
      result: "denied",
      details: { reason: "scope_mismatch" },
    });
    return false;
  }

  if (input.enabled) {
    await db.insert(userAccountGrant).values({ agencyAccountId: input.agencyAccountId, memberId: input.memberId, grantedByUserId: input.actorUserId }).onConflictDoNothing();
  } else {
    await db.delete(userAccountGrant).where(and(eq(userAccountGrant.agencyAccountId, input.agencyAccountId), eq(userAccountGrant.memberId, input.memberId)));
  }

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    agencyId: input.agencyId,
    resourceType: "account_grant",
    resourceId: `${input.agencyAccountId}:${input.memberId}`,
    action: input.enabled ? "account_grant.create" : "account_grant.revoke",
    result: "allowed",
  });
  return true;
}
