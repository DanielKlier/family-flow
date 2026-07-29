# FamilyFlow Operations Manual

This manual describes how to operate the local FamilyFlow deployment.

## Deployment

The reference production deployment runs a prebuilt Docker image. The production server must not install npm packages and must not build the application image.

Target server requirements:

- Git.
- Docker Engine with Docker Compose.
- Outbound access to the Git repository, Docker Hub, and the configured application image registry.
- A persistent checkout directory, for example `/opt/family-flow`.
- A local `.env` file created from `.env.example` and adjusted for the target host.

The production runtime container does not include pnpm or run package installation commands. pnpm is only used in Docker build stages outside the production server and in local development commands. Runtime migrations are executed by Node.js through the compiled server code.

Initial deployment:

1. Clone the repository into the target directory.
2. Fetch tags with `git fetch --tags`.
3. Check out the desired version tag, for example `git checkout v0.2.0`.
4. Copy `.env.example` to `.env` and adjust values for the target host.
5. Set `APP_IMAGE` in `.env` to the prebuilt image reference, for example `ghcr.io/example/family-flow:0.2.0`.
6. Pull images with `docker compose -f compose.prod.yaml pull`.
7. Start services with `docker compose -f compose.prod.yaml up -d`. The app runs pending database migrations and seeds master data during startup.
8. Verify the app with `curl http://127.0.0.1:3000/health`.
9. Verify authentication by opening `https://finances.home.arpa/` and signing in through Authentik.
10. Verify seeded master data at `https://finances.home.arpa/admin/master-data` after login.

Deployment update:

1. Fetch the latest repository state and tags with `git fetch --tags`.
2. Check out the desired version tag, for example `git checkout v0.2.0`.
3. Review `CHANGELOG.md` and `OPERATIONS.md` for required manual steps.
4. Set `APP_IMAGE` in `.env` to the new prebuilt image reference.
5. Pull images with `docker compose -f compose.prod.yaml pull`.
6. Start the updated deployment with `docker compose -f compose.prod.yaml up -d`. Startup applies any new migrations before the HTTP server starts.
7. Verify the app with `curl http://127.0.0.1:3000/health`.

Rollback:

1. Check out the previous known-good version tag, for example `git checkout v0.1.0`.
2. Set `APP_IMAGE` in `.env` to the previous known-good image reference.
3. Pull images with `docker compose -f compose.prod.yaml pull`.
4. Restart services with `docker compose -f compose.prod.yaml up -d`.
5. Verify the app with `curl http://127.0.0.1:3000/health`.

Image distribution alternatives:

- Current production default: build locally or in CI, push a versioned image to GHCR, Docker Hub, or a LAN registry, and let the target server pull images by tag.
- Local development default: use `compose.yaml` and `docker compose build` when you intentionally want to build the image on the development machine.
- A registry is required for production because the target server must not build images or install npm packages.

## Updates

Before publishing a new version tag, run `pnpm install` when dependencies changed, then run `pnpm format:check`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`, and `docker compose build` locally or in CI. Push the resulting image and deploy that immutable image reference with `compose.prod.yaml`.

When database schema changes are included, inspect the SQL files in `drizzle/` before deployment and check `docker compose logs app` after startup for migration failures.

## Versioning And Tags

Versions use SemVer-style `0.x.y` numbers before the first stable release. Every versioned state must update `package.json`, add a `CHANGELOG.md` entry, and create an annotated Git tag named `vMAJOR.MINOR.PATCH`.

Example: `git tag -a v0.1.0 -m "v0.1.0"`.

## Database Migrations

Migrations are stored as SQL files in `drizzle/` and are tracked in the `schema_migrations` table. The application runs pending migrations automatically during startup before it begins listening for HTTP traffic.

Manual migration run for local development:

1. Start PostgreSQL with `docker compose -f compose.yaml -f compose.dev.yaml up -d postgres`.
2. Ensure `DATABASE_URL` points at the target database. The development Compose override publishes PostgreSQL on `127.0.0.1:5432`; the base and production Compose files do not publish PostgreSQL to the host.
3. Run `pnpm db:migrate`.

Manual migration run with the production image:

1. Ensure the app image has already been built outside production and pulled on the production server.
2. Ensure `DATABASE_URL` points at the target database through Compose environment configuration.
3. Run `docker compose -f compose.prod.yaml run --rm app node dist/adapters/db/migrate.js`.

Do not run `pnpm` inside the production container. The production image contains the compiled migration runner and SQL files, not the development toolchain.

Migration troubleshooting:

- If startup fails before the app listens on port 3000, inspect `docker compose logs app`.
- If a migration file was partially applied outside the normal transaction flow, inspect `schema_migrations` and the affected tables before retrying.
- Never edit an already deployed migration file. Add a new migration instead.

## Authentication And Sessions

All non-health application routes are protected. `/health` remains public for local health checks. Login and logout are handled through `/auth/login`, `/auth/callback`, and `/auth/logout`.

Production uses Authentik through `AUTH_MODE=oidc` and requires these environment variables:

- `BASE_URL`: the externally visible application URL, normally `https://finances.home.arpa`.
- `SESSION_SECRET`: at least 32 random characters, used to sign local session cookies.
- `OIDC_ISSUER_URL`: the Authentik provider URL for the FamilyFlow application.
- `OIDC_CLIENT_ID`: the Authentik client ID.
- `OIDC_CLIENT_SECRET`: the Authentik client secret.

