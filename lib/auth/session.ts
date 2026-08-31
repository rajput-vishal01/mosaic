import "server-only";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./server";
import { isSuperadmin } from "./roles";
import { db } from "@/lib/db";
import { agencyProfile, member, organization } from "@/lib/db/schema";

export const getCurrentSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireSuperadmin() {
  const session = await requireSession();

  if (!isSuperadmin(session.user.role)) {
    redirect("/dashboard");
  }

  return session;
}

export const getAgencyContext = cache(async () => {
  const session = await getCurrentSession();
  if (!session || isSuperadmin(session.user.role)) return null;

  const activeOrganizationId = session.session.activeOrganizationId;
  const filters = [eq(member.userId, session.user.id)];
  if (activeOrganizationId) filters.push(eq(member.organizationId, activeOrganizationId));

  const [context] = await db
    .select({ id: organization.id, name: organization.name, role: member.role, status: agencyProfile.status })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .leftJoin(agencyProfile, eq(agencyProfile.organizationId, organization.id))
    .where(and(...filters))
    .limit(1);

  return context ? { ...context, status: context.status ?? "active" } : null;
});
