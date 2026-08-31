import "server-only";

import { count, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agencyProfile, member, organization, user } from "@/lib/db/schema";

export async function listAgencies() {
  return db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: agencyProfile.status,
      memberCount: count(member.id),
      createdAt: organization.createdAt,
    })
    .from(organization)
    .leftJoin(agencyProfile, eq(agencyProfile.organizationId, organization.id))
    .leftJoin(member, eq(member.organizationId, organization.id))
    .groupBy(organization.id, agencyProfile.status)
    .orderBy(organization.name);
}

export async function getAgencyWithMembers(agencyId: string) {
  const [agency] = await db
    .select({ id: organization.id, name: organization.name, slug: organization.slug, status: agencyProfile.status })
    .from(organization)
    .leftJoin(agencyProfile, eq(agencyProfile.organizationId, organization.id))
    .where(eq(organization.id, agencyId))
    .limit(1);

  if (!agency) return null;

  const members = await db
    .select({ id: member.id, userId: user.id, name: user.name, email: user.email, role: member.role, banned: user.banned })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, agencyId))
    .orderBy(user.name);

  return { ...agency, status: agency.status ?? "active", members };
}
