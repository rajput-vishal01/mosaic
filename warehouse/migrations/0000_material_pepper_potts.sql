CREATE SCHEMA "mosaic_control";
--> statement-breakpoint
CREATE SCHEMA "mosaic_transform";
--> statement-breakpoint
CREATE SCHEMA "mosaic_reporting";
--> statement-breakpoint
CREATE TABLE "mosaic_control"."account_scope_map" (
	"account_scope_id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"external_account_id" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mosaic_transform"."ga4_daily_metrics" (
	"account_scope_id" uuid NOT NULL,
	"metric_date" date NOT NULL,
	"session_default_channel_group" text DEFAULT '(not set)' NOT NULL,
	"country" text DEFAULT '(not set)' NOT NULL,
	"device_category" text DEFAULT '(not set)' NOT NULL,
	"sessions" bigint DEFAULT 0 NOT NULL,
	"total_users" bigint DEFAULT 0 NOT NULL,
	"new_users" bigint DEFAULT 0 NOT NULL,
	"engaged_sessions" bigint DEFAULT 0 NOT NULL,
	"event_count" bigint DEFAULT 0 NOT NULL,
	"key_events" numeric(20, 4) DEFAULT '0' NOT NULL,
	"total_revenue" numeric(20, 4) DEFAULT '0' NOT NULL,
	"source_updated_at" timestamp with time zone NOT NULL,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ga4_daily_metrics_account_scope_id_metric_date_session_default_channel_group_country_device_category_pk" PRIMARY KEY("account_scope_id","metric_date","session_default_channel_group","country","device_category")
);
--> statement-breakpoint
ALTER TABLE "mosaic_transform"."ga4_daily_metrics" ADD CONSTRAINT "ga4_daily_metrics_account_scope_id_account_scope_map_account_scope_id_fk" FOREIGN KEY ("account_scope_id") REFERENCES "mosaic_control"."account_scope_map"("account_scope_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_scope_map_provider_external_unique" ON "mosaic_control"."account_scope_map" USING btree ("provider","external_account_id");--> statement-breakpoint
CREATE INDEX "ga4_daily_metrics_date_scope_idx" ON "mosaic_transform"."ga4_daily_metrics" USING btree ("metric_date","account_scope_id");
--> statement-breakpoint
CREATE VIEW "mosaic_reporting"."ga4_daily_metrics"
WITH (security_barrier = true)
AS
SELECT
	metrics."account_scope_id",
	scopes."external_account_id" AS "property_id",
	metrics."metric_date",
	metrics."session_default_channel_group",
	metrics."country",
	metrics."device_category",
	metrics."sessions",
	metrics."total_users",
	metrics."new_users",
	metrics."engaged_sessions",
	metrics."event_count",
	metrics."key_events",
	metrics."total_revenue",
	metrics."source_updated_at",
	metrics."loaded_at"
FROM "mosaic_transform"."ga4_daily_metrics" AS metrics
INNER JOIN "mosaic_control"."account_scope_map" AS scopes
	ON scopes."account_scope_id" = metrics."account_scope_id"
WHERE scopes."active" = true AND scopes."provider" = 'ga4';
--> statement-breakpoint
REVOKE ALL ON SCHEMA "mosaic_control" FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON SCHEMA "mosaic_transform" FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON SCHEMA "mosaic_reporting" FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "mosaic_control" FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "mosaic_transform" FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "mosaic_reporting" FROM PUBLIC;
