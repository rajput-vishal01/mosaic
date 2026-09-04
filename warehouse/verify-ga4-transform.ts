import { randomUUID } from "node:crypto";

import postgres from "postgres";

import { Ga4TransformError, transformGa4DirectLoad } from "./ga4-transform";

const TEST_PREFIX = "m_aaaaaaaaaaaaaaaaaaaaaaaaaaaa_";
const TEST_TABLE = `${TEST_PREFIX}mga4Property12345`;
const IGNORED_TABLE = "m_bbbbbbbbbbbbbbbbbbbbbbbbbbbb_mga4Property67890";

async function expectTransformFailure(sql: ReturnType<typeof postgres>, expectedMessage: string) {
  try {
    await transformGa4DirectLoad(sql, { sourcePrefixes: [TEST_PREFIX] });
  } catch (error) {
    if (error instanceof Ga4TransformError && error.message.includes(expectedMessage)) return;
    throw new Error("The transform failed with an unexpected public error.");
  }
  throw new Error(`The transform accepted a batch containing ${expectedMessage}.`);
}

async function main() {
  const databaseUrl = process.env.WAREHOUSE_ADMIN_DATABASE_URL;
  if (!databaseUrl) throw new Error("WAREHOUSE_ADMIN_DATABASE_URL is required to verify the GA4 transform.");

  const admin = postgres(databaseUrl, { max: 1, prepare: false });
  const runner = postgres(databaseUrl, { max: 1, prepare: false });
  const accountScopeId = randomUUID();
  const mappedProperty = `verification-${accountScopeId}`;
  const sourceTable = admin(`mosaic_airbyte.${TEST_TABLE}`);
  const firstExtractedAt = new Date("2026-09-04T08:00:00.000Z");
  const secondExtractedAt = new Date("2026-09-04T09:00:00.000Z");

  try {
    await admin.begin(async (transaction) => {
      await transaction.unsafe("SET LOCAL ROLE mosaic_airbyte_writer");
      await transaction`CREATE TABLE ${transaction(`mosaic_airbyte.${TEST_TABLE}`)} (
        "_airbyte_raw_id" varchar NOT NULL,
        "_airbyte_extracted_at" timestamptz NOT NULL,
        "_airbyte_meta" jsonb NOT NULL,
        "_airbyte_generation_id" bigint,
        property_id text,
        date text,
        "sessionDefaultChannelGroup" text,
        country text,
        "deviceCategory" text,
        sessions text,
        "totalUsers" text,
        "newUsers" text,
        "engagedSessions" text,
        "eventCount" text,
        "keyEvents" text,
        "totalRevenue" text
      )`;
      await transaction`CREATE TABLE ${transaction(`mosaic_airbyte.${IGNORED_TABLE}`)} (unexpected text)`;
      await transaction`INSERT INTO ${transaction(`mosaic_airbyte.${TEST_TABLE}`)} VALUES (
        '00000000-0000-4000-8000-000000000001', ${firstExtractedAt}, '{"changes":[]}', 1,
        ${mappedProperty}, '2026-09-03', 'Organic Search', 'India', 'desktop',
        '10', '8', '3', '7', '22', '2.5', '125.75'
      )`;
    });
    await admin`
      INSERT INTO mosaic_control.account_scope_map (account_scope_id, provider, external_account_id, active)
      VALUES (${accountScopeId}, 'ga4', ${mappedProperty}, true)
    `;

    const [privileges] = await admin<
      { writerTransform: boolean; runnerReporting: boolean; runnerSource: boolean }[]
    >`SELECT
      has_table_privilege('mosaic_airbyte_writer', 'mosaic_transform.ga4_daily_metrics', 'INSERT') AS "writerTransform",
      has_table_privilege('mosaic_transform_runner', 'mosaic_reporting.ga4_daily_metrics', 'SELECT') AS "runnerReporting",
      has_table_privilege('mosaic_transform_runner', ${`"mosaic_airbyte"."${TEST_TABLE}"`}, 'SELECT') AS "runnerSource"`;
    if (privileges?.writerTransform || privileges?.runnerReporting || !privileges?.runnerSource) {
      throw new Error("The Airbyte and transform roles do not match the expected least-privilege policy.");
    }

    await runner`SET ROLE mosaic_transform_runner`;
    const initial = await transformGa4DirectLoad(runner, { sourcePrefixes: [TEST_PREFIX] });
    if (initial.length !== 1 || initial[0]?.rowsLoaded !== 1) throw new Error("The initial GA4 batch was not loaded.");

    const [firstMetric] = await admin<{ sessions: string; totalRevenue: string }[]>`
      SELECT sessions, total_revenue AS "totalRevenue"
      FROM mosaic_transform.ga4_daily_metrics
      WHERE account_scope_id = ${accountScopeId}
    `;
    if (firstMetric?.sessions !== "10" || firstMetric.totalRevenue !== "125.7500") {
      throw new Error("The initial GA4 metrics were not normalized correctly.");
    }

    await admin.begin(async (transaction) => {
      await transaction.unsafe("SET LOCAL ROLE mosaic_airbyte_writer");
      await transaction`INSERT INTO ${transaction(`mosaic_airbyte.${TEST_TABLE}`)} VALUES (
        '00000000-0000-4000-8000-000000000002', ${secondExtractedAt}, '{"changes":[]}', 1,
        ${mappedProperty}, '2026-09-03', 'Organic Search', 'India', 'desktop',
        '14', '11', '4', '9', '30', '3', '160'
      )`;
    });
    const replacement = await transformGa4DirectLoad(runner, { sourcePrefixes: [TEST_PREFIX] });
    if (replacement[0]?.rowsLoaded !== 1) throw new Error("The replacement GA4 observation was not loaded.");

    const [replacedMetric] = await admin<{ sessions: string }[]>`
      SELECT sessions FROM mosaic_transform.ga4_daily_metrics WHERE account_scope_id = ${accountScopeId}
    `;
    if (replacedMetric?.sessions !== "14") throw new Error("A newer GA4 observation did not replace the earlier daily value.");

    const [checkpointBeforeFailure] = await admin<{ lastRawId: string; rowsLoaded: string }[]>`
      SELECT last_raw_id AS "lastRawId", rows_loaded AS "rowsLoaded"
      FROM mosaic_transform.ga4_load_checkpoint WHERE raw_table = ${TEST_TABLE}
    `;
    if (checkpointBeforeFailure?.rowsLoaded !== "2") throw new Error("The successful load count is incorrect.");

    await admin.begin(async (transaction) => {
      await transaction.unsafe("SET LOCAL ROLE mosaic_airbyte_writer");
      await transaction`INSERT INTO ${transaction(`mosaic_airbyte.${TEST_TABLE}`)} VALUES (
        '00000000-0000-4000-8000-000000000003', '2026-09-04T10:00:00.000Z', '{"changes":[]}', 1,
        'unmapped-property', '2026-09-03', 'Direct', 'India', 'mobile',
        '1', '1', '1', '1', '1', '0', '0'
      )`;
    });
    await expectTransformFailure(runner, "unmapped property");

    const [checkpointAfterUnmapped] = await admin<{ lastRawId: string }[]>`
      SELECT last_raw_id AS "lastRawId" FROM mosaic_transform.ga4_load_checkpoint WHERE raw_table = ${TEST_TABLE}
    `;
    if (checkpointAfterUnmapped?.lastRawId !== checkpointBeforeFailure?.lastRawId) {
      throw new Error("The checkpoint advanced after an unmapped-property rejection.");
    }

    await admin`DELETE FROM ${sourceTable} WHERE "_airbyte_raw_id" = '00000000-0000-4000-8000-000000000003'`;
    await admin.begin(async (transaction) => {
      await transaction.unsafe("SET LOCAL ROLE mosaic_airbyte_writer");
      await transaction`INSERT INTO ${transaction(`mosaic_airbyte.${TEST_TABLE}`)} VALUES (
        '00000000-0000-4000-8000-000000000004', '2026-09-04T11:00:00.000Z', '{"changes":[{"field":"sessions","change":"NULLED"}]}', 1,
        ${mappedProperty}, '2026-09-03', 'Direct', 'India', 'mobile',
        NULL, '1', '1', '1', '1', '0', '0'
      )`;
    });
    await expectTransformFailure(runner, "conversion warnings");

    const [checkpointAfterWarning] = await admin<{ lastRawId: string }[]>`
      SELECT last_raw_id AS "lastRawId" FROM mosaic_transform.ga4_load_checkpoint WHERE raw_table = ${TEST_TABLE}
    `;
    if (checkpointAfterWarning?.lastRawId !== checkpointBeforeFailure?.lastRawId) {
      throw new Error("The checkpoint advanced after an Airbyte-warning rejection.");
    }

    process.stdout.write("GA4 transform verification passed: normalization, replacement, least privilege, and atomic rejection.\n");
  } finally {
    await runner`RESET ROLE`.catch(() => undefined);
    await admin`DELETE FROM mosaic_transform.ga4_load_checkpoint WHERE raw_table = ${TEST_TABLE}`;
    await admin`DELETE FROM mosaic_transform.ga4_daily_metrics WHERE account_scope_id = ${accountScopeId}`;
    await admin`DELETE FROM mosaic_control.account_scope_map WHERE account_scope_id = ${accountScopeId}`;
    await admin`DROP TABLE IF EXISTS ${sourceTable}`;
    await admin`DROP TABLE IF EXISTS ${admin(`mosaic_airbyte.${IGNORED_TABLE}`)}`;
    await Promise.all([runner.end(), admin.end()]);
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "GA4 transform verification failed."}\n`);
  process.exitCode = 1;
});
