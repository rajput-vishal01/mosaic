"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { requireAgencyManager, requireSuperadmin } from "@/lib/auth/session";
import { auth } from "@/lib/auth/server";
import { provisioningAuth } from "@/lib/auth/provisioning";
import { db } from "@/lib/db";
import { agencyProfile, invitation } from "@/lib/db/schema";

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

const updateAgencySchema = agencySchema.extend({ agencyId: z.string().min(1) });

export async function updateAgency(_state: AgencyActionState, formData: FormData): Promise<AgencyActionState> {
  await requireSuperadmin();
  const parsed = updateAgencySchema.safeParse({ agencyId: formData.get("agencyId"), name: formData.get("name"), slug: formData.get("slug") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the agency details." };
  try {
    await auth.api.updateOrganization({
      headers: await headers(),
      body: { organizationId: parsed.data.agencyId, data: { name: parsed.data.name, slug: parsed.data.slug } },
    });
    revalidatePath("/dashboard/agencies");
    revalidatePath(`/dashboard/agencies/${parsed.data.agencyId}`);
    return { success: "Agency details updated." };
  } catch {
    return { error: "The agency could not be updated. The slug may already be in use." };
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
  const parsed = userSchema.safeParse({
    agencyId: formData.get("agencyId"), name: formData.get("name"), email: formData.get("email"),
    password: formData.get("password"), agencyRole: formData.get("agencyRole"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the user details." };
  await requireAgencyManager(parsed.data.agencyId);

  try {
    const requestHeaders = await headers();
    const created = await provisioningAuth.api.signUpEmail({
      body: { email: parsed.data.email, password: parsed.data.password, name: parsed.data.name },
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

const removeMemberSchema = z.object({ agencyId: z.string().min(1), memberId: z.string().min(1), userId: z.string().min(1) });

export async function removeAgencyMember(formData: FormData) {
  const parsed = removeMemberSchema.safeParse({ agencyId: formData.get("agencyId"), memberId: formData.get("memberId"), userId: formData.get("userId") });
  if (!parsed.success) return;
  const manager = await requireAgencyManager(parsed.data.agencyId);
  if (parsed.data.userId === manager.session.user.id) return;
  await auth.api.removeMember({
    headers: await headers(),
    body: { memberIdOrEmail: parsed.data.memberId, organizationId: parsed.data.agencyId },
  });
  revalidatePath(`/dashboard/agencies/${parsed.data.agencyId}`);
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

const invitationSchema = z.object({
  agencyId: z.string().min(1),
  email: z.email("Enter a valid email address."),
  agencyRole: z.enum(["admin", "member"]),
});

export async function inviteAgencyUser(_state: AgencyActionState, formData: FormData): Promise<AgencyActionState> {
  const parsed = invitationSchema.safeParse({ agencyId: formData.get("agencyId"), email: formData.get("email"), agencyRole: formData.get("agencyRole") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the invitation details." };
  await requireAgencyManager(parsed.data.agencyId);
  try {
    await auth.api.createInvitation({
      headers: await headers(),
      body: { email: parsed.data.email, role: parsed.data.agencyRole, organizationId: parsed.data.agencyId },
    });
    revalidatePath(`/dashboard/agencies/${parsed.data.agencyId}`);
    return { success: `Invitation sent to ${parsed.data.email}.` };
  } catch {
    return { error: "The invitation could not be sent. The user may already be a member or have a pending invitation." };
  }
}

const invitationMutationSchema = z.object({ agencyId: z.string().min(1), invitationId: z.string().min(1) });

async function getManagedInvitation(formData: FormData) {
  const parsed = invitationMutationSchema.safeParse({ agencyId: formData.get("agencyId"), invitationId: formData.get("invitationId") });
  if (!parsed.success) return null;
  await requireAgencyManager(parsed.data.agencyId);
  const [record] = await db.select().from(invitation).where(and(eq(invitation.id, parsed.data.invitationId), eq(invitation.organizationId, parsed.data.agencyId))).limit(1);
  return record ? { ...parsed.data, record } : null;
}

export async function resendAgencyInvitation(formData: FormData) {
  const managed = await getManagedInvitation(formData);
  if (!managed || managed.record.status !== "pending") return;
  await auth.api.createInvitation({
    headers: await headers(),
    body: { email: managed.record.email, role: managed.record.role as "admin" | "member", organizationId: managed.agencyId, resend: true },
  });
  revalidatePath(`/dashboard/agencies/${managed.agencyId}`);
}

export async function cancelAgencyInvitation(formData: FormData) {
  const managed = await getManagedInvitation(formData);
  if (!managed || managed.record.status !== "pending") return;
  await auth.api.cancelInvitation({ headers: await headers(), body: { invitationId: managed.invitationId } });
  revalidatePath(`/dashboard/agencies/${managed.agencyId}`);
}
