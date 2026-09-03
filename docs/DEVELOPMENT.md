# Local development

## First run

1. Copy `.env.example` to `.env.local` and replace `BETTER_AUTH_SECRET` with a random secret.
2. Start the application PostgreSQL database, warehouse PostgreSQL database, and Mailpit with `docker compose -f compose.dev.yml up -d`.
3. Apply application migrations with `npm run db:migrate`. When working on analytics data, also set `WAREHOUSE_ADMIN_DATABASE_URL`, run `npm run warehouse:migrate`, apply the Superset reader role, and run `npm run warehouse:verify` as described in `warehouse/README.md`.
4. Create the first operator:

   ```powershell
   npm run auth:create-superadmin -- --email you@example.com --password "a-long-unique-password" --name "Your Name"
   ```

5. Run `npm run dev` and sign in at `http://localhost:3000/login`.

Public registration is intentionally disabled. The bootstrap command comes from Better Auth, so Mosaic does not implement password or session internals.

Development authentication emails are captured by Mailpit at `http://localhost:8026`; they are never delivered externally. Production must provide the `SMTP_*` variables shown in `.env.example`.

## Airbyte development states

Airbyte is not required for identity, agency, fixture-account, or grant development. Leave every `AIRBYTE_*` variable empty and the connection screen will show an intentional **Not configured** state.

For a real service check, configure every `AIRBYTE_*` variable from `.env.example`. `AIRBYTE_API_URL` is the public API base ending in `/v1`, not the Airbyte web interface URL. Mosaic checks service health, obtains a fresh application token, and verifies workspace access. It never renders credentials or raw Airbyte errors.

See [Phase 3 connector foundation](./PHASE-3-CONNECTOR-FOUNDATION.md) before provisioning Airbyte or implementing provider OAuth.

## Verification

Run `npm run lint`, `npm test`, `npm run typecheck`, and `npm run build` before pushing a feature slice. The application database listens on port `5436`; the isolated warehouse listens on `5437`.

The identity, tenant, and account-grant browser journeys also require PostgreSQL and Mailpit from the development Compose file. Install Chromium once with `npx playwright install chromium`, then run `npm run test:e2e`. The tests start Mosaic on port `3100`, create isolated timestamped records, follow real invitation and password-reset emails through Mailpit, and verify platform, agency-admin, client, cross-agency, and grant-revocation boundaries.

GitHub Actions repeats application and warehouse migrations, warehouse permission/filter verification, superadmin bootstrap, static checks, the production build, and the browser journey against clean PostgreSQL and Mailpit services on every push and pull request.

## Schema changes

Better Auth owns `lib/db/auth-schema.ts`. Mosaic tables belong in `lib/db/domain-schema.ts`. Generate migrations with `npm run db:generate`, inspect the SQL under `drizzle/`, then run `npm run db:migrate`.
