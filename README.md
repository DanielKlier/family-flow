# FamilyFlow

FamilyFlow is a local web application for household and family finance planning.

## Requirements

- Node.js 24
- pnpm 11
- Docker and Docker Compose

## Local Development

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and adjust values if needed.
3. Start PostgreSQL with `docker compose -f compose.yaml -f compose.dev.yaml up -d postgres`. The development override exposes PostgreSQL on `127.0.0.1:5432` for host-based development.
4. For local development without Authentik, set `AUTH_MODE=test` in `.env`.
5. Start the development server with `pnpm dev`.
6. Open `http://127.0.0.1:3000/health` to verify the app is running.
7. Open `http://127.0.0.1:3000/auth/test-login` in `AUTH_MODE=test`, then open `http://127.0.0.1:3000/admin/master-data` to verify seeded accounts and categories.
8. Open `http://127.0.0.1:3000/transactions` to create, edit, delete, filter, and explicitly mark or unmark expenses as internal transfers.
9. Open `http://127.0.0.1:3000/income` to maintain recurring income, monthly overrides, and monthly planned income totals.
10. Open `http://127.0.0.1:3000/imports/csv` to save CSV import profiles, preview CSV expenses, and confirm imports.

## Local OIDC Development

The development Compose override includes Dex as a lightweight local OIDC provider. This mode is intended for running PostgreSQL and Dex in Docker while running the app on the host with `pnpm dev:oidc`.

Start local infrastructure with `docker compose --env-file .env.dev -f compose.yaml -f compose.dev.yaml up -d postgres dex`.

The local Dex flow uses the committed `.env.dev` file:

- `AUTH_MODE=oidc`
- `BASE_URL=http://127.0.0.1:3000`
- `OIDC_ISSUER_URL=http://127.0.0.1:5556/dex`
- `OIDC_CLIENT_ID=family-flow-dev`
- `OIDC_CLIENT_SECRET=family-flow-dev-secret`

Start the app with `pnpm dev:oidc`, open `http://127.0.0.1:3000/`, and sign in through Dex with:

- Email: `dev@example.invalid`
- Password: `family-flow-dev`

## Commands

- `pnpm format`: format files with Biome.
- `pnpm format:check`: check formatting.
- `pnpm lint`: run Biome linting, the architecture import check, and requirement traceability validation.
- `pnpm arch:check`: verify core import boundaries and reject unsafe or non-presentational Nunjucks constructs.
- `pnpm requirements:check`: validate the schema, identifiers, cross-references, statuses, mappings, adapter boundaries, and exact package-script allowlist in `traceability.json`. Markdown is documentation, not validator input.
- `pnpm evidence:check`: compare test IDs owned by completed phases with tests collected by Vitest and Playwright.
- `pnpm test`: run unit and integration tests; PostgreSQL tests still require `TEST_DATABASE_URL` when this general command is used.
- `pnpm test:postgres`: provision a disposable PostgreSQL 17 service on a dynamic loopback port, run Vitest sequentially with a runner-owned `TEST_DATABASE_URL`, relay sanitized failed-Vitest output, preserve SIGINT/SIGTERM exit status, and always remove its Compose project and volumes.
- `pnpm ops:verify --id OPS-FF-...`: invoke only a verifier explicitly registered in `scripts/operations/registry.ts`. Unregistered IDs fail without interpreting Markdown or arbitrary shell commands.
- `pnpm verify`: run every canonical local gate. Run this once before the final commit and before pushing; add conditional PostgreSQL, Docker, migration, or smoke gates when the changed boundary requires them.
- `pnpm test:e2e`: run E2E tests.
- `pnpm build`: compile TypeScript and recursively copy runtime CSS plus all Nunjucks layouts, pages, and fragments into `dist`.
- `pnpm db:migrate`: run pending SQL migrations against `DATABASE_URL` during local development.
- `node dist/app/session-cleanup.js --limit 1000`: delete one bounded batch of expired/revoked sessions.
- `node dist/app/session-invalidate.js`: revoke all sessions after restoring a backup, before reopening traffic.
- `pnpm dev:oidc`: run the local app with `.env.dev` for the Dex development OIDC flow.

All server-rendered route families use named `@fastify/view` boundaries with globally autoescaped Nunjucks templates. Prepared HTTP view models supply display-ready values; templates contain presentation only.

## Versioning

Pre-release versions use `0.x.y` SemVer-style versions. Each versioned state has:

- A `package.json` version.
- A `CHANGELOG.md` entry.
- A Git tag named `vMAJOR.MINOR.PATCH`, for example `v0.1.0`.

## Docker

Build the image with `docker compose build`.

Start the app and PostgreSQL with `docker compose up`.

The app applies SQL migrations from `drizzle/` and seeds initial accounts and categories during startup. Transactions, including explicit internal-transfer classification for manual and CSV-imported expenses, income plans, monthly income overrides, and CSV import profiles are stored in PostgreSQL. Transactions are available at `/transactions`, income planning is available at `/income`, and CSV imports are available at `/imports/csv` after login.

The app protects all non-health app routes. Production Compose defaults to `AUTH_MODE=oidc` and requires Authentik OIDC settings. Sessions are opaque eight-hour bearer tokens backed by PostgreSQL; Redis and `SESSION_SECRET` are not used.

The runtime image starts with `node dist/app/server.js`. It includes the compiled application and packaged `dist/views` templates, but it does not include pnpm or install packages at container startup.

Deployment to the target server is documented in `OPERATIONS.md`. Production deployment uses `compose.prod.yaml` with a prebuilt `APP_IMAGE`. The production server does not run `docker compose build`, does not install npm packages, and does not need pnpm.
