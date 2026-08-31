import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin, organization } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";

import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { platformRoles } from "./roles";
import { sendPasswordResetEmail } from "@/lib/email/send";

export function createMosaicAuth({ allowSignup = false, autoSignIn = true } = {}) {
  return betterAuth({
  appName: "Mosaic",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: !allowSignup,
    autoSignIn,
    requireEmailVerification: false,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ email: user.email, name: user.name, resetUrl: url });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  advanced: { useSecureCookies: process.env.NODE_ENV === "production" },
  plugins: [
    admin({
      defaultRole: platformRoles.user,
      adminRoles: [platformRoles.superadmin],
      roles: {
        [platformRoles.superadmin]: adminAc,
        [platformRoles.user]: userAc,
      },
    }),
    organization({
      allowUserToCreateOrganization: (user) =>
        user.role?.split(",").includes(platformRoles.superadmin) ?? false,
      creatorRole: "admin",
      disableOrganizationDeletion: true,
      requireEmailVerificationOnInvitation: true,
    }),
  ],
  });
}

export const auth = createMosaicAuth();

export type AuthSession = typeof auth.$Infer.Session;
