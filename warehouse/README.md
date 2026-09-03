# Warehouse foundation

The warehouse is separate from Mosaic's application database and from Airbyte's metadata database. Airbyte owns raw ingestion tables. Transform jobs write approved metrics to `mosaic_transform`; Superset can query only `mosaic_reporting`.

## Local setup

1. Start the warehouse with `docker compose -f compose.dev.yml up -d warehouse`.
2. Set `WAREHOUSE_ADMIN_DATABASE_URL` to the local value in `.env.example`.
3. Run `npm run warehouse:migrate`.
4. Apply `warehouse/admin/create-superset-reader.sql` as the warehouse owner.
5. Run `warehouse/admin/verify-superset-reader.sql` and confirm every result matches its `_expected_true` or `_expected_false` suffix.
6. Run `npm run warehouse:verify` to exercise inactive/active scope filtering and an actual denied write through the Superset role.

The group role has no login or password. Production infrastructure creates a dedicated login from a secret manager and grants it `mosaic_superset_reader`; the password never belongs in Git or migration history. Set that login's `default_transaction_read_only` to `on` and a deployment-appropriate `statement_timeout` before connecting Superset.

## Data contract

`mosaic_control.account_scope_map` is the bridge from a provider account identifier to Mosaic's immutable UUID. A scope is inactive by default. `mosaic_transform.ga4_daily_metrics` stores the approved GA4 grain and measures. The security-barrier view `mosaic_reporting.ga4_daily_metrics` exposes only active GA4 scopes and is the only object granted to Superset.

The initial GA4 grain is one row per account scope, date, session default channel group, country, and device category. The metric names follow the Google Analytics Data API names selected for the first dashboard. Changes to this contract require a new forward migration; deployed migrations are never edited.

The checked-in down script is only for rebuilding disposable local databases. Production rollback is always another reviewed forward migration.
