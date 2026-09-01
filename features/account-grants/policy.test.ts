import { describe, expect, it } from "vitest";

import { isGrantScopeValid } from "./policy";

describe("account grant scope", () => {
  const valid = { requestedAgencyId: "agency-a", accountAgencyId: "agency-a", memberAgencyId: "agency-a", memberRole: "member" };

  it("allows a client and available account from the requested agency", () => {
    expect(isGrantScopeValid(valid)).toBe(true);
  });

  it("rejects an account made available to another agency", () => {
    expect(isGrantScopeValid({ ...valid, accountAgencyId: "agency-b" })).toBe(false);
  });

  it("rejects a member from another agency", () => {
    expect(isGrantScopeValid({ ...valid, memberAgencyId: "agency-b" })).toBe(false);
  });

  it("rejects granting client data scopes to an agency administrator", () => {
    expect(isGrantScopeValid({ ...valid, memberRole: "admin" })).toBe(false);
  });
});
