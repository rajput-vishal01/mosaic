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

All variables are server-only. An empty Airbyte configuration is a supported local fixture-development state. A partial or malformed configuration is surfaced as needing attention.

## Local infrastructure finding

The current workstation has Docker 29.7.2 and 16 CPUs, but exposes about 7.47 GiB of memory and does not currently have `abctl` installed. Airbyte's planned local deployment baseline is 8 GiB before Superset and the warehouse are added, so this checkpoint does not install a resource-starved cluster or introduce an unofficial Compose topology.

The next live-infrastructure checkpoint needs a host with enough reserved memory, the supported `abctl` installation, a pinned Airbyte version, a private ingress, one Mosaic workspace, and one PostgreSQL warehouse destination. After that passes, GA4 operator OAuth initiation and callback completion can be built against the deployed schema.

## OAuth and user-session boundary

Provider authorization belongs to the Mosaic operator. Airbyte stores and refreshes provider credentials independently of Mosaic browser sessions. A client receives only a Mosaic session; dashboard access will later resolve current `user_account_grant` rows and issue a separate short-lived Superset guest token. Therefore neither an expired browser session nor a signed-out client stops scheduled ingestion, and no Google or Meta token is passed to the client.

## Next implementation slice

1. Provision private Airbyte and the warehouse destination on a sufficiently sized host.
2. Generate and pin the API contract from the deployed Airbyte version.
3. Add GA4 OAuth initiation and callback routes with correlation state and audit events.
4. Create the Airbyte GA4 source and connection, storing only Airbyte identifiers in Mosaic.
5. Discover GA4 properties into the existing `source_account` boundary.
6. Poll Airbyte jobs into the synchronization snapshot and verify stale-data behavior.
