-- LOCAL/DISPOSABLE ENVIRONMENTS ONLY.
-- Production migrations are forward-only. A production reversal must be a new,
-- reviewed forward migration so deployed history remains immutable.
DROP SCHEMA IF EXISTS mosaic_reporting CASCADE;
DROP SCHEMA IF EXISTS mosaic_transform CASCADE;
DROP SCHEMA IF EXISTS mosaic_control CASCADE;
