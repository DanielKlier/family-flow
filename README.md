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
4. For local development without Authentik, set `AUTH_MODE=test` and a local `SESSION_SECRET` with at least 32 characters in `.env`.
5. Start the development server with `pnpm dev`.
6. Open `http://127.0.0.1:3000/health` to verify the app is running.
7. Open `http://127.0.0.1:3000/auth/test-login` in `AUTH_MODE=test`, then open `http://127.0.0.1:3000/admin/master-data` to verify seeded accounts and categories.
8. Open `http://127.0.0.1:3000/transactions` to create, edit, delete, and filter manual expenses.

## Local OIDC Development

The development Compose override includes Dex as a lightweight local OIDC provider. This mode is intended for running PostgreSQL and Dex in Docker while running the app on the host with `pnpm dev:oidc`.

Start local infrastructure with `docker compose --env-file .env.dev -f compose.yaml -f compose.dev.yaml up -d postgres dex`.

The local Dex flow uses the committed `.env.dev` file:

- `AUTH_MODE=oidc`
- `BASE_URL=http://127.0.0.1:3000`
- `OIDC_ISSUER_URL=http://127.0.0.1:5556/dex`
- `OIDC_CLIENT_ID=family-flow-dev`
- `OIDC_CLIENT_SECRET=family-flow-dev-secret`
- `SESSION_SECRET=replace-with-at-least-32-random-characters`

Start the app with `pnpm dev:oidc`, open `http://127.0.0.1:3000/`, and sign in through Dex with:

- Email: `dev@example.invalid`
- Password: `family-flow-dev`

## Commands

- `pnpm format`: format files with Biome.
- `pnpm format:check`: check formatting.
- `pnpm lint`: run Biome linting and the architecture import check.
- `pnpm arch:check`: verify core import boundaries.
- `pnpm test`: run unit and integration tests.
- `TEST_DATABASE_URL=postgres://... pnpm test`: include Drizzle repository integration tests against a test database.
- `pnpm test:e2e`: run E2E tests.
- `pnpm build`: compile TypeScript and copy runtime assets into `dist`.
- `pnpm db:migrate`: run pending SQL migrations against `DATABASE_URL` during local development.
- `pnpm dev:oidc`: run the local app with `.env.dev` for the Dex development OIDC flow.

## Versioning

Pre-release versions use `0.x.y` SemVer-style versions. Each versioned state has:

- A `package.json` version.
- A `CHANGELOG.md` entry.
- A Git tag named `vMAJOR.MINOR.PATCH`, for example `v0.1.0`.

## Docker

Build the image with `docker compose build`.

Start the app and PostgreSQL with `docker compose up`.

The app applies SQL migrations from `drizzle/` and seeds initial accounts and categories during startup. Manual transactions are stored in PostgreSQL and are available at `/transactions` after login.

The app protects all non-health app routes. Production Compose defaults to `AUTH_MODE=oidc` and requires Authentik OIDC settings plus `SESSION_SECRET`.

The runtime image starts with `node dist/app/server.js`. It does not include pnpm and does not install packages at container startup.

Deployment to the target server is documented in `OPERATIONS.md`. Production deployment uses `compose.prod.yaml` with a prebuilt `APP_IMAGE`. The production server does not run `docker compose build`, does not install npm packages, and does not need pnpm.
