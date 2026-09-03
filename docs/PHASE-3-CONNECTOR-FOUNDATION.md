# Phase 3 connector foundation

Phase 3 starts with a deliberately narrow control-plane boundary. Mosaic can now distinguish an unconfigured, incomplete, invalid, reachable, unauthenticated, inaccessible, or healthy Airbyte service without sending credentials to the browser.

## Delivered checkpoint

- `openapi-fetch` drives a small typed Airbyte API surface derived from the official public schema.
- Every health check verifies the unauthenticated health endpoint, obtains a fresh short-lived application token, and reads the configured workspace.
- Zod rejects malformed configuration and unexpected token or workspace responses.
- Errors are translated into stable product states. Upstream response bodies, tokens, client credentials, workspace identifiers, and destination identifiers are not returned to the UI.
- Only a superadmin can open the connection operations screen or invoke its Server Action.
- Fixture authorization records are labeled as fixtures rather than live provider sessions.
- Mock Service Worker covers the healthy path, rejected credentials, and a workspace-scope mismatch.
- Provider authorizations now have explicit Airbyte source/connection identifiers and credential-health metadata; credentials themselves remain outside Mosaic.
- A one-row-per-authorization `sync_snapshot` records the latest job, timing, row count, last successful refresh, and a sanitized failure classification.
- One deterministic state mapper owns the precedence for not connected, reconnect required, syncing, healthy, stale, and failed UI states.
- The typed adapter can read the latest documented Airbyte sync job for each linked connection, rejects cross-connection responses, and persists normalized snapshots on an operator refresh.
- GA4 setup collects the intended numeric property boundary before authorization, uses an expiring single-use state tied to the superadmin, and consumes Airbyte's opaque `secret_id` directly into source creation.
- The callback removes the secret reference from the browser URL immediately and persists only Airbyte source/connection identifiers. Automatic accessible-property discovery is still pending and is not implied by operator-supplied IDs.
- The official Superset embedded SDK now owns iframe integration. Mosaic's token endpoint re-resolves current GA4 grants, builds a UUID-only `account_scope_id` clause, and issues a non-cacheable guest token through the server-side Superset service identity.
- Client, agency-admin, and superadmin dashboard-route boundaries are explicit. The embed stays disabled until the deployment confirms Superset embedded mode and a non-empty Mosaic allowed-domain list.
- Client freshness is derived from the current granted accounts rather than a global connection status. The dashboard exposes the oldest relevant successful timestamp and distinguishes current, refreshing, partial, stale, reconnect-required, and unavailable data while retaining the last successful view after failures.
- A superadmin can disconnect a live GA4 authorization from Mosaic. The adapter deletes the Airbyte connection before its credential-bearing source, accepts already-deleted resources for retry safety, preserves historical warehouse rows, and immediately excludes the revoked authorization from future dashboard scopes. Partial cleanup is surfaced as an operator error instead of being presented as a successful revocation.
- New Airbyte connections no longer inherit the API's manual-sync default. Mosaic creates an active UTC cron schedule at a validated 1, 2, 3, 4, 6, 8, 12, or 24-hour interval and asks Airbyte to disable the connection on non-breaking schema changes rather than silently drifting the reporting contract.
- A separately migrated PostgreSQL warehouse now defines the GA4 reporting contract. Provider IDs map to immutable `account_scope_id` values in a private control schema, transforms write to a private fact table, and Superset receives SELECT only on a security-barrier reporting view that filters inactive scopes.
- The Superset database role is a passwordless group role in Git; deployment creates its login through a secret manager. Automated verification proves control and transform objects are invisible, inactive scopes are filtered, active scopes are readable, and writes are denied.
- Mosaic now publishes non-fixture provider-account mappings through one validated bulk warehouse function. The runtime role can execute that function but cannot read or write warehouse tables directly; UUID reassignment is rejected, publication is transactional, successful GA4 setup activates scopes, and revocation deactivates them. A superadmin retry action recovers cross-database publication failures.

