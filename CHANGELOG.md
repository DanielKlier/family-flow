# Changelog

All notable changes to FamilyFlow are documented in this file.

FamilyFlow uses SemVer-style `0.x` versions before the first stable release. Tags use the `vMAJOR.MINOR.PATCH` format.

## [0.8.2] - 2026-08-12

### Added

- Add recurring monthly income planning with month-specific overrides.
- Add editable owner-context labels across master data, transactions, imports, categorization rules, and income planning.
- Add executable requirement, test-evidence, and operations verification tooling.

### Changed

- Replace signed session cookies with opaque eight-hour bearer tokens backed by PostgreSQL.
- Add bounded session cleanup and mandatory restored-session invalidation procedures.
- Remove the `SESSION_SECRET` configuration requirement; existing signed cookies are intentionally invalidated during deployment.

## [0.8.1] - 2026-08-01

### Fixed

- Pin the transitive `esbuild` dependency used by `drizzle-kit` tooling to a patched version.

## [0.8.0] - 2026-08-01

### Added

- Add categorization rule management with account restrictions, matching modes, fixed-cost flags, and automatic application to imports and existing transactions.
- Add master data management for accounts and categories, including active/inactive state handling.
- Add repository, migration, unit, integration, and E2E coverage for categorization rules and master data changes.
- Add a release skill for repeatable release preparation.

### Changed

- Improve transaction, import, and categorization rule actions and navigation.
- Document categorization rule and master data operations, troubleshooting, and phase progress.

## [0.7.0] - 2026-07-30

### Added

- Add CSV import profiles for reusable custom column mappings without bank-specific defaults.
- Add CSV upload preview, Latin1 decoding, category matching, duplicate marking, and import confirmation for expense rows.
- Add CSV import navigation links and E2E coverage for profile reuse, duplicate handling, and user-visible import errors.

### Fixed

- Add additive migrations for existing import profile tables and remove obsolete non-custom import profile rows.

### Changed

- Document CSV import operations, troubleshooting, and stored import profile data.

## [0.6.0] - 2026-07-29

### Added

- Add a shared stylesheet and shell layout for server-rendered pages.
- Serve local HTMX assets and progressively enhance transaction create, delete, and filter interactions.
- Add E2E coverage for stylesheet delivery, no inline styles, HTMX partial updates, and no-JavaScript fallback behavior.
- Document static asset delivery and HTMX debugging in the operations manual.

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
