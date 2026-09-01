# Mosaic v1 requirements

**Defined:** 2026-08-31
**Core value:** A client signs into Mosaic and sees current, correctly isolated analytics for assigned marketing accounts without authorizing a provider.

## v1 requirements

### Authentication and sessions

- [x] **AUTH-01**: An invited user can set a password, sign in with Mosaic credentials, remain signed in across refreshes, and sign out.
- [x] **AUTH-02**: A user can complete an expiring, single-use password reset flow without administrator access.
- [x] **AUTH-03**: An authorized administrator can invite a user and resend or cancel a pending invitation within the administrator's scope.
- [x] **AUTH-04**: An authorized administrator can revoke a user's active sessions and prevent subsequent access by suspending the user.

### Agencies and roles

- [x] **TEN-01**: A superadmin can create, update, suspend, and restore an agency.
- [x] **TEN-02**: A superadmin can assign an agency admin to one or more explicit agencies.
- [x] **TEN-03**: An agency admin can manage client users only inside an assigned agency.
- [x] **TEN-04**: A client user can access only client routes and resources explicitly available to that user.
- [ ] **TEN-05**: A superadmin can inspect audit events for agency, user, connection, grant, dashboard, report, and security changes.

### Provider connections

- [ ] **CONN-01**: A superadmin can configure GA4 ingestion and discover accessible GA4 properties.
- [ ] **CONN-02**: A superadmin can configure Google Ads ingestion using an approved developer token and discover accessible customer accounts.
- [ ] **CONN-03**: A superadmin can configure Meta Ads ingestion and discover accessible advertising accounts.
- [ ] **CONN-04**: A superadmin can configure Google Search Console ingestion and discover accessible properties.
- [ ] **CONN-05**: A superadmin can configure Google Business Profile ingestion through the Mosaic Airbyte connector and discover accessible locations.
- [ ] **CONN-06**: A superadmin can see connection state, credential health, last successful synchronization, current job, and actionable failure classification.
- [ ] **CONN-07**: A superadmin can make selected discovered source accounts available to an agency without exposing provider credentials.
- [ ] **CONN-08**: A client user never needs a Google, Meta, Airbyte, or Superset account to use Mosaic.

### Account grants

- [x] **GRANT-01**: An authorized administrator can grant a client user access to selected source accounts already available to the user's agency.
- [x] **GRANT-02**: Two users in the same agency can have identical, overlapping, or completely different account grants.
- [x] **GRANT-03**: An agency admin cannot view or grant source accounts belonging exclusively to another agency.
- [ ] **GRANT-04**: Revoking an account grant prevents new dashboard tokens and report deliveries for that scope immediately.

### Data ingestion and freshness

- [ ] **DATA-01**: Each enabled connector synchronizes on its configured schedule without an interactive user session.
- [ ] **DATA-02**: Reporting views expose immutable agency and account-scope identifiers needed for authorization.
- [ ] **DATA-03**: A user can see the data timestamp and last successful synchronization relevant to a dashboard.
- [ ] **DATA-04**: A dashboard remains readable with the last successful data after a connector failure and clearly indicates that the data is stale.
- [ ] **DATA-05**: A superadmin can inspect recent synchronization runs, row counts, duration, and sanitized error details.

### Dashboards

- [ ] **DASH-01**: A client user lands on an assigned dashboard after signing in.
- [ ] **DASH-02**: Mosaic embeds an approved Superset dashboard without exposing Superset administration or service credentials.
- [ ] **DASH-03**: Mosaic generates short-lived Superset guest tokens from server-resolved account grants so users cannot widen their data scope.
- [ ] **DASH-04**: A superadmin can register dashboard templates and assign them to eligible agencies or client users.
- [ ] **DASH-05**: A client can use approved date and presentation filters without changing the authorization scope.
- [ ] **DASH-06**: Dashboard routes provide accessible loading, empty, partial, stale, reconnect-required, denied, error, and successful states on desktop and mobile.

### Scheduled reports

