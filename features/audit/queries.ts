import "server-only";

import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import type { inferParserType } from "nuqs/server";

import { requireSuperadmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { auditEvent, organization, user } from "@/lib/db/schema";
import { auditSearchParsers } from "./search-params";

const auditPageSize = 25;

export async function listAuditEvents(filters: inferParserType<typeof auditSearchParsers>) {
  await requireSuperadmin();
  const query = filters.q.trim();
  const conditions = [
    filters.resource ? eq(auditEvent.resourceType, filters.resource) : undefined,
    filters.result ? eq(auditEvent.result, filters.result) : undefined,
    query ? or(ilike(auditEvent.action, `%${query}%`), ilike(auditEvent.resourceId, `%${query}%`), ilike(user.name, `%${query}%`), ilike(organization.name, `%${query}%`)) : undefined,
  ];

  const countRows = await db
    .select({ total: count() })
    .from(auditEvent)
    .leftJoin(user, eq(user.id, auditEvent.actorUserId))
    .leftJoin(organization, eq(organization.id, auditEvent.agencyId))
    .where(and(...conditions));
  const total = countRows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / auditPageSize));
  const page = Math.min(Math.max(filters.page, 1), totalPages);

  const events = await db
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
    .where(and(...conditions))
    .orderBy(desc(auditEvent.createdAt))
    .limit(auditPageSize)
    .offset((page - 1) * auditPageSize);

  return { events, page, total, totalPages };
}
