# Warehouse foundation

The warehouse is separate from Mosaic's application database and from Airbyte's metadata database. Airbyte owns raw ingestion tables. Transform jobs write approved metrics to `mosaic_transform`; Superset can query only `mosaic_reporting`.

## Local setup

1. Start the warehouse with `docker compose -f compose.dev.yml up -d warehouse`.
2. Set `WAREHOUSE_ADMIN_DATABASE_URL` to the local value in `.env.example`.
3. Run `npm run warehouse:migrate`.
4. Apply `warehouse/admin/create-superset-reader.sql`, `warehouse/admin/create-scope-writer.sql`, and `warehouse/admin/create-transform-roles.sql` as the warehouse owner.
5. Run `warehouse/admin/verify-superset-reader.sql` and confirm every result matches its `_expected_true` or `_expected_false` suffix.
6. Run `npm run warehouse:verify` to exercise inactive/active scope filtering and an actual denied write through the Superset role.

The checked-in roles have no login or password. Production infrastructure supplies dedicated credentials from a secret manager; passwords never belong in Git or migration history. Set the Superset login's `default_transaction_read_only` to `on` and a deployment-appropriate `statement_timeout` before connecting Superset. Mosaic receives only the scope-writer login through `WAREHOUSE_SCOPE_DATABASE_URL`, never the warehouse-owner URL.

Airbyte must connect as `mosaic_airbyte_writer` after deployment activates that role as a login. This makes the role the owner of created Direct Load tables and causes the checked-in default SELECT grant for `mosaic_transform_runner` to apply. The transform worker similarly uses an activated `mosaic_transform_runner` login through `WAREHOUSE_TRANSFORM_DATABASE_URL`. If infrastructure uses differently named login roles instead, it must reproduce the owner-specific default privileges explicitly; membership alone does not transfer table ownership.

## Data contract

`mosaic_control.account_scope_map` is the bridge from a provider account identifier to Mosaic's immutable UUID. A scope is inactive by default. `mosaic_transform.ga4_daily_metrics` stores the approved GA4 grain and measures. The security-barrier view `mosaic_reporting.ga4_daily_metrics` exposes only active GA4 scopes and is the only object granted to Superset.

Mosaic publishes mappings in batches through `mosaic_control.publish_account_scopes(jsonb)`. The runtime role can execute only that validated security-definer function: it cannot select the mapping table or access transform and reporting objects. Reusing a UUID for a different provider account is rejected, and failures leave the whole publication transaction unapplied.

The initial GA4 grain is one row per account scope, date, session default channel group, country, and device category. The metric names follow the Google Analytics Data API names selected for the first dashboard. Changes to this contract require a new forward migration; deployed migrations are never edited.

Airbyte discovers and selects only the property-specific streams generated from the short `mga4` custom report name. All sources write typed Direct Load tables into the private `mosaic_airbyte` schema. Each table gets a deterministic `m_<first-28-source-id-hex>_` prefix, which preserves room under PostgreSQL's 63-character identifier limit even when Airbyte appends `Property<property-id>`.

Use `npm run operations:reconcile` as the normal one-shot worker command. A host scheduler beside Airbyte and PostgreSQL invokes it frequently and with overlapping runs disabled; Mosaic does not add a second scheduler. The worker refreshes retained Airbyte job history and transforms only source prefixes whose newest observed sync succeeded, so running or failed sync output is not published. It is deliberately not a Vercel request or browser job. `npm run warehouse:transform:ga4` remains an operator command for a manually confirmed successful sync.

New GA4 connections request their first sync immediately through Airbyte's Jobs API after canonical account scopes are published. Mosaic records the accepted job provisionally so the operator sees a syncing state at once; the reconciler later replaces it with Airbyte's authoritative timestamps and counts. The Airbyte-owned cron remains the recurring ingestion schedule.

For each eligible raw table, the transform locks and processes a bounded cursor window, rejects Airbyte conversion warnings and unmapped properties, keeps only the newest observation at the approved daily grain, then atomically upserts metrics and advances `mosaic_transform.ga4_load_checkpoint`. A two-day source lookback therefore replaces earlier daily values instead of summing repeated snapshots. Inactive mappings retain history in the transform table but remain absent from the reporting view.

Only tables matching the approved source-prefix and GA4-stream pattern are read. A matching table with missing Direct Load columns fails closed. The runner emits table and row counts only; raw records, credentials, and upstream error details stay out of process output. Run `npm run warehouse:verify:ga4` with the owner URL to exercise normalization, latest-observation replacement, role isolation, and rollback of rejected batches.

The checked-in down scripts are only for rebuilding disposable local databases. Production rollback is always another reviewed forward migration.
