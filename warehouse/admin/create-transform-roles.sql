-- Run as an elevated warehouse deployment role after migrations.
-- Deployment activates these passwordless roles as dedicated logins (or grants
-- them to dedicated logins) and injects passwords through its secret manager.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mosaic_airbyte_writer') THEN
    CREATE ROLE mosaic_airbyte_writer NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mosaic_transform_runner') THEN
    CREATE ROLE mosaic_transform_runner NOLOGIN;
  END IF;

  EXECUTE format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO mosaic_airbyte_writer', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO mosaic_transform_runner', current_database());
END
$$;

REVOKE ALL ON SCHEMA mosaic_control FROM mosaic_airbyte_writer;
REVOKE ALL ON SCHEMA mosaic_transform FROM mosaic_airbyte_writer;
REVOKE ALL ON SCHEMA mosaic_reporting FROM mosaic_airbyte_writer;
GRANT USAGE, CREATE ON SCHEMA mosaic_airbyte TO mosaic_airbyte_writer;

REVOKE ALL ON SCHEMA mosaic_reporting FROM mosaic_transform_runner;
GRANT USAGE ON SCHEMA mosaic_airbyte, mosaic_control, mosaic_transform TO mosaic_transform_runner;
GRANT SELECT ON mosaic_control.account_scope_map TO mosaic_transform_runner;
GRANT SELECT, INSERT, UPDATE ON mosaic_transform.ga4_daily_metrics TO mosaic_transform_runner;
GRANT SELECT, INSERT, UPDATE ON mosaic_transform.ga4_load_checkpoint TO mosaic_transform_runner;

GRANT SELECT ON ALL TABLES IN SCHEMA mosaic_airbyte TO mosaic_transform_runner;
ALTER DEFAULT PRIVILEGES FOR ROLE mosaic_airbyte_writer IN SCHEMA mosaic_airbyte
  GRANT SELECT ON TABLES TO mosaic_transform_runner;

REVOKE ALL ON ALL TABLES IN SCHEMA mosaic_control FROM mosaic_airbyte_writer;
REVOKE ALL ON ALL TABLES IN SCHEMA mosaic_transform FROM mosaic_airbyte_writer;
REVOKE ALL ON ALL TABLES IN SCHEMA mosaic_reporting FROM mosaic_airbyte_writer;
REVOKE ALL ON ALL TABLES IN SCHEMA mosaic_reporting FROM mosaic_transform_runner;
