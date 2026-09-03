-- Forward-only security hardening: NULL is rejected explicitly. Production
-- rollback must be another reviewed forward migration.
CREATE OR REPLACE FUNCTION "mosaic_control"."publish_account_scopes"("requested_scopes" jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
	requested_scope jsonb;
BEGIN
	IF requested_scopes IS NULL OR jsonb_typeof(requested_scopes) IS DISTINCT FROM 'array' OR jsonb_array_length(requested_scopes) > 10000 THEN
		RAISE EXCEPTION 'account scopes must be an array of at most 10000 records' USING ERRCODE = '22023';
	END IF;

	FOR requested_scope IN SELECT value FROM jsonb_array_elements(requested_scopes)
	LOOP
		PERFORM "mosaic_control"."publish_account_scope"(
			(requested_scope ->> 'accountScopeId')::uuid,
			requested_scope ->> 'provider',
			requested_scope ->> 'externalAccountId',
			(requested_scope ->> 'active')::boolean
		);
	END LOOP;
END;
$$;
