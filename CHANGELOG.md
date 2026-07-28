# Changelog

All notable changes to FamilyFlow are documented in this file.

FamilyFlow uses SemVer-style `0.x` versions before the first stable release. Tags use the `vMAJOR.MINOR.PATCH` format.

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
