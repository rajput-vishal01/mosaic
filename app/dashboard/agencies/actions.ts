"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { requireSuperadmin } from "@/lib/auth/session";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { agencyProfile } from "@/lib/db/schema";

const agencySchema = z.object({
  name: z.string().trim().min(2, "Enter an agency name.").max(80),
  slug: z.string().trim().min(2, "Enter a slug.").max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only."),
});

export type AgencyActionState = { error?: string; success?: string };

export async function createAgency(_state: AgencyActionState, formData: FormData): Promise<AgencyActionState> {
  await requireSuperadmin();
  const parsed = agencySchema.safeParse({ name: formData.get("name"), slug: formData.get("slug") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the agency details." };

  try {
    const created = await auth.api.createOrganization({
      headers: await headers(),
      body: { ...parsed.data, keepCurrentActiveOrganization: true },
    });
    await db.insert(agencyProfile).values({ organizationId: created.id }).onConflictDoNothing();
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/agencies");
    return { success: `${created.name} was created.` };
  } catch {
    return { error: "That agency slug is already in use or could not be created." };
  }
}

const statusSchema = z.object({
  agencyId: z.string().min(1),
  status: z.enum(["active", "suspended"]),
});

export async function setAgencyStatus(formData: FormData) {
  await requireSuperadmin();
  const parsed = statusSchema.safeParse({ agencyId: formData.get("agencyId"), status: formData.get("status") });
  if (!parsed.success) return;
  await db
    .insert(agencyProfile)
    .values({ organizationId: parsed.data.agencyId, status: parsed.data.status })
    .onConflictDoUpdate({ target: agencyProfile.organizationId, set: { status: parsed.data.status, updatedAt: new Date() } });
  revalidatePath("/dashboard/agencies");
}

const userSchema = z.object({
  agencyId: z.string().min(1),
  name: z.string().trim().min(2, "Enter the user's name.").max(80),
  email: z.email("Enter a valid email address."),
  password: z.string().min(12, "Use at least 12 characters."),
  agencyRole: z.enum(["admin", "member"]),
});

export async function createAgencyUser(_state: AgencyActionState, formData: FormData): Promise<AgencyActionState> {
  await requireSuperadmin();
  const parsed = userSchema.safeParse({
    agencyId: formData.get("agencyId"), name: formData.get("name"), email: formData.get("email"),
    password: formData.get("password"), agencyRole: formData.get("agencyRole"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the user details." };

  try {
    const requestHeaders = await headers();
    const created = await auth.api.createUser({
      headers: requestHeaders,
      body: { email: parsed.data.email, password: parsed.data.password, name: parsed.data.name, role: "user" },
    });
    await auth.api.addMember({
      headers: requestHeaders,
      body: { userId: created.user.id, role: parsed.data.agencyRole, organizationId: parsed.data.agencyId },
    });
    revalidatePath(`/dashboard/agencies/${parsed.data.agencyId}`);
    return { success: `${created.user.name} can now sign in.` };
  } catch {
    return { error: "The user could not be created. The email may already be registered." };
  }
}

const userStatusSchema = z.object({ userId: z.string().min(1), agencyId: z.string().min(1), action: z.enum(["suspend", "restore"]) });

export async function setAgencyUserStatus(formData: FormData) {
  const session = await requireSuperadmin();
  const parsed = userStatusSchema.safeParse({ userId: formData.get("userId"), agencyId: formData.get("agencyId"), action: formData.get("action") });
  if (!parsed.success || parsed.data.userId === session.user.id) return;
  const requestHeaders = await headers();
  if (parsed.data.action === "suspend") {
    await auth.api.banUser({ headers: requestHeaders, body: { userId: parsed.data.userId, banReason: "Suspended by Mosaic administrator" } });
    await auth.api.revokeUserSessions({ headers: requestHeaders, body: { userId: parsed.data.userId } });
  } else {
    await auth.api.unbanUser({ headers: requestHeaders, body: { userId: parsed.data.userId } });
  }
  revalidatePath(`/dashboard/agencies/${parsed.data.agencyId}`);
}
