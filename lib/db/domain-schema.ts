import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { member, organization, user } from "./auth-schema";

export const agencyStatus = pgEnum("agency_status", ["active", "suspended"]);

export const agencyProfile = pgTable("agency_profile", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  status: agencyStatus("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const providerKey = pgEnum("provider_key", [
  "ga4",
  "google_ads",
  "meta_ads",
  "google_search_console",
  "google_business_profile",
]);

export const providerAuthorizationStatus = pgEnum("provider_authorization_status", ["active", "revoked", "error"]);

export const providerAuthorization = pgTable(
  "provider_authorization",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: providerKey("provider").notNull(),
    label: text("label").notNull(),
    status: providerAuthorizationStatus("status").default("active").notNull(),
    externalReference: text("external_reference"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("provider_authorization_provider_label_unique").on(table.provider, table.label)],
);

export const sourceAccount = pgTable(
  "source_account",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authorizationId: uuid("authorization_id")
      .notNull()
      .references(() => providerAuthorization.id, { onDelete: "cascade" }),
    externalAccountId: text("external_account_id").notNull(),
    name: text("name").notNull(),
    accountScopeId: uuid("account_scope_id").defaultRandom().notNull(),
    metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>().default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("source_account_authorization_external_unique").on(table.authorizationId, table.externalAccountId),
    uniqueIndex("source_account_scope_unique").on(table.accountScopeId),
  ],
);

export const agencyAccount = pgTable(
  "agency_account",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agencyId: text("agency_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    sourceAccountId: uuid("source_account_id")
      .notNull()
      .references(() => sourceAccount.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("agency_account_agency_source_unique").on(table.agencyId, table.sourceAccountId)],
);

export const userAccountGrant = pgTable(
  "user_account_grant",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agencyAccountId: uuid("agency_account_id")
      .notNull()
      .references(() => agencyAccount.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    grantedByUserId: text("granted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_account_grant_account_member_unique").on(table.agencyAccountId, table.memberId),
    index("user_account_grant_member_idx").on(table.memberId),
  ],
);

export const auditResult = pgEnum("audit_result", ["allowed", "denied"]);

export const auditResourceType = pgEnum("audit_resource_type", [
  "agency",
  "user",
  "connection",
  "source_account",
  "agency_account",
  "account_grant",
  "dashboard",
  "report",
  "security",
]);

export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    agencyId: text("agency_id").references(() => organization.id, { onDelete: "set null" }),
    resourceType: auditResourceType("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    action: text("action").notNull(),
    result: auditResult("result").notNull(),
    correlationId: uuid("correlation_id").defaultRandom().notNull(),
    details: jsonb("details").$type<Record<string, string | number | boolean | null>>().default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_event_created_idx").on(table.createdAt),
    index("audit_event_agency_created_idx").on(table.agencyId, table.createdAt),
    index("audit_event_actor_created_idx").on(table.actorUserId, table.createdAt),
    index("audit_event_resource_result_created_idx").on(table.resourceType, table.result, table.createdAt),
  ],
);
