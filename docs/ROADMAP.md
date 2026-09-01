# Mosaic delivery roadmap

This roadmap follows GSD's vertical-MVP approach. Each phase ends in observable behavior, automated verification, documentation updates, and a coherent Git commit. No phase includes AI or speculative future products.

## Phase overview

| Phase | Name | Outcome | Requirements |
|---:|---|---|---|
| 1 | Identity and agency foundation | Users can authenticate and exercise only their agency-scoped role | AUTH-01..04, TEN-01..04 |
| 2 | Account access control | Administrators can manage explicit user-to-account grants safely | TEN-05, GRANT-01..04 |
| 3 | GA4 end-to-end proof | One real connector flows through Airbyte and Superset into an isolated client dashboard | CONN-01, CONN-06..08, DATA-01..05, DASH-01..03 |
| 4 | Five-connector completion | Google Ads, Meta Ads, GSC, and GBP join the proven ingestion model | CONN-02..05 |
| 5 | Dashboard and reporting product | Reusable dashboards, polished states, branding, and scoped scheduled reports work inside Mosaic | DASH-04..06, REPT-01..04 |
| 6 | Self-hosted release hardening | The complete current product is deployable, recoverable, observable, and isolation-tested | OPS-01..06 |

## Phase 1: Identity and agency foundation

**Status:** Complete (2026-09-01)

**Goal:** Replace the starter interface with a secure Mosaic shell where superadmins, agency admins, and client users authenticate through a library-backed agency model.

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, TEN-01, TEN-02, TEN-03, TEN-04

### Build

- Enforce strict TypeScript and establish generated/inferred type boundaries before feature code grows.
- Adopt Better Auth with database sessions, email/password, Admin, Organization, and only the additional plugins justified by the approved login experience.
- Adopt PostgreSQL, Drizzle, and migration tooling.
- Map Better Auth organizations to agencies and define Mosaic role capabilities.
- Create invitation, password reset, session revocation, suspension, and agency-context flows.
- Build the restrained admin/client shell from customized shadcn primitives and a maintained dashboard block as starting material.
- Establish server-side policy functions and route authorization boundaries.
- Establish Vitest, Testing Library, Mock Service Worker, and Playwright.

### Do not build

- Password hashing, cookies, sessions, invitation tokens, organization membership, generic dialogs, inputs, or navigation primitives.
- Connector configuration, dashboards, and reports.

### Success criteria

1. A seeded superadmin can create an agency and invite an agency admin.
2. An agency admin can invite a client user only inside the assigned agency.
3. A client user cannot load or retrieve superadmin or agency-admin resources.
4. Suspending a user and revoking sessions blocks access on the next request.
5. Authentication and role-boundary tests pass in CI.

### Exit gate

- Dependency and license review recorded.
- Migration up/down or restore path verified.
- No custom session or password code exists.
- Documentation and a Conventional Commit complete the phase.

## Phase 2: Account access control

**Goal:** Prove the central domain rule that membership does not equal data access.

**Requirements:** TEN-05, GRANT-01, GRANT-02, GRANT-03, GRANT-04

### Build

- Add provider-authorization metadata, source-account, agency-account, user-account-grant, and audit-event models.
- Use fixtures to represent provider accounts before live ingestion exists.
- Build searchable account availability and user-grant workflows using React Hook Form, Zod, and accessible shadcn controls.
- Add table filtering, sorting, pagination, selection, and URL persistence through TanStack Table and `nuqs`.
- Enforce agency and account ownership in server policies and database queries.
- Record successful and denied security-sensitive operations.

### Do not build

- A generic authorization framework, custom table engine, custom combobox, custom form-state manager, or global application store.
- Live provider OAuth.

### Success criteria

1. Two users in one agency can receive different fixture account grants.
2. An agency admin cannot view or assign another agency's account.
3. Grant revocation takes effect on the next authorized request.
4. Audit history identifies actor, agency, resource, action, result, and correlation ID.
5. Cross-agency query and mutation tests pass.

## Phase 3: GA4 end-to-end proof

**Goal:** Deliver the smallest real vertical slice from operator authorization to isolated client analytics.

**Requirements:** CONN-01, CONN-06, CONN-07, CONN-08, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DASH-01, DASH-02, DASH-03

### Build

- Install Airbyte with its supported local tooling and keep its UI private.
- Configure warehouse PostgreSQL and a read-only Superset identity.
- Implement the typed Airbyte adapter and product-safe connection states.
- Configure GA4 authorization, property discovery, scheduled ingestion, and normalized reporting views.
- Deploy Superset with embedded dashboards enabled and hardened embed-domain configuration.
- Implement the Superset adapter and short-lived guest-token issuance from server-resolved grants.
- Embed one production-shaped GA4 dashboard inside the client portal.
- Implement freshness, stale, partial, denied, and reconnect-required states.

### Do not build

- A TypeScript rewrite of the Airbyte connector.
- Custom chart primitives.
- Public Airbyte or Superset accounts for Mosaic users.
- Shared caching of user grants or guest tokens.

### Success criteria

1. The superadmin connects GA4 and discovers at least two accessible properties.
2. Airbyte synchronizes GA4 while no Mosaic user is signed in.
3. Two client users opening the same dashboard assignment see only their separately granted properties.
4. Changing a browser filter cannot widen the server-issued RLS scope.
5. A failed connector leaves the last successful dashboard readable and marked stale.
6. Isolation tests inspect both application responses and generated guest-token clauses.

