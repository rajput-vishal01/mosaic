import "server-only";

import postgres from "postgres";
import { z } from "zod";

import type { WarehouseScopeConfiguration } from "./config";

const warehouseProviderKeys = ["ga4", "google_ads", "meta_ads", "google_search_console", "google_business_profile"] as const;

const recordSchema = z.object({
  accountScopeId: z.uuid(),
  provider: z.enum(warehouseProviderKeys),
  externalAccountId: z.string().trim().min(1).max(255),
  active: z.boolean(),
});
const recordsSchema = z.array(recordSchema).max(100_000);

export type WarehouseScopeRecord = z.infer<typeof recordSchema>;
export type WarehouseScopePublishResult =
  | { state: "published"; count: number }
  | { state: "invalid" | "unavailable"; message: string };

export async function publishWarehouseScopes(configuration: WarehouseScopeConfiguration, records: WarehouseScopeRecord[]): Promise<WarehouseScopePublishResult> {
  const parsed = recordsSchema.safeParse(records);
  if (!parsed.success) return { state: "invalid", message: "The account-scope mapping set is invalid." };

  const sql = postgres(configuration.databaseUrl, { max: 1, prepare: false, connect_timeout: configuration.connectTimeoutSeconds });
  try {
    await sql.begin(async (transaction) => {
      for (let offset = 0; offset < parsed.data.length; offset += 10_000) {
        await transaction`SELECT mosaic_control.publish_account_scopes(${transaction.json(parsed.data.slice(offset, offset + 10_000))})`;
      }
    });
    return { state: "published", count: parsed.data.length };
  } catch {
    return { state: "unavailable", message: "Mosaic could not publish account scopes to the warehouse." };
  } finally {
    await sql.end({ timeout: 1 });
  }
}
