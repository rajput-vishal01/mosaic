-- Run as the warehouse owner after migrations.
-- The application login is created separately through the deployment secret
-- manager and receives membership in this passwordless group role.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mosaic_scope_writer') THEN
    CREATE ROLE mosaic_scope_writer NOLOGIN;
  END IF;
END
$$;

REVOKE ALL ON SCHEMA mosaic_transform FROM mosaic_scope_writer;
REVOKE ALL ON SCHEMA mosaic_reporting FROM mosaic_scope_writer;
REVOKE ALL ON ALL TABLES IN SCHEMA mosaic_control FROM mosaic_scope_writer;
REVOKE ALL ON ALL TABLES IN SCHEMA mosaic_transform FROM mosaic_scope_writer;
REVOKE ALL ON ALL TABLES IN SCHEMA mosaic_reporting FROM mosaic_scope_writer;

GRANT USAGE ON SCHEMA mosaic_control TO mosaic_scope_writer;
REVOKE EXECUTE ON FUNCTION mosaic_control.publish_account_scope(uuid, text, text, boolean) FROM mosaic_scope_writer;
GRANT EXECUTE ON FUNCTION mosaic_control.publish_account_scopes(jsonb) TO mosaic_scope_writer;

-- The role can invoke one validated SECURITY DEFINER function. It cannot read
-- mappings, write facts, query reports, create objects, or bypass row security.