Authentik application settings:

- Redirect URI: `https://finances.home.arpa/auth/callback`.
- Post-logout redirect URI: `https://finances.home.arpa/auth/login`.
- Scopes: `openid`, `email`, and `profile`.

Local E2E tests and development without Authentik can use `AUTH_MODE=test`. In this mode `/auth/test-login` creates a signed session for the deterministic `test-user`. Do not run production with `AUTH_MODE=test`.

Local development can also use Dex as a lightweight OIDC provider instead of Authentik. Start it with `docker compose --env-file .env.dev -f compose.yaml -f compose.dev.yaml up -d dex` and run the app on the host with `pnpm dev:oidc`.

Dex development settings:

- Issuer URL: `http://127.0.0.1:5556/dex`.
- Client ID: `family-flow-dev`.
- Client secret: `family-flow-dev-secret`.
- Redirect URI: `http://127.0.0.1:3000/auth/callback`.
- Test user email: `dev@example.invalid`.
- Test user password: `family-flow-dev`.

The committed `.env.dev` file contains these local-only OIDC values. Keep production Authentik settings in `.env`, and use `.env.dev` for the Dex development flow. This local Dex setup is not intended for production and must not be exposed outside the development host.

## Seeds

The app seeds initial accounts and categories during startup after migrations. Seeds are idempotent: existing rows with the same stable ID are updated, and missing rows are inserted.

Initial accounts:

- `Person A checking` with owner context `person_a`.
- `Person B checking` with owner context `person_b`.
- `Shared checking` with owner context `shared`.

Initial categories include `Wohnen/Miete`, `Lebensmittel`, `Drogerie`, `Versicherungen`, `Mobilitaet`, `Gesundheit`, `Kind/Baby`, `Abos`, `Freizeit`, `Urlaub`, `Kleidung`, and `Sonstiges`.

## Manual Transaction Maintenance

Authenticated users can maintain manual expenses at `/transactions`.

Supported maintenance actions:

- Create booked or planned manual expenses.
- Mark planned or booked expenses as fixed costs.
- Edit account, category, date, description, payee, amount, status, fixed-cost flag, and note.
- Delete incorrectly entered manual transactions.
- Filter by month, account, owner context, category, and status.

Operational notes:

- Amounts are entered as positive expense amounts in the UI and stored as negative cents in PostgreSQL.
- Owner-context filtering is derived from the selected account, not from a separate transaction field.
- Use `/admin/master-data` to verify account and category seed data if transaction forms have missing options.
- For manual correction issues, capture the visible `X-Request-Id` and inspect the matching request log entry. Do not log or paste broad financial exports when a single minimized transaction example is enough.

## Backup 

PostgreSQL stores master data and manual transactions. A full backup runbook is still pending, but before destructive maintenance export the database with `pg_dump` from a trusted host or from the PostgreSQL container.

## Restore 

Restore is not fully automated yet. For local recovery, stop the app, restore a PostgreSQL dump into the `family_flow` database, then start the app so pending migrations and idempotent seeds can run.

## Debugging

- Use `docker compose ps` to inspect service state.
- Use `docker compose logs app` to inspect application output.
- Use `docker compose logs postgres` to inspect PostgreSQL output.
- Use `/health` to verify that the application process is reachable.
- Use `/admin/master-data` to verify that account and category seeds are visible.
- Every HTTP response contains an `X-Request-Id` header. Use this value to find the matching request log entry.
- Send `X-Request-Id` in a request to keep a caller-provided correlation ID.

## OIDC/Auth Problems

Check these items when login fails:

- Confirm `BASE_URL` exactly matches the external URL used in Authentik redirect URIs.
- Confirm `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET` match the Authentik provider.
- Confirm the browser reaches the app through HTTPS when `BASE_URL` is HTTPS, because session cookies are marked `Secure` in that case.
- Use the visible `X-Request-Id` response header to find the matching request log entry.
- Check Authentik logs for denied redirect URIs, invalid client credentials, or provider errors.

Never log OIDC tokens, session cookies, client secrets, or complete callback URLs containing secret-like query values. Query parameters such as `code`, `state`, and `token` are redacted in request logs.

## CSV Import Problems

CSV import is not implemented in Phase 0. Future import issues will be diagnosed with minimized metadata and without logging full CSV files.

## Log Analysis

Every HTTP request writes exactly one human-readable request log entry to stdout. Docker logs are the primary log source.

Request log entries include the request ID, timestamp, method, path, sanitized query values, status code, duration, user context when available, outcome, and error details when available. Authenticated requests record the stable user ID, not session cookie contents or OIDC tokens.

Query values with secret-like names such as `code`, `token`, `session`, `state`, `secret`, or `password` are redacted. Session cookies, OIDC tokens, full CSV content, and unnecessary financial details must not be logged.

Use `docker compose logs app` and search for `request_id=<value>` to correlate a user-visible request ID with the server-side log entry.
