# FamilyFlow Operations Manual

This manual describes how to operate the local FamilyFlow deployment. Phase 0 only covers the bootstrap application and PostgreSQL container.

## Deployment

1. Copy `.env.example` to `.env` and adjust values for the target host.
2. Build containers with `docker compose build`.
3. Start services with `docker compose up -d`.
4. Verify the app with `curl http://127.0.0.1:3000/health`.

## Updates

1. Pull the latest repository state.
2. Run `pnpm install` when dependencies changed.
3. Run `pnpm format:check`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`.
4. Rebuild and restart containers with `docker compose build` and `docker compose up -d`.

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

## OIDC/Auth Problems

OIDC authentication is not implemented in Phase 0. Future authentication issues will be diagnosed through request IDs, callback URLs, and Authentik logs.

## CSV Import Problems

CSV import is not implemented in Phase 0. Future import issues will be diagnosed with minimized metadata and without logging full CSV files.

## Log Analysis

Structured request logging is not implemented in Phase 0. Use container logs for startup and crash diagnostics until request logging is introduced.
