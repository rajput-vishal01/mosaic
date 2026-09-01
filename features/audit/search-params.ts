import { createLoader, createSerializer, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const auditResourceTypes = ["agency", "user", "connection", "source_account", "agency_account", "account_grant", "dashboard", "report", "security"] as const;
export const auditResults = ["allowed", "denied"] as const;

export const auditSearchParsers = {
  q: parseAsString.withDefault(""),
  resource: parseAsStringLiteral(auditResourceTypes),
  result: parseAsStringLiteral(auditResults),
  page: parseAsInteger.withDefault(1),
};

export const loadAuditSearchParams = createLoader(auditSearchParsers);
export const serializeAuditSearchParams = createSerializer(auditSearchParsers);