- [ ] **REPT-01**: An authorized administrator can schedule a report for an assigned dashboard, recipient, cadence, timezone, and supported format.
- [ ] **REPT-02**: A scheduled report contains only the source-account scopes allowed for its recipient at generation time.
- [ ] **REPT-03**: Report email and document presentation use the agency's configured logo, name, colors, and sender settings where supported.
- [ ] **REPT-04**: An authorized user can see report schedule status and delivery history without access to another agency's recipients.

### Operations and release

- [ ] **OPS-01**: Mosaic, Airbyte, Superset, PostgreSQL, Redis, workers, and the reverse proxy have documented self-hosted deployment and health checks.
- [ ] **OPS-02**: The Mosaic control plane can run on Vercel for a demo while ingestion, storage, and reporting remain on persistent infrastructure.
- [ ] **OPS-03**: Application data, Airbyte metadata, Superset metadata, and warehouse data have tested backup and restoration procedures.
- [ ] **OPS-04**: Secrets are excluded from Git, validated at startup, separated by service, and redacted from logs and user-facing errors.
- [ ] **OPS-05**: Automated tests prove role restrictions, cross-agency isolation, account-grant isolation, guest-token restrictions, and report-recipient restrictions.
- [ ] **OPS-06**: Operator documentation covers initial setup, connector approval prerequisites, upgrades, credential rotation, failure recovery, and rollback.

## Out of scope

| Capability | Reason |
|---|---|
| AI summaries, chat, recommendations, and agents | Explicitly excluded from the current product |
| Rank tracking and AI visibility tracking | Separate data products, not required for the five connectors |
| Anomaly detection and forecasting | Requires a later analytics product decision |
| Task management and CRM | Does not contribute to the core reporting workflow |
| Billing and public self-service signup | Mosaic is the owner's private project in v1 |
| Client-managed provider OAuth | The operator owns all provider authorization in v1 |
| Mosaic drag-and-drop dashboard authoring | Superset already supplies trusted dashboard authoring |
| Direct Airbyte or Superset access for clients | Violates the single Mosaic interface and security boundary |
| Native mobile applications | Responsive web is sufficient for v1 |

## Traceability

| Requirement | Phase | Status |
|---|---:|---|
| AUTH-01 | 1 | Complete |
| AUTH-02 | 1 | Complete |
| AUTH-03 | 1 | Complete |
| AUTH-04 | 1 | Complete |
| TEN-01 | 1 | Complete |
| TEN-02 | 1 | Complete |
| TEN-03 | 1 | Complete |
| TEN-04 | 1 | Complete |
| TEN-05 | 2 | Pending |
| GRANT-01 | 2 | Complete |
| GRANT-02 | 2 | Complete |
| GRANT-03 | 2 | Complete |
| GRANT-04 | 2 | Pending |
| CONN-01 | 3 | Pending |
| CONN-06 | 3 | Pending |
| CONN-07 | 3 | Pending |
| CONN-08 | 3 | Pending |
| DATA-01 | 3 | Pending |
| DATA-02 | 3 | Pending |
| DATA-03 | 3 | Pending |
| DATA-04 | 3 | Pending |
| DATA-05 | 3 | Pending |
| DASH-01 | 3 | Pending |
| DASH-02 | 3 | Pending |
| DASH-03 | 3 | Pending |
| CONN-02 | 4 | Pending |
| CONN-03 | 4 | Pending |
| CONN-04 | 4 | Pending |
| CONN-05 | 4 | Pending |
| DASH-04 | 5 | Pending |
| DASH-05 | 5 | Pending |
| DASH-06 | 5 | Pending |
| REPT-01 | 5 | Pending |
| REPT-02 | 5 | Pending |
| REPT-03 | 5 | Pending |
| REPT-04 | 5 | Pending |
| OPS-01 | 6 | Pending |
| OPS-02 | 6 | Pending |
| OPS-03 | 6 | Pending |
| OPS-04 | 6 | Pending |
| OPS-05 | 6 | Pending |
| OPS-06 | 6 | Pending |

**Coverage:** 42 v1 requirements, 42 mapped, 0 unmapped.

---

*Last updated: 2026-09-01 after multi-client account-grant and isolation verification.*
