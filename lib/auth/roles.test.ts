import { describe, expect, it } from "vitest";

import { isAgencyAdmin, isSuperadmin } from "./roles";

describe("role boundaries", () => {
  it("recognizes only the platform superadmin role", () => {
    expect(isSuperadmin("superadmin")).toBe(true);
    expect(isSuperadmin("user")).toBe(false);
    expect(isSuperadmin("admin")).toBe(false);
  });

  it("recognizes agency admins without elevating members", () => {
    expect(isAgencyAdmin("admin")).toBe(true);
    expect(isAgencyAdmin("member")).toBe(false);
    expect(isAgencyAdmin(undefined)).toBe(false);
  });

  it("supports Better Auth's comma-separated platform roles", () => {
    expect(isSuperadmin("user,superadmin")).toBe(true);
  });
});
