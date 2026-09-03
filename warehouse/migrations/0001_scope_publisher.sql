CREATE FUNCTION "mosaic_control"."publish_account_scope"(
	"requested_scope_id" uuid,
	"requested_provider" text,
	"requested_external_account_id" text,
	"requested_active" boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
	IF requested_provider NOT IN ('ga4', 'google_ads', 'meta_ads', 'google_search_console', 'google_business_profile') THEN
		RAISE EXCEPTION 'unsupported provider' USING ERRCODE = '22023';
	END IF;
	IF requested_external_account_id IS NULL OR btrim(requested_external_account_id) = '' OR length(requested_external_account_id) > 255 THEN
		RAISE EXCEPTION 'invalid external account identifier' USING ERRCODE = '22023';
	END IF;

	INSERT INTO "mosaic_control"."account_scope_map" (
		"account_scope_id", "provider", "external_account_id", "active", "updated_at"
	)
	VALUES (
		requested_scope_id, requested_provider, requested_external_account_id, requested_active, now()
	)
	ON CONFLICT ("account_scope_id") DO UPDATE
	SET "active" = EXCLUDED."active", "updated_at" = now()
	WHERE "account_scope_map"."provider" = EXCLUDED."provider"
		AND "account_scope_map"."external_account_id" = EXCLUDED."external_account_id";

	IF NOT FOUND THEN
		RAISE EXCEPTION 'account scope identifiers are immutable' USING ERRCODE = '23505';
	END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "mosaic_control"."publish_account_scope"(uuid, text, text, boolean) FROM PUBLIC;
