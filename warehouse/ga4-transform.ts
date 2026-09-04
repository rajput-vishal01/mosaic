import postgres from "postgres";

const AIRBYTE_SCHEMA = "mosaic_airbyte";
const GA4_TABLE_PATTERN = /^m_[0-9a-f]{28}_mga4(?:Property[0-9]{5,20})?$/;
const REQUIRED_COLUMNS = [
  "_airbyte_raw_id",
  "_airbyte_extracted_at",
  "_airbyte_meta",
  "_airbyte_generation_id",
  "property_id",
  "date",
  "sessionDefaultChannelGroup",
  "country",
  "deviceCategory",
  "sessions",
  "totalUsers",
  "newUsers",
  "engagedSessions",
  "eventCount",
  "keyEvents",
  "totalRevenue",
] as const;

type WarehouseSql = ReturnType<typeof postgres>;

export class Ga4TransformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ga4TransformError";
  }
}

export type Ga4TableResult = {
  table: string;
  rowsLoaded: number;
};

async function discoverGa4Tables(sql: WarehouseSql, sourcePrefixes?: ReadonlySet<string>) {
  const rows = await sql<{ tableName: string }[]>`
    SELECT table_name AS "tableName"
    FROM information_schema.tables
    WHERE table_schema = ${AIRBYTE_SCHEMA}
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  return rows
    .map((row) => row.tableName)
    .filter((tableName) => GA4_TABLE_PATTERN.test(tableName))
    .filter((tableName) => !sourcePrefixes || [...sourcePrefixes].some((prefix) => tableName.startsWith(prefix)));
}

async function assertTableContract(sql: postgres.TransactionSql, tableName: string) {
  const columns = await sql<{ columnName: string }[]>`
    SELECT column_name AS "columnName"
    FROM information_schema.columns
    WHERE table_schema = ${AIRBYTE_SCHEMA}
      AND table_name = ${tableName}
  `;
  const available = new Set(columns.map((column) => column.columnName));
  const missing = REQUIRED_COLUMNS.filter((column) => !available.has(column));
  if (missing.length > 0) {
    throw new Ga4TransformError(`GA4 source table ${tableName} does not match the approved Direct Load contract.`);
  }
}

async function transformTable(sql: WarehouseSql, tableName: string): Promise<Ga4TableResult> {
  if (!GA4_TABLE_PATTERN.test(tableName)) throw new Ga4TransformError("Refused an unexpected Airbyte table name.");

  return sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtextextended(${`${AIRBYTE_SCHEMA}.${tableName}`}, 0))`;
    await assertTableContract(transaction, tableName);

    const sourceTable = transaction(`${AIRBYTE_SCHEMA}.${tableName}`);
    const [checkpoint] = await transaction<
      { lastExtractedAt: Date; lastRawId: string }[]
    >`SELECT last_extracted_at AS "lastExtractedAt", last_raw_id AS "lastRawId"
      FROM mosaic_transform.ga4_load_checkpoint
      WHERE raw_table = ${tableName}
      FOR UPDATE`;
    const lastExtractedAt = checkpoint?.lastExtractedAt ?? new Date(0);
    const lastRawId = checkpoint?.lastRawId ?? "";

    const [boundary] = await transaction<
      { extractedAt: Date; rawId: string; generationId: string | null }[]
    >`SELECT
        "_airbyte_extracted_at" AS "extractedAt",
        "_airbyte_raw_id" AS "rawId",
        "_airbyte_generation_id" AS "generationId"
      FROM ${sourceTable}
      WHERE ("_airbyte_extracted_at", "_airbyte_raw_id") > (${lastExtractedAt}, ${lastRawId})
      ORDER BY "_airbyte_extracted_at" DESC, "_airbyte_raw_id" DESC
      LIMIT 1`;

    if (!boundary) return { table: tableName, rowsLoaded: 0 };

    const cursorPredicate = transaction`
      ("_airbyte_extracted_at", "_airbyte_raw_id") > (${lastExtractedAt}, ${lastRawId})
      AND ("_airbyte_extracted_at", "_airbyte_raw_id") <= (${boundary.extractedAt}, ${boundary.rawId})
    `;

    const [warnings] = await transaction<{ count: string }[]>`
      SELECT count(*) AS count
      FROM ${sourceTable}
      WHERE ${cursorPredicate}
        AND jsonb_array_length(COALESCE("_airbyte_meta"->'changes', '[]'::jsonb)) > 0
    `;
    if (Number(warnings?.count ?? 0) > 0) {
      throw new Ga4TransformError(`GA4 source table ${tableName} contains Airbyte conversion warnings.`);
    }

    const [unmapped] = await transaction<{ count: string }[]>`
      SELECT count(*) AS count
      FROM ${sourceTable} source
      LEFT JOIN mosaic_control.account_scope_map scope
        ON scope.provider = 'ga4'
       AND scope.external_account_id = source.property_id::text
      WHERE ${cursorPredicate}
        AND scope.account_scope_id IS NULL
    `;
    if (Number(unmapped?.count ?? 0) > 0) {
      throw new Ga4TransformError(`GA4 source table ${tableName} contains an unmapped property.`);
    }

    const loaded = await transaction<{ accountScopeId: string }[]>`
      WITH latest AS (
        SELECT DISTINCT ON (
          scope.account_scope_id,
          source.date::date,
          COALESCE(NULLIF(source."sessionDefaultChannelGroup"::text, ''), '(not set)'),
          COALESCE(NULLIF(source.country::text, ''), '(not set)'),
          COALESCE(NULLIF(source."deviceCategory"::text, ''), '(not set)')
        )
          scope.account_scope_id,
          source.date::date AS metric_date,
          COALESCE(NULLIF(source."sessionDefaultChannelGroup"::text, ''), '(not set)') AS session_default_channel_group,
          COALESCE(NULLIF(source.country::text, ''), '(not set)') AS country,
          COALESCE(NULLIF(source."deviceCategory"::text, ''), '(not set)') AS device_category,
          COALESCE(source.sessions::bigint, 0) AS sessions,
          COALESCE(source."totalUsers"::bigint, 0) AS total_users,
          COALESCE(source."newUsers"::bigint, 0) AS new_users,
          COALESCE(source."engagedSessions"::bigint, 0) AS engaged_sessions,
          COALESCE(source."eventCount"::bigint, 0) AS event_count,
          COALESCE(source."keyEvents"::numeric, 0) AS key_events,
          COALESCE(source."totalRevenue"::numeric, 0) AS total_revenue,
          source."_airbyte_extracted_at" AS source_updated_at
        FROM ${sourceTable} source
        JOIN mosaic_control.account_scope_map scope
          ON scope.provider = 'ga4'
         AND scope.external_account_id = source.property_id::text
        WHERE ${cursorPredicate}
        ORDER BY
          scope.account_scope_id,
          source.date::date,
          COALESCE(NULLIF(source."sessionDefaultChannelGroup"::text, ''), '(not set)'),
          COALESCE(NULLIF(source.country::text, ''), '(not set)'),
          COALESCE(NULLIF(source."deviceCategory"::text, ''), '(not set)'),
          source."_airbyte_extracted_at" DESC,
          source."_airbyte_raw_id" DESC
      )
      INSERT INTO mosaic_transform.ga4_daily_metrics (
        account_scope_id,
        metric_date,
        session_default_channel_group,
        country,
        device_category,
        sessions,
        total_users,
        new_users,
        engaged_sessions,
        event_count,
        key_events,
        total_revenue,
        source_updated_at,
        loaded_at
      )
      SELECT
        account_scope_id,
        metric_date,
        session_default_channel_group,
        country,
        device_category,
        sessions,
        total_users,
        new_users,
        engaged_sessions,
        event_count,
        key_events,
        total_revenue,
        source_updated_at,
        now()
      FROM latest
      ON CONFLICT (account_scope_id, metric_date, session_default_channel_group, country, device_category)
      DO UPDATE SET
        sessions = EXCLUDED.sessions,
        total_users = EXCLUDED.total_users,
        new_users = EXCLUDED.new_users,
        engaged_sessions = EXCLUDED.engaged_sessions,
        event_count = EXCLUDED.event_count,
        key_events = EXCLUDED.key_events,
        total_revenue = EXCLUDED.total_revenue,
        source_updated_at = EXCLUDED.source_updated_at,
        loaded_at = now()
      WHERE EXCLUDED.source_updated_at >= mosaic_transform.ga4_daily_metrics.source_updated_at
      RETURNING account_scope_id AS "accountScopeId"
    `;

    await transaction`
      INSERT INTO mosaic_transform.ga4_load_checkpoint (
        raw_table,
        last_extracted_at,
        last_raw_id,
        last_generation_id,
        rows_loaded,
        updated_at
      ) VALUES (
        ${tableName},
        ${boundary.extractedAt},
        ${boundary.rawId},
        ${boundary.generationId},
        ${loaded.length},
        now()
      )
      ON CONFLICT (raw_table) DO UPDATE SET
        last_extracted_at = EXCLUDED.last_extracted_at,
        last_raw_id = EXCLUDED.last_raw_id,
        last_generation_id = EXCLUDED.last_generation_id,
        rows_loaded = mosaic_transform.ga4_load_checkpoint.rows_loaded + EXCLUDED.rows_loaded,
        updated_at = now()
    `;

    return { table: tableName, rowsLoaded: loaded.length };
  });
}

export async function transformGa4DirectLoad(
  sql: WarehouseSql,
  options: { sourcePrefixes?: readonly string[] } = {},
): Promise<Ga4TableResult[]> {
  const sourcePrefixes = options.sourcePrefixes ? new Set(options.sourcePrefixes) : undefined;
  if (sourcePrefixes && [...sourcePrefixes].some((prefix) => !/^m_[0-9a-f]{28}_$/.test(prefix))) {
    throw new Ga4TransformError("Refused an invalid Airbyte source prefix.");
  }
  const tables = await discoverGa4Tables(sql, sourcePrefixes);
  const results: Ga4TableResult[] = [];
  for (const tableName of tables) results.push(await transformTable(sql, tableName));
  return results;
}
