import { randomUUID } from "node:crypto";

import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.WAREHOUSE_ADMIN_DATABASE_URL;
  if (!databaseUrl) throw new Error("WAREHOUSE_ADMIN_DATABASE_URL is required to verify the warehouse.");

  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  const accountScopeId = randomUUID();

  try {
  const [privileges] = await sql<[{ reportingSelect: boolean; controlSelect: boolean; transformSelect: boolean; reportingInsert: boolean }]>`
    SELECT
      has_table_privilege('mosaic_superset_reader', 'mosaic_reporting.ga4_daily_metrics', 'SELECT') AS "reportingSelect",
      has_table_privilege('mosaic_superset_reader', 'mosaic_control.account_scope_map', 'SELECT') AS "controlSelect",
      has_table_privilege('mosaic_superset_reader', 'mosaic_transform.ga4_daily_metrics', 'SELECT') AS "transformSelect",
      has_table_privilege('mosaic_superset_reader', 'mosaic_reporting.ga4_daily_metrics', 'INSERT') AS "reportingInsert"
  `;
  if (!privileges?.reportingSelect || privileges.controlSelect || privileges.transformSelect || privileges.reportingInsert) {
    throw new Error("The Superset warehouse role does not match the expected least-privilege policy.");
  }

  await sql`INSERT INTO mosaic_control.account_scope_map (account_scope_id, provider, external_account_id) VALUES (${accountScopeId}, 'ga4', ${`verification-${accountScopeId}`})`;
  await sql`INSERT INTO mosaic_transform.ga4_daily_metrics (account_scope_id, metric_date, source_updated_at) VALUES (${accountScopeId}, '2026-09-03', now())`;

  const inactiveRows = await sql.begin(async (transaction) => {
    await transaction.unsafe("SET LOCAL ROLE mosaic_superset_reader");
    const [result] = await transaction<[{ count: string }]>`SELECT count(*) FROM mosaic_reporting.ga4_daily_metrics WHERE account_scope_id = ${accountScopeId}`;
    return Number(result?.count ?? -1);
  });
  if (inactiveRows !== 0) throw new Error("An inactive account scope was exposed through the reporting view.");

  await sql`UPDATE mosaic_control.account_scope_map SET active = true, updated_at = now() WHERE account_scope_id = ${accountScopeId}`;
  const activeRows = await sql.begin(async (transaction) => {
    await transaction.unsafe("SET LOCAL ROLE mosaic_superset_reader");
    const [result] = await transaction<[{ count: string }]>`SELECT count(*) FROM mosaic_reporting.ga4_daily_metrics WHERE account_scope_id = ${accountScopeId}`;
    return Number(result?.count ?? -1);
  });
  if (activeRows !== 1) throw new Error("An active account scope was not exposed through the reporting view.");

  let writeDenied = false;
  try {
    await sql.begin(async (transaction) => {
      await transaction.unsafe("SET LOCAL ROLE mosaic_superset_reader");
      await transaction`DELETE FROM mosaic_reporting.ga4_daily_metrics WHERE account_scope_id = ${accountScopeId}`;
    });
  } catch {
    writeDenied = true;
  }
  if (!writeDenied) throw new Error("The Superset warehouse role unexpectedly modified reporting data.");

  process.stdout.write("Warehouse verification passed: inactive scopes hidden, active scopes readable, writes denied.\n");
  } finally {
    await sql`DELETE FROM mosaic_transform.ga4_daily_metrics WHERE account_scope_id = ${accountScopeId}`;
    await sql`DELETE FROM mosaic_control.account_scope_map WHERE account_scope_id = ${accountScopeId}`;
    await sql.end();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Warehouse verification failed."}\n`);
  process.exitCode = 1;
});
