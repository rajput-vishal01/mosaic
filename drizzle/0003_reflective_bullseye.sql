CREATE INDEX "audit_event_created_idx" ON "audit_event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_event_resource_result_created_idx" ON "audit_event" USING btree ("resource_type","result","created_at");--> statement-breakpoint
CREATE INDEX "user_account_grant_member_idx" ON "user_account_grant" USING btree ("member_id");