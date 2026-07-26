# FamilyFlow Operations Manual

This manual describes how to operate the local FamilyFlow deployment.

## Deployment

The reference deployment builds Docker images on the target server from a versioned Git tag. A local Docker registry is not required for the current single-host deployment.

Target server requirements:

- Git.
- Docker Engine with Docker Compose.
- Outbound access to the Git repository, Docker Hub, and the npm/pnpm registries during builds.
- A persistent checkout directory, for example `/opt/family-flow`.
- A local `.env` file created from `.env.example` and adjusted for the target host.

Initial deployment:

1. Clone the repository into the target directory.
2. Fetch tags with `git fetch --tags`.
3. Check out the desired version tag, for example `git checkout v0.2.0`.
4. Copy `.env.example` to `.env` and adjust values for the target host.
5. Build containers with `docker compose build`.
6. Start services with `docker compose up -d`.
7. Verify the app with `curl http://127.0.0.1:3000/health`.

Deployment update:

1. Fetch the latest repository state and tags with `git fetch --tags`.
2. Check out the desired version tag, for example `git checkout v0.2.0`.
3. Review `CHANGELOG.md` and `OPERATIONS.md` for required manual steps.
4. Build containers with `docker compose build`.
5. Start the updated deployment with `docker compose up -d`.
6. Verify the app with `curl http://127.0.0.1:3000/health`.

Rollback:

1. Check out the previous known-good version tag, for example `git checkout v0.1.0`.
2. Rebuild containers with `docker compose build`.
3. Restart services with `docker compose up -d`.
4. Verify the app with `curl http://127.0.0.1:3000/health`.

Image distribution alternatives:

- Current default: build from Git on the target server. This keeps infrastructure minimal and avoids registry credentials.
- Later option: build locally or in CI, push versioned images to GHCR, Docker Hub, or a LAN registry, and let the target server pull images by tag.
- A registry becomes useful when the target server should not build images, multiple hosts need the same image, outbound dependency downloads are restricted, or CI should produce release artifacts.

## Updates

Before publishing a new version tag, run `pnpm install` when dependencies changed, then run `pnpm format:check`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`, and `docker compose build` locally.

## Versioning And Tags

Versions use SemVer-style `0.x.y` numbers before the first stable release. Every versioned state must update `package.json`, add a `CHANGELOG.md` entry, and create an annotated Git tag named `vMAJOR.MINOR.PATCH`.

Example: `git tag -a v0.1.0 -m "v0.1.0"`.

## Database Migrations

Database migrations are not implemented in Phase 0. PostgreSQL is started by Docker Compose and is reserved for later phases.

## Backup

Backups are not implemented in Phase 0. Until database schema and data flows exist, no application data is stored by FamilyFlow.

## Restore

Restore is not implemented in Phase 0. This section will be expanded when backups and migrations exist.

## Debugging

- Use `docker compose ps` to inspect service state.
- Use `docker compose logs app` to inspect application output.
- Use `docker compose logs postgres` to inspect PostgreSQL output.
- Use `/health` to verify that the application process is reachable.
- Every HTTP response contains an `X-Request-Id` header. Use this value to find the matching request log entry.
- Send `X-Request-Id` in a request to keep a caller-provided correlation ID.

## OIDC/Auth Problems

OIDC authentication is not implemented in Phase 0. Future authentication issues will be diagnosed through request IDs, callback URLs, and Authentik logs.

## CSV Import Problems

CSV import is not implemented in Phase 0. Future import issues will be diagnosed with minimized metadata and without logging full CSV files.

## Log Analysis

Every HTTP request writes exactly one human-readable request log entry to stdout. Docker logs are the primary log source.

Request log entries include the request ID, timestamp, method, path, sanitized query values, status code, duration, user context when available, outcome, and error details when available.

Query values with secret-like names such as `code`, `token`, `session`, `state`, `secret`, or `password` are redacted. Session cookies, OIDC tokens, full CSV content, and unnecessary financial details must not be logged.

Use `docker compose logs app` and search for `request_id=<value>` to correlate a user-visible request ID with the server-side log entry.
