# Mosaic product definition

## What Mosaic is

Mosaic is a private, self-hostable marketing analytics platform for an operator who manages multiple agencies and their clients. The operator connects external marketing accounts once, assigns selected provider accounts to users, and gives each client a Mosaic login that opens only the dashboards and reports they are allowed to see.

Mosaic is not an Airbyte or Superset reseller. Those systems remain internal infrastructure. Mosaic is the only product interface.

## Core value

A client can sign in with Mosaic credentials and see a reliable, current, correctly isolated view of every assigned marketing account without ever authorizing Google or Meta.

## Primary workflow

1. The superadmin creates an agency.
2. The superadmin creates or invites an agency admin.
3. The superadmin authorizes a Google or Meta identity and discovers its accessible accounts.
4. The superadmin associates selected source accounts with an agency.
5. The superadmin or agency admin invites client users.
6. An authorized administrator grants source accounts and dashboard access to each client user.
7. Airbyte synchronizes provider data into PostgreSQL on a schedule.
8. The client signs into Mosaic and opens an embedded Superset dashboard.
9. Mosaic issues a short-lived Superset guest token containing server-generated row-level restrictions.
10. The client sees only the account scopes granted to that user.

## Roles

### Superadmin

The superadmin has global authority and is the only role allowed to connect or revoke provider credentials in v1.

- Create, update, suspend, and delete agencies.
- Create, invite, suspend, and delete any user.
- Assign or remove agency administrators.
- Connect, reconnect, and revoke provider authorizations.
- Discover provider accounts and assign them to agencies.
- Assign account scopes and dashboards to client users.
- Manage dashboard templates, report schedules, branding, and operational settings.
- View synchronization history, credential health, audit events, and stale-data warnings.

### Agency admin

An agency admin operates only inside an assigned agency.

- Invite, update, suspend, and remove client users in that agency.
- Grant only source accounts already assigned to that agency.
- Assign approved dashboards and report schedules.
- View connector health without seeing credential secrets.
- Never access another agency or perform provider OAuth in v1.

### Client user

A client user has the least privilege.

- Sign in, sign out, reset a password, and manage personal session security.
- View assigned dashboards and allowed filters.
- Download only report formats explicitly enabled by an administrator.
- See data freshness and reconnect notices.
- Never manage users, credentials, source accounts, dashboard definitions, or reports belonging to another user.

## Access model

Agency membership alone does not grant data access. Access is based on explicit account grants.

```text
Agency
  -> provider authorization
      -> discovered source account
          -> agency account availability
              -> user account grant
                  -> dashboard assignment
```

Two users in one agency may receive identical grants, partially overlapping grants, or completely different grants. A dashboard can be reused because Mosaic applies account restrictions at request time.

## Credential and session model

Mosaic and provider sessions are separate:

- Mosaic manages user identity and database-backed application sessions.
- Airbyte stores provider connector credentials and refresh material.
- Scheduled ingestion continues while no Mosaic user is signed in.
- Client browsers never receive provider access tokens, refresh tokens, service-account keys, Airbyte credentials, or Superset service credentials.
- A revoked provider credential changes the connection to `reconnect_required`. Existing warehouse data remains readable but is visibly marked stale.
- Google OAuth applications must not remain in Testing mode for production operation because refresh-token behavior is unsuitable for durable unattended synchronization.

## Required connectors

| Connector | Initial implementation path | Ownership |
|---|---|---|
| Google Analytics 4 | Maintained Airbyte source | Superadmin authorization or service account where supported |
| Google Ads | Maintained Airbyte source | Superadmin OAuth, Google Ads developer token, manager-account access |
| Meta Ads | Maintained Airbyte Facebook Marketing source | Superadmin-controlled Meta business authorization |
| Google Search Console | Maintained Airbyte source | Service account or superadmin OAuth |
| Google Business Profile | Custom Airbyte CDK connector | Superadmin OAuth with approved Google project |

## v1 scope

- One global superadmin authority model.
- Multiple agencies.
- Multiple agency admins and client users per agency.
- Explicit user-to-account grants.
- Five required connectors.
- Scheduled ingestion with health and freshness status.
- Embedded dashboards with strict row-level isolation.
- Dashboard templates and user assignments.
- Scheduled branded reports.
- A client portal delivered entirely through Mosaic.
- Self-hosted production deployment and a Vercel-compatible demo deployment for the Next.js control plane.

## Explicit exclusions

- AI summaries, chat, recommendations, or agents.
- Keyword rank tracking and AI visibility tracking.
- Automated anomaly detection or forecasting.
- Agency task management or CRM features.
- Payments, subscriptions, usage billing, or public SaaS onboarding.
- A drag-and-drop dashboard builder inside Mosaic. Superset supplies dashboard authoring to trusted operators.
- Direct client access to Airbyte or Superset administration.
- Native mobile applications.

## Definition of success

The first release is successful when two client users in the same agency can sign in to the same Mosaic dashboard URL, receive different account-scoped results, receive scheduled reports containing only their allowed data, and continue seeing refreshed data without authorizing any provider themselves.
