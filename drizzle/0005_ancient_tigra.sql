CREATE TABLE "connector_oauth_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text NOT NULL,
	"provider" "provider_key" NOT NULL,
	"label" text NOT NULL,
	"property_ids" jsonb NOT NULL,
	"start_date" text,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connector_oauth_state" ADD CONSTRAINT "connector_oauth_state_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connector_oauth_state_actor_expires_idx" ON "connector_oauth_state" USING btree ("actor_user_id","expires_at");