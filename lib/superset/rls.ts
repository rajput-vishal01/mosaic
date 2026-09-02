import { z } from "zod";

const scopeSchema = z.array(z.uuid()).max(100);

export function buildAccountScopeClause(scopeIds: string[]) {
  const parsed = scopeSchema.parse(scopeIds);
  const unique = [...new Set(parsed)].sort();
  if (unique.length === 0) return "1 = 0";
  return `account_scope_id IN (${unique.map((scope) => `'${scope}'`).join(", ")})`;
}
