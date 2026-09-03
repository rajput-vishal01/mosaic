CREATE TABLE "sync_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"authorization_id" uuid NOT NULL,
	"job_id" text NOT NULL,
	"status" "sync_status" NOT NULL,
	"records_synced" bigint,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"duration_seconds" integer,
	"failure_type" "sync_failure_type",
	"failure_summary" text,
	"observed_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync_run" ADD CONSTRAINT "sync_run_authorization_id_provider_authorization_id_fk" FOREIGN KEY ("authorization_id") REFERENCES "public"."provider_authorization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sync_run_authorization_job_unique" ON "sync_run" USING btree ("authorization_id","job_id");--> statement-breakpoint
CREATE INDEX "sync_run_authorization_started_idx" ON "sync_run" USING btree ("authorization_id","started_at");--> statement-breakpoint
CREATE INDEX "sync_run_status_started_idx" ON "sync_run" USING btree ("status","started_at");