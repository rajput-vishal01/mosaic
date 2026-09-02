CREATE TYPE "public"."provider_credential_status" AS ENUM('unknown', 'healthy', 'reconnect_required', 'error');--> statement-breakpoint
CREATE TYPE "public"."sync_failure_type" AS ENUM('authentication', 'authorization', 'configuration', 'rate_limit', 'upstream', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('idle', 'pending', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "sync_snapshot" (
	"authorization_id" uuid PRIMARY KEY NOT NULL,
	"job_id" text,
	"status" "sync_status" DEFAULT 'idle' NOT NULL,
	"records_synced" bigint,
	"started_at" timestamp,
	"completed_at" timestamp,
	"last_successful_at" timestamp,
	"failure_type" "sync_failure_type",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_authorization" ADD COLUMN "credential_status" "provider_credential_status" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_authorization" ADD COLUMN "airbyte_source_id" text;--> statement-breakpoint
ALTER TABLE "provider_authorization" ADD COLUMN "airbyte_connection_id" text;--> statement-breakpoint
ALTER TABLE "provider_authorization" ADD COLUMN "credentials_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "sync_snapshot" ADD CONSTRAINT "sync_snapshot_authorization_id_provider_authorization_id_fk" FOREIGN KEY ("authorization_id") REFERENCES "public"."provider_authorization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sync_snapshot_status_updated_idx" ON "sync_snapshot" USING btree ("status","updated_at");
