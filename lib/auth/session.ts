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

export const getAgencyContexts = cache(async () => {
  const session = await getCurrentSession();
  if (!session || isSuperadmin(session.user.role)) return [];
  const contexts = await db
    .select({ id: organization.id, name: organization.name, role: member.role, status: agencyProfile.status })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .leftJoin(agencyProfile, eq(agencyProfile.organizationId, organization.id))
    .where(eq(member.userId, session.user.id));

  return contexts.map((context) => ({ ...context, status: context.status ?? "active" }));
});

export const getAgencyContext = cache(async () => {
  const session = await getCurrentSession();
  const contexts = await getAgencyContexts();
  if (!session || contexts.length === 0) return null;
  return contexts.find((context) => context.id === session.session.activeOrganizationId) ?? contexts[0] ?? null;
});

export async function requireAgencyManager(agencyId: string) {
  const session = await requireSession();
  if (isSuperadmin(session.user.role)) return { session, role: "superadmin" as const };

  const [membership] = await db
    .select({ role: member.role, status: agencyProfile.status })
    .from(member)
    .leftJoin(agencyProfile, eq(agencyProfile.organizationId, member.organizationId))
    .where(and(eq(member.userId, session.user.id), eq(member.organizationId, agencyId)))
    .limit(1);

  if (membership?.role !== "admin" || membership.status === "suspended") {
    redirect("/dashboard");
  }

  return { session, role: "admin" as const };
}
