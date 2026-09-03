-- Run as the warehouse owner after migrations.
-- This creates a NOLOGIN group role only; create the credential-bearing login
-- through the deployment secret manager and grant it membership in this role.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mosaic_superset_reader') THEN
    CREATE ROLE mosaic_superset_reader NOLOGIN;
  END IF;
END
$$;

REVOKE ALL ON SCHEMA mosaic_control FROM mosaic_superset_reader;
REVOKE ALL ON SCHEMA mosaic_transform FROM mosaic_superset_reader;
REVOKE ALL ON ALL TABLES IN SCHEMA mosaic_control FROM mosaic_superset_reader;
REVOKE ALL ON ALL TABLES IN SCHEMA mosaic_transform FROM mosaic_superset_reader;

GRANT USAGE ON SCHEMA mosaic_reporting TO mosaic_superset_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA mosaic_reporting TO mosaic_superset_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA mosaic_reporting GRANT SELECT ON TABLES TO mosaic_superset_reader;

-- Deliberately omitted: BYPASSRLS, CREATE, TEMP, write grants, identity schemas,
-- raw Airbyte schemas, and passwords.
