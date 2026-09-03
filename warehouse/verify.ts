import { randomUUID } from "node:crypto";

import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.WAREHOUSE_ADMIN_DATABASE_URL;
  if (!databaseUrl) throw new Error("WAREHOUSE_ADMIN_DATABASE_URL is required to verify the warehouse.");

  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  const accountScopeId = randomUUID();

  try {
  const [privileges] = await sql<[{ reportingSelect: boolean; controlSelect: boolean; transformSelect: boolean; reportingInsert: boolean; scopePublish: boolean; singleScopePublish: boolean; scopeMapInsert: boolean }]>`
    SELECT
      has_table_privilege('mosaic_superset_reader', 'mosaic_reporting.ga4_daily_metrics', 'SELECT') AS "reportingSelect",
      has_table_privilege('mosaic_superset_reader', 'mosaic_control.account_scope_map', 'SELECT') AS "controlSelect",
      has_table_privilege('mosaic_superset_reader', 'mosaic_transform.ga4_daily_metrics', 'SELECT') AS "transformSelect",
      has_table_privilege('mosaic_superset_reader', 'mosaic_reporting.ga4_daily_metrics', 'INSERT') AS "reportingInsert",
      has_function_privilege('mosaic_scope_writer', 'mosaic_control.publish_account_scopes(jsonb)', 'EXECUTE') AS "scopePublish",
      has_function_privilege('mosaic_scope_writer', 'mosaic_control.publish_account_scope(uuid,text,text,boolean)', 'EXECUTE') AS "singleScopePublish",
      has_table_privilege('mosaic_scope_writer', 'mosaic_control.account_scope_map', 'INSERT') AS "scopeMapInsert"
  `;
  if (!privileges?.reportingSelect || privileges.controlSelect || privileges.transformSelect || privileges.reportingInsert || !privileges.scopePublish || privileges.singleScopePublish || privileges.scopeMapInsert) {
    throw new Error("The warehouse roles do not match the expected least-privilege policy.");
  }

  const externalAccountId = `verification-${accountScopeId}`;
  await sql.begin(async (transaction) => {
    await transaction.unsafe("SET LOCAL ROLE mosaic_scope_writer");
    await transaction`SELECT mosaic_control.publish_account_scopes(${transaction.json([{ accountScopeId, provider: "ga4", externalAccountId, active: false }])})`;
  });
  await sql`INSERT INTO mosaic_transform.ga4_daily_metrics (account_scope_id, metric_date, source_updated_at) VALUES (${accountScopeId}, '2026-09-03', now())`;

  const inactiveRows = await sql.begin(async (transaction) => {
    await transaction.unsafe("SET LOCAL ROLE mosaic_superset_reader");
    const [result] = await transaction<[{ count: string }]>`SELECT count(*) FROM mosaic_reporting.ga4_daily_metrics WHERE account_scope_id = ${accountScopeId}`;
    return Number(result?.count ?? -1);
  });
  if (inactiveRows !== 0) throw new Error("An inactive account scope was exposed through the reporting view.");

  await sql.begin(async (transaction) => {
    await transaction.unsafe("SET LOCAL ROLE mosaic_scope_writer");
    await transaction`SELECT mosaic_control.publish_account_scopes(${transaction.json([{ accountScopeId, provider: "ga4", externalAccountId, active: true }])})`;
  });
  const activeRows = await sql.begin(async (transaction) => {
    await transaction.unsafe("SET LOCAL ROLE mosaic_superset_reader");
    const [result] = await transaction<[{ count: string }]>`SELECT count(*) FROM mosaic_reporting.ga4_daily_metrics WHERE account_scope_id = ${accountScopeId}`;
    return Number(result?.count ?? -1);
  });
  if (activeRows !== 1) throw new Error("An active account scope was not exposed through the reporting view.");

  let reassignmentDenied = false;
  try {
    await sql.begin(async (transaction) => {
      await transaction.unsafe("SET LOCAL ROLE mosaic_scope_writer");
      await transaction`SELECT mosaic_control.publish_account_scopes(${transaction.json([{ accountScopeId, provider: "ga4", externalAccountId: "different-account", active: true }])})`;
    });
  } catch {
    reassignmentDenied = true;
  }
  if (!reassignmentDenied) throw new Error("An immutable account scope was reassigned to another provider account.");

  let nullPayloadDenied = false;
  try {
    await sql.begin(async (transaction) => {
      await transaction.unsafe("SET LOCAL ROLE mosaic_scope_writer");
      await transaction`SELECT mosaic_control.publish_account_scopes(NULL::jsonb)`;
    });
  } catch {
    nullPayloadDenied = true;
  }
  if (!nullPayloadDenied) throw new Error("The warehouse publisher accepted a NULL mapping payload.");

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

  process.stdout.write("Warehouse verification passed: scoped publication, activation filtering, immutability, and write denial.\n");
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
