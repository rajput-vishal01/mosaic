-- LOCAL/DISPOSABLE ENVIRONMENTS ONLY. Production rollback is a new forward migration.
DROP FUNCTION IF EXISTS mosaic_control.publish_account_scope(uuid, text, text, boolean);
