CREATE TYPE "public"."agency_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "agency_profile" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"status" "agency_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agency_profile" ADD CONSTRAINT "agency_profile_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;