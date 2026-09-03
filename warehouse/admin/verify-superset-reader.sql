-- Every row must evaluate to the expected value before Superset is configured.
SELECT has_schema_privilege('mosaic_superset_reader', 'mosaic_reporting', 'USAGE') AS reporting_schema_usage_expected_true;
SELECT has_table_privilege('mosaic_superset_reader', 'mosaic_reporting.ga4_daily_metrics', 'SELECT') AS reporting_select_expected_true;
SELECT has_schema_privilege('mosaic_superset_reader', 'mosaic_control', 'USAGE') AS control_schema_usage_expected_false;
SELECT has_table_privilege('mosaic_superset_reader', 'mosaic_control.account_scope_map', 'SELECT') AS control_select_expected_false;
SELECT has_schema_privilege('mosaic_superset_reader', 'mosaic_transform', 'USAGE') AS transform_schema_usage_expected_false;
SELECT has_table_privilege('mosaic_superset_reader', 'mosaic_transform.ga4_daily_metrics', 'SELECT') AS transform_select_expected_false;
SELECT has_table_privilege('mosaic_superset_reader', 'mosaic_reporting.ga4_daily_metrics', 'INSERT') AS reporting_insert_expected_false;
SELECT has_table_privilege('mosaic_superset_reader', 'mosaic_reporting.ga4_daily_metrics', 'UPDATE') AS reporting_update_expected_false;
SELECT has_table_privilege('mosaic_superset_reader', 'mosaic_reporting.ga4_daily_metrics', 'DELETE') AS reporting_delete_expected_false;
