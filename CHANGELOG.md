# Changelog

All notable changes to FamilyFlow are documented in this file.

FamilyFlow uses SemVer-style `0.x` versions before the first stable release. Tags use the `vMAJOR.MINOR.PATCH` format.

## [0.5.0] - 2026-07-29

### Added

- Add Dex as a lightweight local OIDC provider for development with a dedicated `.env.dev` file and `pnpm dev:oidc` command.
- Add manual transaction creation, editing, deletion, and filtering by month, account, owner context, category, and status.
- Add transaction core validation, repository port, in-memory and Drizzle repository adapters, and PostgreSQL migration.
- Document manual transaction maintenance and local OIDC development workflows.

## [0.4.2] - 2026-07-28

### Fixed

- Use OIDC provider discovery metadata instead of deriving Authentik endpoint URLs locally.

## [0.4.1] - 2026-07-28

### Fixed

- Use Authentik OAuth endpoints for authorization, token exchange, and userinfo requests.

## [0.4.0] - 2026-07-28

### Added

- Add protected-route authentication with signed session cookies.
- Add Authentik OIDC configuration validation and login/logout redirects.
- Add local `AUTH_MODE=test` login flow for E2E tests without an Authentik instance.
- Include authenticated user context in request logs.

## [0.3.0] - 2026-07-28

### Added

- Add account and category core entities with repository ports.
- Add Drizzle/PostgreSQL schema, migrations, repository adapters, and idempotent master-data seeds.
- Add `/admin/master-data` to verify seeded accounts and categories.
- Add development and production Compose variants for host-based PostgreSQL development and prebuilt production images.
- Document migration, seed, and production runtime behavior.

## [0.2.1] - 2026-07-26

### Fixed

- Networks for Docker compose.yml

### Added

- document target server deployment

## [0.2.0] - 2026-07-26

### Added

- Add request IDs for all HTTP responses via `X-Request-Id`.
- Add exactly one human-readable stdout request log entry per HTTP request.
- Add sanitized query logging with secret-like query values redacted.

## [0.1.0] - 2026-07-26

### Added

- Bootstrap Node.js, TypeScript, Fastify, pnpm, Vitest, Playwright, Biome, Docker Compose, and PostgreSQL project baseline.
- Add `/health` endpoint, configuration validation, README, and initial operations manual.
