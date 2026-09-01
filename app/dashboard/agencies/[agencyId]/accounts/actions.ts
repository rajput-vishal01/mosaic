"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { makeSourceAccountAvailable, removeSourceAccountAvailability, seedFixtureAccounts, setMemberAccountGrant } from "@/features/account-grants/commands";
import { requireAgencyManager, requireSuperadmin } from "@/lib/auth/session";

const agencySchema = z.object({ agencyId: z.string().min(1) });
const availabilitySchema = agencySchema.extend({ sourceAccountId: z.uuid() });
const removalSchema = agencySchema.extend({ agencyAccountId: z.uuid() });
const grantSchema = removalSchema.extend({ memberId: z.string().min(1), enabled: z.enum(["true", "false"]) });

export async function seedAccountFixtures(formData: FormData) {
  const session = await requireSuperadmin();
  const parsed = agencySchema.safeParse({ agencyId: formData.get("agencyId") });
  if (!parsed.success) return;
  await seedFixtureAccounts(session.user.id);
  revalidatePath(`/dashboard/agencies/${parsed.data.agencyId}/accounts`);
}

export async function addAgencyAccount(formData: FormData) {
  const session = await requireSuperadmin();
  const parsed = availabilitySchema.safeParse({ agencyId: formData.get("agencyId"), sourceAccountId: formData.get("sourceAccountId") });
  if (!parsed.success) return;
  await makeSourceAccountAvailable({ actorUserId: session.user.id, ...parsed.data });
  revalidatePath(`/dashboard/agencies/${parsed.data.agencyId}/accounts`);
}

export async function removeAgencyAccount(formData: FormData) {
  const session = await requireSuperadmin();
  const parsed = removalSchema.safeParse({ agencyId: formData.get("agencyId"), agencyAccountId: formData.get("agencyAccountId") });
  if (!parsed.success) return;
  await removeSourceAccountAvailability({ actorUserId: session.user.id, ...parsed.data });
  revalidatePath(`/dashboard/agencies/${parsed.data.agencyId}/accounts`);
}

export async function toggleMemberGrant(formData: FormData) {
  const parsed = grantSchema.safeParse({
    agencyId: formData.get("agencyId"),
    agencyAccountId: formData.get("agencyAccountId"),
    memberId: formData.get("memberId"),
    enabled: formData.get("enabled"),
  });
  if (!parsed.success) return;
  const manager = await requireAgencyManager(parsed.data.agencyId);
  await setMemberAccountGrant({
    actorUserId: manager.session.user.id,
    agencyId: parsed.data.agencyId,
    agencyAccountId: parsed.data.agencyAccountId,
    memberId: parsed.data.memberId,
    enabled: parsed.data.enabled === "true",
  });
  revalidatePath(`/dashboard/agencies/${parsed.data.agencyId}/accounts`);
  revalidatePath("/dashboard");
}
