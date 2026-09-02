import { describe, expect, it } from "vitest";

import { buildAccountScopeClause } from "./rls";

describe("Superset account-scope clause", () => {
  it("sorts and deduplicates immutable UUID scopes", () => {
    expect(buildAccountScopeClause(["22222222-2222-4222-8222-222222222222", "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"])).toBe("account_scope_id IN ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')");
  });

  it("fails closed for an empty grant set", () => {
    expect(buildAccountScopeClause([])).toBe("1 = 0");
  });

  it("rejects values that could alter the SQL clause", () => {
    expect(() => buildAccountScopeClause(["' OR 1=1 --"])).toThrow();
  });
});
