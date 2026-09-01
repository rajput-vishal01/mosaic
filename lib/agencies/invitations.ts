import "server-only";

import { and, eq, gt } from "drizzle-orm";

import { db } from "@/lib/db";
import { invitation, organization } from "@/lib/db/schema";

export async function getAcceptableInvitation(invitationId: string) {
  const [result] = await db
    .select({ id: invitation.id, email: invitation.email, role: invitation.role, organizationId: invitation.organizationId, organizationName: organization.name })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .where(and(eq(invitation.id, invitationId), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date())))
    .limit(1);
  return result ?? null;
}
