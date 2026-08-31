export const platformRoles = {
  superadmin: "superadmin",
  user: "user",
} as const;

export const agencyRoles = {
  admin: "admin",
  client: "member",
} as const;

export type PlatformRole =
  (typeof platformRoles)[keyof typeof platformRoles];
export type AgencyRole = (typeof agencyRoles)[keyof typeof agencyRoles];

export function isSuperadmin(role: string | null | undefined): boolean {
  return role?.split(",").includes(platformRoles.superadmin) ?? false;
}

export function isAgencyAdmin(role: string | null | undefined): boolean {
  return role?.split(",").includes(agencyRoles.admin) ?? false;
}
