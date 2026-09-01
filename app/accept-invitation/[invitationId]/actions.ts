"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getAcceptableInvitation } from "@/lib/agencies/invitations";
import { auth } from "@/lib/auth/server";
import { provisioningAuth } from "@/lib/auth/provisioning";
import { db } from "@/lib/db";
import { invitation, user } from "@/lib/db/schema";

const schema = z.object({
  invitationId: z.string().min(1),
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  password: z.string().min(12, "Use at least 12 characters."),
  confirmation: z.string(),
}).refine((value) => value.password === value.confirmation, { path: ["confirmation"], message: "Passwords do not match." });

export type AcceptInvitationState = { error?: string; success?: boolean };

export async function acceptAgencyInvitation(_state: AcceptInvitationState, formData: FormData): Promise<AcceptInvitationState> {
  const parsed = schema.safeParse({ invitationId: formData.get("invitationId"), name: formData.get("name"), password: formData.get("password"), confirmation: formData.get("confirmation") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  const pending = await getAcceptableInvitation(parsed.data.invitationId);
  if (!pending) return { error: "This invitation is invalid, expired, or already used." };

  try {
    const created = await provisioningAuth.api.signUpEmail({ body: { email: pending.email, name: parsed.data.name, password: parsed.data.password } });
    await auth.api.addMember({ body: { userId: created.user.id, organizationId: pending.organizationId, role: pending.role as "admin" | "member" } });
    await db.transaction(async (transaction) => {
      await transaction.update(user).set({ emailVerified: true, updatedAt: new Date() }).where(eq(user.id, created.user.id));
      await transaction.update(invitation).set({ status: "accepted" }).where(and(eq(invitation.id, pending.id), eq(invitation.status, "pending")));
    });
    return { success: true };
  } catch {
    return { error: "The account could not be created. This email may already have a Mosaic account." };
  }
}
