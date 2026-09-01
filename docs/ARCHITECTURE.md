# Mosaic architecture and stack

## Architecture decision

Mosaic is a modular monolith in Next.js backed by internal data-platform services. People manage every product capability through Mosaic. Airbyte and Superset are implementation details and are not exposed as separate applications.

TypeScript is the required application language. Next.js routes, React components, domain modules, infrastructure adapters, database schemas, scripts, fixtures, and tests use TypeScript. Exceptions are limited to configuration surfaces that an upstream tool can only load as JavaScript.

```text
Browser
  -> Mosaic Next.js
      -> Better Auth and application PostgreSQL
      -> Airbyte adapter
          -> Airbyte OSS
              -> provider APIs
              -> warehouse PostgreSQL
      -> Superset adapter
          -> short-lived guest token
          -> embedded Superset dashboard
              -> read-only warehouse views

Superset workers
  -> Redis and Celery
  -> SMTP
  -> scheduled report delivery
```

## Repository target

The repository remains one product repository rather than a copy of Airbyte or Superset source.

```text
app/                         Next.js routes and route-local boundaries
components/                  Shared application and UI components
features/                    Domain modules with server, UI, schema, and policy code
  agencies/
  users/
  connections/
  account-grants/
  dashboards/
  reports/
lib/                         Cross-domain infrastructure adapters
  auth/
  db/
  airbyte/
  superset/
  email/
  observability/
packages/
  connector-google-business-profile/
infra/                       Self-host deployment definitions and configuration
tests/                       Cross-feature integration and end-to-end tests
docs/                        Product and engineering source of truth
```

The exact structure can change when implementation proves a better boundary. Domain behavior must not be organized into generic `utils`, `helpers`, or a global client-state store.

## Library-first stack

| Capability | Selected foundation | What Mosaic still owns |
|---|---|---|
| Language | TypeScript in strict mode | Domain types and safe service boundaries |
| Web application | Next.js App Router and React Server Components | Product routes and domain behavior |
| Authentication | Better Auth email/password, Admin, Organization, and optional Username plugins | Role mapping, security policy, product screens |
| Sessions | Better Auth database sessions | Session duration and revocation policy |
| Agencies and invitations | Better Auth Organization plugin | Mosaic-specific agency metadata and restrictions |
| Authorization | Better Auth access control plus server-side policy functions | Resource ownership checks and account-grant rules |
| Application database | PostgreSQL with Drizzle ORM and Drizzle migrations | Mosaic domain schema and queries |
| Validation | Zod | Product schemas and messages |
| Complex forms | React Hook Form with Zod resolver and shadcn Field primitives | Form composition and business behavior |
| UI primitives | Customized shadcn/ui on Radix primitives | Mosaic tokens and feature composition |
| Tables | TanStack Table with shadcn table primitives | Column definitions and server queries |
| URL state | `nuqs` | Which filters and views are shareable |
| Server data | React Server Components and framework data access | Domain query functions |
| Client server-state | TanStack Query only for polling and client-side mutations that need it | Query keys and invalidation policy |
| Icons | Phosphor Icons | Semantic icon selection |
| Email markup | React Email | Mosaic templates and copy |
| Email delivery | Nodemailer over configured SMTP | Delivery configuration and audit events |
| Ingestion | Airbyte OSS and its maintained connectors | Orchestration, mapping, health UI, and one GBP connector |
| Airbyte integration | `openapi-fetch` generated from the deployed Airbyte OpenAPI schema | A narrow typed adapter and product-safe errors |
| Dashboards | Apache Superset and `@superset-ui/embedded-sdk` | Templates, assignments, guest-token policy, and branding shell |
| Reports | Superset alerts and reports with Celery, Redis, and a headless browser | Product scheduling UI and authorization |
| Unit tests | Vitest | Domain tests |
| Component tests | Testing Library and `@testing-library/user-event` | Accessibility and interaction cases |
| API mocks | Mock Service Worker | Provider and service failure fixtures |
| End-to-end tests | Playwright | Role, isolation, connector, dashboard, and report journeys |
| Logging | Pino with redaction | Event vocabulary, correlation IDs, and sinks |

