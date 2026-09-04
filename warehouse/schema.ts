import { bigint, boolean, date, index, numeric, pgSchema, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const warehouseControl = pgSchema("mosaic_control");
export const warehouseTransform = pgSchema("mosaic_transform");
export const warehouseAirbyte = pgSchema("mosaic_airbyte");

export const accountScopeMap = warehouseControl.table(
  "account_scope_map",
  {
    accountScopeId: uuid("account_scope_id").primaryKey(),
    provider: text("provider").notNull(),
    externalAccountId: text("external_account_id").notNull(),
    active: boolean("active").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("account_scope_map_provider_external_unique").on(table.provider, table.externalAccountId)],
);

export const ga4DailyMetrics = warehouseTransform.table(
  "ga4_daily_metrics",
  {
    accountScopeId: uuid("account_scope_id").notNull().references(() => accountScopeMap.accountScopeId, { onDelete: "restrict" }),
    metricDate: date("metric_date").notNull(),
    sessionDefaultChannelGroup: text("session_default_channel_group").default("(not set)").notNull(),
    country: text("country").default("(not set)").notNull(),
    deviceCategory: text("device_category").default("(not set)").notNull(),
    sessions: bigint("sessions", { mode: "number" }).default(0).notNull(),
    totalUsers: bigint("total_users", { mode: "number" }).default(0).notNull(),
    newUsers: bigint("new_users", { mode: "number" }).default(0).notNull(),
    engagedSessions: bigint("engaged_sessions", { mode: "number" }).default(0).notNull(),
    eventCount: bigint("event_count", { mode: "number" }).default(0).notNull(),
    keyEvents: numeric("key_events", { precision: 20, scale: 4 }).default("0").notNull(),
    totalRevenue: numeric("total_revenue", { precision: 20, scale: 4 }).default("0").notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }).notNull(),
    loadedAt: timestamp("loaded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.accountScopeId, table.metricDate, table.sessionDefaultChannelGroup, table.country, table.deviceCategory] }),
    index("ga4_daily_metrics_date_scope_idx").on(table.metricDate, table.accountScopeId),
  ],
);

export const ga4LoadCheckpoint = warehouseTransform.table("ga4_load_checkpoint", {
  rawTable: text("raw_table").primaryKey(),
  lastExtractedAt: timestamp("last_extracted_at", { withTimezone: true }).notNull(),
  lastRawId: text("last_raw_id").notNull(),
  lastGenerationId: bigint("last_generation_id", { mode: "number" }),
  rowsLoaded: bigint("rows_loaded", { mode: "number" }).default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
