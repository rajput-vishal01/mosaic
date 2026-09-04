-- Local disposable-database rollback only. Production rollback is a reviewed
-- forward migration after the transform runner has been stopped.
DROP TABLE IF EXISTS mosaic_transform.ga4_load_checkpoint;
DROP SCHEMA IF EXISTS mosaic_airbyte;