Better Auth is selected because its maintained plugins already provide user administration, organizations, invitations, teams, custom roles, session revocation, and email/password authentication. The [Organization plugin](https://better-auth.com/docs/plugins/organization) maps closely to agencies and the [Admin plugin](https://better-auth.com/docs/plugins/admin) supplies global user administration. Mosaic must not recreate these capabilities.

## State-management policy

Mosaic does not begin with Redux, Zustand, or another application-wide client store.

- Durable domain state lives in PostgreSQL.
- Shareable table and filter state lives in the URL through `nuqs`.
- Server-rendered data is loaded in Server Components.
- TanStack Query is introduced only for connector status polling, long-running actions, and interactions that need background refresh.
- Local component state handles dialogs, disclosure, and temporary selections.
- A global UI store may be added only after a concrete cross-route state problem is demonstrated.

## TypeScript policy

- Keep `strict` enabled and adopt the strongest additional compiler checks compatible with the selected libraries.
- Infer database, validation, form, and API types from Drizzle, Zod, Better Auth, and OpenAPI sources instead of maintaining parallel handwritten interfaces.
- Use `unknown` at untrusted boundaries and narrow it through schemas.
- Do not introduce `any`, non-null assertions, or broad type casts to silence integration problems.
- Prefer discriminated unions for connection, synchronization, report, and asynchronous UI states.
- Keep provider-specific payload types behind connector adapters. Product features consume normalized Mosaic types.
- Generate Airbyte API types from the deployed OpenAPI schema and verify generated changes in review.
- The Google Business Profile connector can use Airbyte's supported Python CDK internally if required by Airbyte, but its repository contract, fixtures, schemas, and Mosaic-facing adapter remain typed and versioned. Mosaic will not rewrite a working CDK solely to claim an all-TypeScript infrastructure stack.

## Form policy

- Better Auth owns login, password hashing, session creation, reset tokens, and invitation primitives.
- React Hook Form owns complex client-side form state.
- Zod owns input validation schemas and inferred input types.
- Server-side authorization is repeated for every mutation. Client-side disabled controls are not authorization.
- Native Server Actions and Route Handlers are used as framework boundaries. A wrapper library is added only if repeated mutation boilerplate is proven during implementation.

## Core domain model

Better Auth owns its user, session, organization, membership, and invitation tables. Mosaic owns the following domain records:

| Entity | Purpose |
|---|---|
| `agency_profile` | Mosaic metadata and branding for a Better Auth organization |
| `provider_authorization` | Metadata and Airbyte references for an operator-owned provider authorization |
| `source_account` | A GA4 property, Ads customer, Meta ad account, GSC property, or GBP location discovered through an authorization |
| `agency_account` | Makes a source account available to one agency |
| `user_account_grant` | Grants one agency member access to one agency account |
| `dashboard_template` | Approved Superset dashboard and supported connector requirements |
| `dashboard_assignment` | Assigns a dashboard template to a client user or agency scope |
| `report_schedule` | Authorized recipient, dashboard, cadence, format, and timezone |
| `sync_snapshot` | Latest Airbyte job, freshness, row counts, and error classification |
| `audit_event` | Actor, agency, resource, action, result, and correlation metadata |

Every warehouse-facing row or secure view exposes an immutable `account_scope_id`. Superset guest tokens receive only the account scopes resolved from `user_account_grant` on the server.

Phase 2 implements this model with non-secret fixture source accounts covering all five provider types. The fixtures validate agency availability and per-client grant behavior without pretending that a provider is connected. Airbyte discovery will populate the same `provider_authorization` and `source_account` boundary in later phases; provider credentials never belong in these application tables.

## Authorization model

Authorization uses two layers:

1. Role capability: whether a superadmin, agency admin, or client user may perform an action type.
2. Resource scope: whether the actor belongs to the agency and has an explicit relationship to the requested resource.

Required invariants:

- A role alone never grants provider data.
- The active organization identifier supplied by a session is treated as input, not proof. Resource ownership is verified in the database.
- Agency admins cannot assign accounts that are not available to their agency.
- Client users cannot request arbitrary account scope IDs.
- Guest-token row-level clauses are generated from database grants and never from browser-submitted filters.
- Superset uses a read-only warehouse identity.
- Airbyte and Superset service credentials are server-only.
- Sensitive mutations and all denied attempts emit audit events.

Superset guest tokens are short-lived and include dashboard resources and row-level clauses. The official [embedded SDK](https://superset.apache.org/user-docs/6.1.0/using-superset/embedding/) refreshes these tokens through Mosaic. Guest-token expiry is not connected to provider-token expiry.

## Data ingestion

### Existing connectors

Airbyte supplies maintained sources for GA4, Google Ads, Facebook Marketing, and Google Search Console. One Airbyte source is created per authorization and configuration boundary that needs independent scheduling or revocation. Source records and Airbyte IDs remain internal.

### Google Business Profile

The Airbyte catalog currently advertises Google My Business on a marketing page but does not provide a usable maintained self-managed source in its active connector repository. Mosaic therefore owns an Airbyte CDK connector for Google Business Profile.

The custom connector must implement:

- OAuth refresh handling through Airbyte secret fields.
- Account and location discovery.
- Location metadata.
- Performance metrics supported by the approved APIs.
- Reviews and rating aggregates where API permissions allow.
- Pagination, incremental state, backoff, quota classification, schema tests, and connector acceptance tests.
- A documented response to Google API version changes.

Google requires project approval and the `business.manage` scope. Approval is an external release dependency, not an implementation detail.

## Warehouse boundaries

- Airbyte raw tables remain ingestion-owned.
- Stable reporting views or transformed tables normalize provider-specific names into Mosaic dimensions and measures.
- Raw and normalized objects include provider account identifiers and `account_scope_id`.
- Superset reads only approved reporting views through a read-only database role.
- Application queries never rely on Superset RLS as the only security boundary.
- Cross-provider totals are defined only when metric semantics are compatible and documented.
- Sync timestamps and source time zones are retained so the UI can explain freshness and date boundaries.

## Next.js rendering and caching

- Server Components are the default.
- Client Components are leaves for forms, tables, dialogs, polling, and the Superset embed.
- Runtime session and authorization reads stay outside shared caches.
- Public configuration and non-sensitive reference data may use Cache Components after adoption is validated against the installed Next.js documentation.
- Per-user account grants and guest tokens are never placed in a shared cache.
- Suspense boundaries sit close to asynchronous regions and use geometry-matched skeletons.
- Mutations invalidate the narrowest relevant path, tag, or query key.

Next.js itself recommends an authentication library rather than implementing authentication manually. The installed Next.js 16.3.3 documentation is the authority for framework APIs used during each phase.

## Service boundaries

### Airbyte adapter

Mosaic exposes product concepts such as Connect, Reconnect, Discover accounts, Sync now, and View health. It does not expose Airbyte workspace, source, destination, or connection objects directly.

The adapter owns:

- Airbyte client-credential token refresh.
- Typed requests based on the deployed API schema.
- Idempotency where supported.
- Error translation into actionable Mosaic states.
- Correlation between Mosaic records and Airbyte IDs.
- Timeouts, retry classification, and audit metadata.

### Superset adapter

The adapter owns:

- Service-account authentication.
- Guest-token creation.
- Allowed dashboard validation.
- Server-generated RLS clauses.
- Safe embed configuration.
- Health checks and product-safe error mapping.

## Deployment topology

### Local development

- Next.js runs on the developer machine.
- Application PostgreSQL and supporting services run in containers.
- Superset, Redis, Celery, SMTP capture, and warehouse PostgreSQL run through development infrastructure definitions.
- Airbyte runs through its supported `abctl` local installation rather than a hand-maintained unofficial Compose file.

### Vercel demo

- Vercel hosts Mosaic Next.js only.
- PostgreSQL and internal services run on a secured demo host reachable through HTTPS service endpoints.
- Airbyte and Superset administration endpoints are not publicly linked.
- Long-running ingestion and reporting never execute inside Vercel Functions.

### Self-hosted production

- Mosaic Next.js runs as a container behind the same reverse proxy as the internal services.
- Airbyte runs on its supported Kubernetes deployment.
- Superset web, worker, beat, Redis, metadata database, warehouse, and Mosaic application database use persistent volumes or external managed equivalents.
- TLS, backups, secret management, health checks, resource limits, and restore drills are mandatory.

Airbyte recommends at least 4 CPUs and 8 GB of memory for its own local deployment. A combined demo host should start above that baseline because Superset and PostgreSQL share the machine. Production sizing follows measured synchronization volume, not a fixed promise.

## Security requirements

- Secrets stay outside Git and are validated at startup.
- Password and session handling remains inside Better Auth.
- Provider credentials remain inside Airbyte where possible.
- Service-to-service secrets use separate identities and minimum permissions.
- Superset is configured for explicit allowed embed domains, TLS, secure cookies, and rotated secrets.
- PostgreSQL roles separate application writes, Airbyte ingestion, transformations, and Superset reads.
- Logs redact passwords, tokens, authorization codes, cookies, connector configurations, and sensitive query values.
- Invitations are expiring, single-purpose, and auditable.
- Deletion defaults to recoverable suspension where business rules permit.
- Cross-agency isolation is tested at the query, route, mutation, embed-token, and report layers.

## Build versus reuse rule

Before implementing a capability, the phase plan must answer these questions:

1. Does the selected framework or an already selected dependency provide it?
2. Does an actively maintained, self-hostable library provide it under an acceptable license?
3. Can an upstream product such as Airbyte or Superset own it without exposing that product to users?
4. If custom work remains, is it Mosaic-specific domain behavior?

Custom implementations are justified for agency/account grants, product-safe orchestration, the GBP connector, normalized marketing views, dashboard assignments, and the Mosaic user experience. Custom authentication, password hashing, generic form state, generic table mechanics, generic OAuth token storage, chart rendering, and job scheduling are rejected.

## Licensing boundary

Airbyte uses Elastic License 2.0 for its platform and connectors. Its own guidance permits an analytics application to use Airbyte internally as long as customers are not sold direct access to Airbyte functionality. Mosaic therefore keeps Airbyte UI and API private and presents only Mosaic workflows. [Airbyte license FAQ](https://github.com/airbytehq/airbyte/blob/master/docs/community/licenses/license-faq.md)

Apache Superset is Apache-licensed. Better Auth, Drizzle, shadcn/ui, Radix, TanStack, Zod, React Hook Form, and the selected testing packages must have their exact licenses recorded in the dependency review generated during implementation.