### Architecture checkpoint

Do not begin the remaining connectors until this phase proves the account-scope schema, normalization boundary, Airbyte adapter, Superset adapter, and operational error model. Correcting those boundaries after five connectors would multiply rework.

## Phase 4: Five-connector completion

**Goal:** Extend the proven connector contract to Google Ads, Meta Ads, Google Search Console, and Google Business Profile.

**Requirements:** CONN-02, CONN-03, CONN-04, CONN-05

### Build

- Add Google Ads with developer-token readiness checks, manager-account discovery, tested GAQL stream selection, and quota-aware failures.
- Add Google Search Console with property discovery and service-account or OAuth configuration supported by the deployed connector.
- Add Meta Ads with business-owned authorization, ad-account discovery, permission verification, and rate-limit classification.
- Build the GBP connector with Airbyte CDK, schema tests, incremental state, pagination, backoff, and acceptance fixtures.
- Add provider-specific setup checklists and reconnection guidance to Mosaic.
- Normalize only the measures needed by approved dashboards and reports.

### Do not build

- Connector code for the four sources Airbyte already maintains.
- Unsupported metric equivalence across providers.
- A second job scheduler.
- AI analysis of connector data.

### Success criteria

1. All five connectors can be configured from Mosaic without opening Airbyte for a client.
2. Every connector discovers assignable accounts or locations.
3. Each connector completes a scheduled incremental synchronization into account-scoped reporting views.
4. Revocation or expiry produces a provider-specific, actionable health state without leaking credentials.
5. GBP connector acceptance tests run from sanitized fixtures and document required Google approvals.

## Phase 5: Dashboard and reporting product

**Goal:** Complete the user-visible reporting experience inside Mosaic.

**Requirements:** DASH-04, DASH-05, DASH-06, REPT-01, REPT-02, REPT-03, REPT-04

### Build

- Add dashboard-template registration, connector prerequisites, and user assignments.
- Complete the client dashboard shell across desktop and mobile.
- Add approved display filters that remain separate from RLS scope.
- Configure Superset reporting workers, beat scheduler, Redis, headless browser, and SMTP.
- Build Mosaic scheduling screens and translate product schedules into Superset reporting operations.
- Resolve recipient scopes at report-generation time and block delivery after grant revocation.
- Add agency branding and report-delivery history.
- Apply the full UI state and accessibility contract.

### Do not build

- A Mosaic charting engine or dashboard builder.
- Decorative animation.
- Report AI summaries.

### Success criteria

1. A superadmin assigns one dashboard template to multiple users without duplicating its definition.
2. Two users receive reports from the same template containing only their allowed account scopes.
3. Revoking a grant blocks that scope from the next report.
4. Loading, empty, partial, stale, reconnect-required, denied, error, and success states pass visual and interaction review.
5. Keyboard-only and reduced-motion checks pass for the portal and administrative workflows.

## Phase 6: Self-hosted release hardening

**Goal:** Release only the current analytics product with secure, repeatable operations.

**Requirements:** OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06

### Build

- Create development, demo, and self-hosted production deployment definitions.
- Add reverse proxy, TLS, allowed origins, health checks, persistent storage, and resource limits.
- Add backup, restore, upgrade, rollback, and secret-rotation runbooks.
- Add structured redacted logging, correlation IDs, synchronization metrics, and service-health views.
- Run isolation suites across routes, queries, mutations, guest tokens, dashboard requests, and report delivery.
- Exercise a Vercel demo deployment for Mosaic while data services remain persistent.
- Pin images and dependencies and document the supported upgrade process.

### Do not build

- AI, rank tracking, forecasting, CRM, billing, task management, or another product line.
- Premature multi-region or hyperscale infrastructure without measured demand.

### Success criteria

1. A clean host can deploy Mosaic from documented steps.
2. A backup can restore application identity, Airbyte state, Superset definitions, and warehouse data.
3. Secrets and provider credentials do not appear in Git, logs, browser bundles, or user-facing errors.
4. The Vercel demo and self-hosted production topology both pass the critical user journey.
5. All 42 v1 requirements are verified and traceability contains no gaps.

## Phase workflow

Each phase follows the same delivery loop:

1. Re-read the installed Next.js documentation relevant to the phase.
2. Confirm selected upstream libraries still provide the planned capability.
3. Record exact dependency versions, licenses, and rejected alternatives.
4. Write a phase plan with files, migrations, tests, and rollback strategy.
5. Implement the smallest complete vertical behavior.
6. Run unit, integration, accessibility, and end-to-end verification proportional to risk.
7. Update requirements and architecture documentation if reality changed.
8. Commit the coherent phase using Conventional Commits.

## Git strategy

- Preserve the existing repository and history.
- Use small Conventional Commits such as `docs: define Mosaic architecture`, `feat(auth): add agency-scoped identity`, and `feat(ga4): deliver isolated analytics slice`.
- Do not mix dependency upgrades, unrelated formatting, and feature behavior in one commit.
- Never bypass verification hooks to force a phase commit.
- Tag the first fully verified release after Phase 6.

---

*Last updated: 2026-08-31 after GSD-based roadmap creation.*