The checked-in API surface is intentionally narrow. Once a real self-managed Airbyte version is deployed, generate the complete client from that instance's OpenAPI schema and review the generated diff before adding OAuth mutations.

## Required server environment

| Variable | Purpose |
|---|---|
| `AIRBYTE_API_URL` | Airbyte public API base URL, including its `/v1` path |
| `AIRBYTE_CLIENT_ID` | Application client identifier created in Airbyte |
| `AIRBYTE_CLIENT_SECRET` | Application secret created in Airbyte |
| `AIRBYTE_WORKSPACE_ID` | Dedicated Mosaic workspace UUID |
| `AIRBYTE_DESTINATION_ID` | Warehouse destination UUID used for connector creation |
| `AIRBYTE_REQUEST_TIMEOUT_MS` | Server-to-server request deadline; defaults to 5000 ms |
| `AIRBYTE_SYNC_FREQUENCY_HOURS` | Server-owned ingestion cadence; supported values are 1, 2, 3, 4, 6, 8, 12, and 24; defaults to 6 |
| `AIRBYTE_GA4_OAUTH_READY` | Explicit acknowledgement that GA4 workspace OAuth credentials are configured in Airbyte |
| `SUPERSET_URL` | Superset origin used by the server adapter and embedded SDK |
| `SUPERSET_SERVICE_USERNAME` | Dedicated Superset service account username |
| `SUPERSET_SERVICE_PASSWORD` | Dedicated Superset service account password |
| `SUPERSET_GA4_DASHBOARD_ID` | Allowed embedded GA4 dashboard UUID |
| `SUPERSET_REQUEST_TIMEOUT_MS` | Superset request deadline; defaults to 5000 ms |
| `SUPERSET_EMBED_READY` | Acknowledgement that embedded mode and explicit allowed domains are hardened |
| `WAREHOUSE_SCOPE_DATABASE_URL` | Credential-bearing runtime URL for a login that belongs only to `mosaic_scope_writer` |
| `WAREHOUSE_SCOPE_CONNECT_TIMEOUT_SECONDS` | Scope-publication connection timeout; defaults to 5 seconds |

All variables are server-only. An empty Airbyte configuration is a supported local fixture-development state. A partial or malformed configuration is surfaced as needing attention.

GA4 authorization stays disabled until `AIRBYTE_GA4_OAUTH_READY=true`. Set it only after the self-managed workspace has a tested Google Analytics OAuth credential override; the flag is a deployment acknowledgement, not an OAuth secret.

## Local infrastructure finding

The current workstation has Docker 29.7.2 and 16 CPUs, but exposes about 7.47 GiB of memory and does not currently have `abctl` installed. Airbyte's planned local deployment baseline is 8 GiB before Superset and the warehouse are added, so this checkpoint does not install a resource-starved cluster or introduce an unofficial Compose topology.

The next live-infrastructure checkpoint needs a host with enough reserved memory, the supported `abctl` installation, a pinned Airbyte version, a private ingress, one Mosaic workspace, and one PostgreSQL warehouse destination. After that passes, the implemented GA4 authorization and callback can be exercised against the deployed schema.

## OAuth and user-session boundary

Provider authorization belongs to the Mosaic operator. Airbyte stores and refreshes provider credentials independently of Mosaic browser sessions. A client receives only a Mosaic session; dashboard access will later resolve current `user_account_grant` rows and issue a separate short-lived Superset guest token. Therefore neither an expired browser session nor a signed-out client stops scheduled ingestion, and no Google or Meta token is passed to the client.

## Next implementation slice

1. Provision private Airbyte and the warehouse destination on a sufficiently sized host.
2. Generate and pin the API contract from the deployed Airbyte version.
3. Install and test the GA4 workspace OAuth credential override, then exercise the implemented callback end to end.
4. Verify source/connection recovery behavior against real Airbyte failures.
5. Design and implement automatic accessible-property discovery; operator-supplied IDs remain explicit until then.
6. Schedule server-side job polling and verify stale-data behavior against a live failed sync.
