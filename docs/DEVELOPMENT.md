# Local development

## First run

1. Copy `.env.example` to `.env.local` and replace `BETTER_AUTH_SECRET` with a random secret.
2. Start PostgreSQL and Mailpit with `docker compose -f compose.dev.yml up -d`.
3. Apply migrations with `npm run db:migrate`.
4. Create the first operator:

   ```powershell
   npm run auth:create-superadmin -- --email you@example.com --password "a-long-unique-password" --name "Your Name"
   ```

5. Run `npm run dev` and sign in at `http://localhost:3000/login`.

Public registration is intentionally disabled. The bootstrap command comes from Better Auth, so Mosaic does not implement password or session internals.

Development authentication emails are captured by Mailpit at `http://localhost:8026`; they are never delivered externally. Production must provide the `SMTP_*` variables shown in `.env.example`.

## Verification

Run `npm run lint`, `npm test`, `npm run typecheck`, and `npm run build` before pushing a feature slice. Development PostgreSQL listens on port `5436` to avoid common local collisions.

The identity and tenant browser journey also requires PostgreSQL and Mailpit from the development Compose file. Install Chromium once with `npx playwright install chromium`, then run `npm run test:e2e`. The test starts Mosaic on port `3100`, creates isolated timestamped records, follows real invitation and password-reset emails through Mailpit, and verifies the platform, agency-admin, and client authorization boundaries.

GitHub Actions repeats migrations, superadmin bootstrap, static checks, the production build, and the browser journey against clean PostgreSQL and Mailpit services on every push and pull request.

## Schema changes

Better Auth owns `lib/db/auth-schema.ts`. Mosaic tables belong in `lib/db/domain-schema.ts`. Generate migrations with `npm run db:generate`, inspect the SQL under `drizzle/`, then run `npm run db:migrate`.
