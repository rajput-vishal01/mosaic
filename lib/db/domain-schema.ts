import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "./auth-schema";

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
