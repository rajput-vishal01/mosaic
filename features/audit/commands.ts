import "server-only";

import { db } from "@/lib/db";
import { auditEvent } from "@/lib/db/schema";

type AuditInput = {
  actorUserId: string;
  agencyId?: string;
  resourceType: typeof auditEvent.$inferInsert.resourceType;
  resourceId: string;
  action: string;
  result: typeof auditEvent.$inferInsert.result;
  details?: typeof auditEvent.$inferInsert.details;
};

export async function recordAuditEvent(input: AuditInput) {
  await db.insert(auditEvent).values({
    actorUserId: input.actorUserId,
    agencyId: input.agencyId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    action: input.action,
    result: input.result,
    details: input.details ?? {},
  });
}
