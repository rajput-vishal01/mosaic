CREATE TYPE "public"."audit_resource_type" AS ENUM('agency', 'user', 'connection', 'source_account', 'agency_account', 'account_grant', 'dashboard', 'report', 'security');--> statement-breakpoint
CREATE TYPE "public"."audit_result" AS ENUM('allowed', 'denied');--> statement-breakpoint
CREATE TYPE "public"."provider_authorization_status" AS ENUM('active', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "public"."provider_key" AS ENUM('ga4', 'google_ads', 'meta_ads', 'google_search_console', 'google_business_profile');--> statement-breakpoint
CREATE TABLE "agency_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" text NOT NULL,
	"source_account_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"agency_id" text,
	"resource_type" "audit_resource_type" NOT NULL,
	"resource_id" text NOT NULL,
	"action" text NOT NULL,
	"result" "audit_result" NOT NULL,
	"correlation_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_authorization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "provider_key" NOT NULL,
	"label" text NOT NULL,
	"status" "provider_authorization_status" DEFAULT 'active' NOT NULL,
	"external_reference" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"authorization_id" uuid NOT NULL,
	"external_account_id" text NOT NULL,
	"name" text NOT NULL,
	"account_scope_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_account_grant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_account_id" uuid NOT NULL,
	"member_id" text NOT NULL,
	"granted_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agency_account" ADD CONSTRAINT "agency_account_agency_id_organization_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_account" ADD CONSTRAINT "agency_account_source_account_id_source_account_id_fk" FOREIGN KEY ("source_account_id") REFERENCES "public"."source_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_agency_id_organization_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_account" ADD CONSTRAINT "source_account_authorization_id_provider_authorization_id_fk" FOREIGN KEY ("authorization_id") REFERENCES "public"."provider_authorization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_account_grant" ADD CONSTRAINT "user_account_grant_agency_account_id_agency_account_id_fk" FOREIGN KEY ("agency_account_id") REFERENCES "public"."agency_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_account_grant" ADD CONSTRAINT "user_account_grant_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_account_grant" ADD CONSTRAINT "user_account_grant_granted_by_user_id_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agency_account_agency_source_unique" ON "agency_account" USING btree ("agency_id","source_account_id");--> statement-breakpoint
CREATE INDEX "audit_event_agency_created_idx" ON "audit_event" USING btree ("agency_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_event_actor_created_idx" ON "audit_event" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_authorization_provider_label_unique" ON "provider_authorization" USING btree ("provider","label");--> statement-breakpoint
CREATE UNIQUE INDEX "source_account_authorization_external_unique" ON "source_account" USING btree ("authorization_id","external_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_account_scope_unique" ON "source_account" USING btree ("account_scope_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_account_grant_account_member_unique" ON "user_account_grant" USING btree ("agency_account_id","member_id");