CREATE SCHEMA "mosaic_airbyte";
--> statement-breakpoint
CREATE TABLE "mosaic_transform"."ga4_load_checkpoint" (
	"raw_table" text PRIMARY KEY NOT NULL,
	"last_extracted_at" timestamp with time zone NOT NULL,
	"last_raw_id" text NOT NULL,
	"last_generation_id" bigint,
	"rows_loaded" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
REVOKE ALL ON SCHEMA "mosaic_airbyte" FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "mosaic_airbyte" FROM PUBLIC;
