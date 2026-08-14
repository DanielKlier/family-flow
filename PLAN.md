# FamilyFlow MVP Plan

## Document Purpose And Requirement Governance

This document is the product and architecture source of truth for the FamilyFlow MVP.

Stable identifiers use these formats:

- Requirement: `FF-<AREA>-NNN`.
- Acceptance criterion: `<requirement-id>-ACNN`.
- Phase: `PH-NN` with immutable lettered phases such as `PH-10A`; remediation of a historical phase uses `<phase-id>-RNN`, such as `PH-08-R01`.
- Test evidence: `<TYPE>-<requirement-id>-NN`, where `TYPE` is `E2E`, `UNIT`, `INT`, or `SMOKE`.
- Operations evidence: `OPS-<requirement-id>-NN`.

Identifiers are never renumbered or reused. Reordering or rewording does not change an identifier. Removed requirements remain as tombstones with a rationale. A material behavior change receives a new identifier and marks the old requirement as superseded. Every active requirement has testable acceptance criteria and maps to delivery and verification work in `TASKS.md`.

`traceability.json` is the machine-readable source of truth for requirements, acceptance criteria, phases, test evidence, adapter boundaries, and operations evidence. A typed validator checks its schema, identifiers, cross-references, statuses, mappings, boundaries, and the exact package-script allowlist. Human-readable Markdown explains intent but is not parsed as a programming language. Completed test evidence is checked against tests collected by Vitest and Playwright rather than custom TypeScript control-flow analysis. Executable operations are exposed only through the static registry in `scripts/operations/registry.ts`; Markdown and arbitrary shell commands are never dispatched.

Post-MVP ideas receive no requirement identifier until they are promoted into committed scope.

## Product Vision

FamilyFlow is a local web application for household and family financial planning. It runs in the local network at `https://finances.home.arpa`, is deployed with Docker Compose, and uses Authentik as its OIDC provider.

The MVP enables two family members to:

- Track and categorize expenses across multiple bank accounts.
- Maintain planned recurring and exceptional income.
- Estimate total monthly expenses.
- Compare expenses over completed calendar months.
- Plan parental-leave, parental-benefit, part-time, childcare, and daycare scenarios over 18 to 24 months.
- Operate the application locally in a transparent, testable, secure, and recoverable way.

## Users, Authorization, And Owner Contexts

Two authenticated users have equal access to all application data. The MVP has no role-based separation between them.

Accounts use stable reporting owner keys:

- `person_a`
- `person_b`
- `shared`

Their display names are editable. Owner contexts are used only for filtering and reporting. They are never derived from the authenticated user and never grant or restrict access.

## MVP Scope And Explicit Non-Goals

### Committed Scope

- Account, category, and owner-label maintenance.
- Manual booked and planned expenses.
- Profile-based CSV expense import.
- Categorization rules.
- Recurring planned income and monthly overrides.
- Explicit internal-transfer classification.
- German user interface and German human-form input.
- Dashboard, historical averages, and monthly forecast.
- Family-finance scenarios and links to external calculators.
- Local deployment, migrations, backup, restore, request logging, and troubleshooting.
- Host-local OIDC development through the committed Dex configuration.
- Prebuilt-image production deployment, versioned releases, updates, and rollback.

### Non-Goals

- FinTS, HBCI, Open Banking, or another automatic bank connection.
- Internal tax, gross-to-net salary, parental-benefit, or legal calculations.
- Automatic internal-transfer pair matching.
- Complex roles, multitenancy, or owner-based authorization.
- A native mobile application or separate client-side application.
- A central logging sink in the MVP, although the logging port must allow one later.

## Architecture And Technology Decisions

### Technology Stack

- Runtime: Node.js with TypeScript.
- Web framework: Fastify.
- UI: server-rendered Nunjucks templates through `@fastify/view`, enhanced with HTMX.
- Persistence: PostgreSQL through Drizzle ORM.
- Authentication: Authentik OIDC and opaque server-side PostgreSQL sessions.
- Deployment: Docker Compose behind an existing Caddy reverse proxy.
- Formatting and linting: Biome.
- Tests: Vitest for unit and integration tests; Playwright for E2E tests.

### Ports And Adapters

The core contains all business rules and remains fully testable without Fastify, Drizzle, PostgreSQL, Nunjucks, HTMX, OIDC, Docker, process environment access, or filesystem assumptions.

Ports define required repositories, clocks, authentication context, logging, and technical boundaries. Adapters implement HTTP, PostgreSQL, OIDC, CSV, logging, localization, and template behavior. HTTP routes orchestrate use cases but contain no business rules. Database adapters map records to and from core models. Multi-write persistence operations use explicit transactions.

Target structure:

```text
src/
  core/
    accounts/
    categories/
    transactions/
    imports/
    income/
    forecasting/
    scenarios/
    shared/
  ports/
    repositories/
    auth/
    logging/
    clock/
  adapters/
    db/
    http/
    oidc/
    logging/
    csv/
    localization/
    templates/
  app/
    config.ts
    server.ts
  views/
    layouts/
    pages/
    partials/
```

### Template Boundary

Nunjucks is the only server-side template engine. It is integrated through `@fastify/view`, with automatic escaping enabled globally and never disabled by individual templates.

HTTP and template adapters prepare typed, presentation-ready view models. View models contain translated labels and messages, formatted money and dates, links, and simple display flags. Templates are limited to presentation, simple conditions, and list rendering. They never parse input, format values, calculate financial results, select business outcomes, access repositories, or call use cases.

User-controlled content remains an ordinary escaped value. Pre-rendered or explicitly safe HTML requires a narrow reviewed adapter boundary and must never contain user-controlled content.

Phase 10B completed the migration of dashboard and authentication, master data, categorization rules, CSV import, income, and transactions behind named asynchronous rendering methods. Shared layouts, page templates, and HTMX fragments are packaged recursively, and the legacy TypeScript string renderers have been removed.

### Localization Boundary

Core values are locale-neutral. Money uses integer minor units. Dates and months use canonical domain representations. Business failures use typed error codes and structured details rather than translated text.

German translations, `de-DE` display formatting, and parsing of human-entered amounts and dates belong to HTTP, template, or localization adapters. CSV encoding, delimiter, decimal, date, and bank-profile interpretation belong to the CSV adapter. Adapters convert accepted input to canonical values before calling the core.

### Persistence And Transaction Boundaries

PostgreSQL is the only durable store. Database adapters own SQL, Drizzle mappings, constraints, and transaction handling. Session revocation and CSV confirmation require database-backed correctness and cannot be proven only with in-memory repositories.

## Cross-Cutting Security And Observability Requirements

### Authentication And Sessions

#### FF-AUTH-001 — Protected Application Routes

The public route inventory is limited to `/health`, `/auth/login`, `/auth/callback`, the test-login route only when `AUTH_MODE=test`, and `/assets/*`. Every other route, including logout, is protected. Authentication is registered before protected routes.

Logout is a `POST /auth/logout` operation. It accepts only an authenticated session and an `Origin` header whose normalized origin exactly equals the configured `BASE_URL` origin; missing, opaque, or mismatched origins fail without revocation.

- **FF-AUTH-001-AC01:** Unauthenticated requests to `/`, `/admin/master-data`, `/transactions`, `/income`, `/imports/csv`, `/categorization-rules`, and `/auth/logout` redirect to login; each newly introduced application route is added to this finite protected-route contract before its phase completes.
- **FF-AUTH-001-AC02:** `/health`, `/auth/login`, `/auth/callback`, and `/assets/*` remain public; the test-login route exists only in test mode.
- **FF-AUTH-001-AC03:** GET logout is unavailable; authenticated same-origin POST logout succeeds; missing/mismatched Origin and unauthenticated POST do not revoke a session.

#### FF-AUTH-002 — Authentik OIDC Login

OIDC login uses the configured Authentik issuer and callback URL `https://finances.home.arpa/auth/callback`. Discovery metadata must report an issuer exactly equal to the configured issuer. `sub`, `name`, and `email` are mandatory non-empty claims with no fallback claims.

State and nonce use a server-side, single-use OIDC transaction with a controlled-clock lifetime of ten minutes. The browser receives only opaque random correlation values. Callback consumption is atomic.

- **FF-AUTH-002-AC01:** Exact discovery issuer, unexpired single-use state, valid code, and an ID token with valid signature, issuer, audience, expiry, and matching nonce plus non-empty `sub`, `name`, and `email` create a local session.
- **FF-AUTH-002-AC02:** Issuer mismatch, missing or reused state/nonce, expiry at ten minutes, invalid code, wrong callback, or missing required claim returns a request-correlated authentication error, creates no session, and logs no protocol secret.
- **FF-AUTH-002-AC03:** Production configuration rejects `AUTH_MODE=test` and does not register the test-login route.

#### FF-AUTH-003 — Opaque Session Token

The session cookie contains only a cryptographically random 256-bit bearer token. PostgreSQL stores only its SHA-256 hash with session metadata and never stores the raw token.

- **FF-AUTH-003-AC01:** Database rows contain session ID, token hash, user context, creation time, expiry time, and optional revocation time.
- **FF-AUTH-003-AC02:** Neither persistence nor logs contain the raw bearer token.

#### FF-AUTH-004 — Session Lifetime

Sessions have an eight-hour absolute lifetime evaluated through a controlled clock.

- **FF-AUTH-004-AC01:** Active sessions work before expiry.
- **FF-AUTH-004-AC02:** Unknown, expired, and revoked sessions fail at and after their boundaries.

#### FF-AUTH-005 — Effective Logout

Logout revokes the database session before expiring the browser cookie.

- **FF-AUTH-005-AC01:** A copied token replayed after logout cannot access a protected route.

#### FF-AUTH-006 — Session Cleanup

An authentication cleanup use case removes at most 1,000 expired or revoked sessions per invocation. It runs once during startup and through an explicit production-image maintenance command. PostgreSQL deletion and token cryptography remain adapter concerns. Authentication correctness never depends on cleanup already having run.

- **FF-AUTH-006-AC01:** One invocation deletes at most 1,000 eligible rows in deterministic expiry/session-ID order and preserves active rows.
- **FF-AUTH-006-AC02:** Startup invokes one bounded batch; the documented maintenance command can be repeated until it reports zero deleted rows.

#### FF-AUTH-007 — Cookie Security

Session cookies are `HttpOnly`, `SameSite=Lax`, use `Path=/`, and are `Secure` whenever `BASE_URL` uses HTTPS.

- **FF-AUTH-007-AC01:** HTTP adapter integration tests verify `HttpOnly`, `SameSite=Lax`, `Path=/`, eight-hour expiry alignment, and conditional `Secure`.

#### FF-AUTH-008 — User Context Independence

Authenticated user context comes from validated OIDC claims and is independent of account-owner display names.

- **FF-AUTH-008-AC01:** Editing an owner label never changes authentication, authorization, or logged user identity.

#### FF-AUTH-009 — Session Migration And Restore

Existing signed cookies are not migrated. Restored session records are invalidated before traffic resumes. Redis or another session service is not part of the architecture.

- **FF-AUTH-009-AC01:** Deploying the opaque-session migration intentionally logs users out.
- **FF-AUTH-009-AC02:** A token captured before backup is rejected after restore and the documented invalidation step.

### Request IDs And Request Logging

#### FF-OBS-001 — Request ID Responses

A valid caller-provided canonical UUID in `X-Request-Id` is propagated unchanged. A missing, repeated, or non-UUID value is replaced with a generated UUIDv4. The selected value is used consistently in the response and request log.

- **FF-OBS-001-AC01:** Success, redirect, 404, validation, authentication, and unexpected-exception responses contain the propagated or generated UUID.
- **FF-OBS-001-AC02:** Rendered 404, validation, authentication, and unexpected-error pages display the same request ID as the response header and log.

#### FF-OBS-002 — Exactly One Request Log

Every HTTP request produces exactly one structured request-log entry.

- **FF-OBS-002-AC01:** Success, redirect, 404, validation, authentication, and exception paths each produce one and only one entry.

#### FF-OBS-003 — Required Log Context

Request logs contain timestamp, request ID, method, path, sanitized query keys and non-sensitive values, status code, duration, stable authenticated user ID when available, outcome, and error type plus sanitized message on failures.

- **FF-OBS-003-AC01:** Success, redirect, 404, validation, authentication, and exception logs match the final response status, request ID, user context, and outcome.

#### FF-OBS-004 — Secret And Data Minimization

The denylist for every log field and serialized error contains cookies, authorization headers, raw session values, session hashes, OIDC tokens, authorization codes, state, nonce, passwords, client secrets, session secrets, complete CSV bodies, transaction descriptions, payees, purposes, notes, and amounts. The allowlisted financial context is limited to stable record IDs and aggregate counts needed for diagnosis.

- **FF-OBS-004-AC01:** Query, header, body, validation, and exception fixtures prove denylist removal and allowlist-only financial context.

#### FF-OBS-005 — Logging Adapter Boundary

stdout logs are human-readable while the logging port remains compatible with a richer JSON adapter.

- **FF-OBS-005-AC01:** The current adapter emits one readable line per request without coupling the core to a log format.

## Functional Requirements

### Scope And Platform

#### FF-SCP-001 — Local Deployment

FamilyFlow runs at the configured reverse-proxy base URL.

- **FF-SCP-001-AC01:** Docker Compose starts the application and PostgreSQL, and `/health` becomes ready.
- **FF-SCP-001-AC02:** Generated links and OIDC redirects honor `BASE_URL`.

#### FF-SCP-002 — End-To-End MVP Capabilities

The MVP supports master data, transactions, CSV import, categorization rules, income planning, internal transfers, German localization, dashboard forecasting, and 18-to-24-month scenarios.

- **FF-SCP-002-AC01:** The authenticated routes `/admin/master-data`, `/transactions`, `/imports/csv`, `/categorization-rules`, `/income`, `/`, `/scenarios`, and `/calculators` each have requirement-linked E2E evidence when their owning phase is complete.

#### FF-SCP-003 — Equal Users And Reporting Owners

Both authenticated users can maintain all data; owner contexts affect reporting only.

- **FF-SCP-003-AC01:** Changing OIDC identity never changes stored owner assignment or access rights.

#### FF-SCP-004 — Enforced Non-Goals

Excluded capabilities remain absent or uncommitted backlog ideas.

- **FF-SCP-004-AC01:** Runtime dependencies, routes, migrations, and active modules contain no bank API, internal legal calculator, role hierarchy, multitenancy, native mobile app, or central logging sink.

#### FF-DEV-001 — Local Dex OIDC Development

The committed `.env.dev` and `compose.dev.yaml` provide host-local application development against Dex without changing production Authentik behavior.

- **FF-DEV-001-AC01:** `docker compose --env-file .env.dev -f compose.yaml -f compose.dev.yaml up -d postgres dex` plus `pnpm dev:oidc` supports documented deterministic developer login.
- **FF-DEV-001-AC02:** With `NODE_ENV=production`, startup rejects `AUTH_MODE=test`, a non-HTTPS `OIDC_ISSUER_URL`, issuer `http://127.0.0.1:5556/dex`, client ID `family-flow-dev`, client secret `family-flow-dev-secret`, or the committed development session placeholder. `compose.prod.yaml` supplies none of these development defaults.

### Architecture Requirements

#### FF-ARC-001 — Adapter-Independent Core

Business rules reside in an adapter-independent core behind ports.

- **FF-ARC-001-AC01:** Architecture checks reject adapter, framework, process-environment, and deployment imports from core modules.

#### FF-ARC-002 — Technical Adapters

HTTP, PostgreSQL, OIDC, CSV, logging, localization, and templates are adapters.

- **FF-ARC-002-AC01:** HTTP request mapping, every Drizzle repository, OIDC discovery/callback, CSV parsing, request logging, localization parsing/formatting, and Nunjucks rendering each have mandatory integration tests for successful mapping plus their explicitly listed validation, rollback, concurrency, or redaction failures.

#### FF-ARC-003 — Nunjucks Rendering

Nunjucks through `@fastify/view` is the sole template integration with global automatic escaping.

- **FF-ARC-003-AC01:** User-controlled markup renders as text in pages and fragments.

#### FF-ARC-004 — Prepared View Models

Templates receive typed presentation-ready view models only.

- **FF-ARC-004-AC01:** Static template checks tokenize Nunjucks before rejecting remaining user-facing literals in text nodes and display attributes, including literals at any position among expressions or controls. Display attributes include accessible text, placeholders, titles, alternative text, and HTMX confirmation or prompt text. The checks also reject disabled escaping, `safe`, parsing/formatting helpers, financial arithmetic, repository or use-case access, and imports or calls outside approved presentation helpers.

#### FF-ARC-005 — Declared Stack

The implementation uses Node.js 24, TypeScript, Fastify, PostgreSQL, Drizzle, Nunjucks, HTMX, Biome, Vitest, Playwright, pnpm 11, and Docker Compose without a separate client application.

- **FF-ARC-005-AC01:** `package.json`, lockfile, architecture checks, build output, and production image use only this declared application stack and required transitive dependencies.

#### FF-ARC-006 — Exact Canonical Values

Money uses integer minor units and calendar values use canonical dates and months. Arithmetic must remain within safe integer bounds.

- **FF-ARC-006-AC01:** Fractional cents, invalid calendar values, unsafe amounts, and overflowing totals are rejected.
- **FF-ARC-006-AC02:** Floating-point arithmetic is not used for stored or calculated money.

#### FF-ARC-007 — Typed Errors And Technical Parsing

Business failures use typed core errors. Technical request validation and human-format parsing belong to adapters.

- **FF-ARC-007-AC01:** Adapters map typed errors to translated messages without parsing core error strings.

### Master Data

#### FF-MDM-001 — Stable Editable Owner Labels

Stable owner keys are `person_a`, `person_b`, and `shared`; their display names are editable.

- **FF-MDM-001-AC01:** Updated labels appear in account, transaction, and income views without changing stored keys or authorization.
- **FF-MDM-001-AC02:** Dashboard and scenario reporting introduced later uses the same updated labels without deriving them from OIDC users.

#### FF-MDM-002 — Idempotent Initial Data

A fresh database receives these stable defaults exactly once:

- Accounts: `account-person-a-checking` / `Girokonto Person A`, `account-person-b-checking` / `Girokonto Person B`, and `account-shared-checking` / `Gemeinsames Girokonto`.
- Categories: `category-housing-rent` / `Wohnen/Miete`, `category-groceries` / `Lebensmittel`, `category-drugstore` / `Drogerie`, `category-insurance` / `Versicherungen`, `category-mobility` / `Mobilität`, `category-health` / `Gesundheit`, `category-child-baby` / `Kind/Baby`, `category-subscriptions` / `Abos`, `category-leisure` / `Freizeit`, `category-vacation` / `Urlaub`, `category-clothing` / `Kleidung`, and `category-other` / `Sonstiges`.

- **FF-MDM-002-AC01:** Repeated startup creates no duplicate and changes no existing name or active state.
- **FF-MDM-002-AC02:** German literals apply only when creating missing defaults; upgrades never rename user-maintained rows automatically.

#### FF-MDM-003 — Account Maintenance

Authenticated users can create, edit, deactivate, and reactivate accounts.

- **FF-MDM-003-AC01:** Inactive accounts remain on historical transactions and disappear from new-entry choices.

#### FF-MDM-004 — Category Maintenance

Authenticated users can create, edit, deactivate, and reactivate categories.

- **FF-MDM-004-AC01:** Inactive categories remain on historical transactions and disappear from new-entry choices.

#### FF-MDM-005 — Preserve User Changes

Seeding preserves user edits and activation state.

- **FF-MDM-005-AC01:** Restart never resets edited labels or reactivates records.

### Transactions And Internal Transfers

#### FF-TXN-001 — Transaction Data

The final transaction model persists account, date, negative minor-unit amount, description, optional payee, optional imported purpose, category, category origin (`manual`, `csv_mapped`, `rule`, `fallback`, or `legacy_preserved`), source (`csv` or `manual`), status (`booked` or `planned`), fixed-cost flag, note, optional import hash, and internal-transfer classification.

- **FF-TXN-001-AC01:** After `PH-10C`, repository round trips preserve account, date, amount, description, payee, purpose, category, source, status, fixed-cost flag, note, and import identity.
- **FF-TXN-001-AC02:** Core transaction amounts are negative safe integers; zero, positive persisted values, fractional minor units, and unsafe values are rejected.
- **FF-TXN-001-AC03:** After `PH-11`, repository round trips additionally preserve internal-transfer classification.
- **FF-TXN-001-AC04:** After `PH-07-R01`, repository round trips preserve category origin and migration assigns deterministic non-destructive historical origins.

#### FF-TXN-002 — Manual Expense Maintenance

Users enter and view expenses as positive human amounts. The HTTP adapter converts accepted input once to a negative minor-unit core amount. Users can create booked or planned expenses and edit or delete transactions.

- **FF-TXN-002-AC01:** Full-page and HTMX flows convert the same positive human amount to the same negative canonical value exactly once.
- **FF-TXN-002-AC02:** Zero, negative human input, fractional cents, malformed dates, nonexistent Gregorian dates, and unsafe amounts fail visibly without mutation.

#### FF-TXN-003 — Transaction Filters

Transaction lists filter by month, account, owner context, category, status, and fixed-cost state.

- **FF-TXN-003-AC01:** Each filter works alone; combinations cover month+account, owner+category, and status+fixed-cost state, with nonmatching rows excluded.

#### FF-TXN-004 — Imported Transaction Maintenance

CSV-imported expenses remain visible and editable while retaining source, duplicate identity, and imported purpose.

- **FF-TXN-004-AC01:** Editing description, payee, category, status, fixed-cost state, note, or transfer state never changes source, imported purpose, or import hash.

#### FF-TXN-005 — Explicit Internal Transfers

Users can mark and unmark manual and imported transactions as internal transfers. Automatic pair matching is outside MVP scope.

- **FF-TXN-005-AC01:** Internal transfers remain visible and clearly identified in transaction lists.

#### FF-TXN-006 — Transfer Exclusion

Internal transfers never contribute to expenses, balance, historical averages, or forecasts.

- **FF-TXN-006-AC01:** Either one marked leg or both marked legs contribute zero to the reusable core expense aggregate while remaining listed.
- **FF-TXN-006-AC02:** Dashboard totals, balance, historical averages, and forecast components remain unchanged when marked transfer fixtures are added.

### CSV Import

#### FF-CSV-001 — Profile-Based Import Flow

Users can select an account, create or select a profile, configure finite source-format options, map columns, preview, and confirm.

Profile options are limited to:

- Delimiter: comma, semicolon, or tab.
- Encoding: UTF-8 or Latin1.
- Date format: `DD.MM.YY`, `DD.MM.YYYY`, or `YYYY-MM-DD`; `DD.MM.YY` maps to `20YY-MM-DD`.
- Decimal format: comma decimal with optional dot grouping, or dot decimal with optional comma grouping.

- **FF-CSV-001-AC01:** Two profiles with different finite options persist, reload, and import deterministic fixtures identically.
- **FF-CSV-001-AC02:** Unsupported or historically persisted unknown options abort validation or migration with profile IDs and remediation instructions.

#### FF-CSV-002 — CSV Field Mapping

Profiles map required date, amount, and description columns and optional payee, purpose, and category columns. Imported purpose is persisted as its own nullable transaction field.

- **FF-CSV-002-AC01:** Purpose round-trips through preview, confirmation, persistence, editing, and later categorization-rule reapplication without being merged into description.

#### FF-CSV-003 — CSV Source Formats

The CSV adapter supports exactly the profile options listed by `FF-CSV-001`, RFC-style quoted fields for the selected delimiter, and Gregorian date validation.

- **FF-CSV-003-AC01:** Every supported encoding, delimiter, date, and decimal option produces the expected locale-neutral canonical row without using human-form parsers.
- **FF-CSV-003-AC02:** `31.12.26` maps to `2026-12-31`; invalid leap dates and malformed grouping are row-level errors.

#### FF-CSV-004 — Deterministic Row Outcomes

Preview classifies each structurally readable data row as importable, ignored, invalid, or duplicate. Positive and zero bank amounts are ignored because the MVP imports expenses only. Invalid or missing required mapped cells, dates, amounts, or descriptions are row-level invalid outcomes. Invalid rows are never confirmable.

- **FF-CSV-004-AC01:** One mixed file displays deterministic importable, positive/zero ignored, invalid, and duplicate outcomes without persisting transactions. Persisting the server-authoritative preview batch required by `FF-CSV-008` is permitted and mandatory.
- **FF-CSV-004-AC02:** Server-side confirmation rejects a request containing an invalid row, even if browser data is tampered with.

#### FF-CSV-005 — Duplicate Identity (Superseded)

This historical requirement introduced account, canonical date, minor-unit amount, normalized description, and normalized payee as the v1/v2 duplicate identity. `FF-CSV-012` supersedes it because omitting imported purpose collapsed otherwise distinct transactions. Existing v1 and v2 values remain immutable compatibility records.

- **FF-CSV-005-AC01:** Duplicate rows are identified across historical v1 and new v2 records and imported at most once. Superseded by `FF-CSV-012-AC02`.
- **FF-CSV-005-AC02:** Tuple boundary changes, Unicode-equivalent text, and delimiter characters cannot create an unintended v2 identity collision. Superseded by `FF-CSV-012-AC01`.

#### FF-CSV-006 — Upload Limits

The complete multipart body limit is 6 MiB, the extracted CSV file limit is 5 MiB, and the data-row limit is 10,000 rows. Limits are inclusive, and rows are counted before ignored or invalid rows are filtered.

- **FF-CSV-006-AC01:** Exact multipart, extracted-file, and row limits are accepted; one byte or one row above is rejected before preview or persistence.

#### FF-CSV-007 — Content Validation

Filename and MIME type are advisory. Multipart overflow, extracted-file overflow, binary or NUL content, malformed selected encoding, malformed quoting, inconsistent column structure, missing mapped headers, and unsupported profile options are whole-file failures before preview. Invalid mapped cell values remain row-level outcomes under `FF-CSV-004`.

- **FF-CSV-007-AC01:** Every listed whole-file failure produces no preview rows and persists nothing.
- **FF-CSV-007-AC02:** Invalid dates, amounts, descriptions, or other required mapped cells appear as invalid preview rows rather than aborting an otherwise structurally valid file.

#### FF-CSV-008 — Trusted Confirmation Boundary

Preview persists a server-side import batch in PostgreSQL with a cryptographically random opaque batch ID, authenticated user ID, account ID, immutable profile-option snapshot, canonical row outcomes, creation time, and a controlled-clock expiry of 30 minutes. The browser receives only the opaque batch ID and presentation data.

A core import-confirmation use case atomically consumes one unexpired, unused batch and persists only its server-stored eligible nonduplicate rows behind a transactional persistence port. Reuse, expiry, user/account mismatch, or any invalid row rejects the complete confirmation. Browser-supplied amounts, text, outcomes, or hashes are never confirmation authority.

- **FF-CSV-008-AC01:** Tampering with displayed values or submitting another user/account's batch cannot change persisted rows or bypass validation and duplicate detection.
- **FF-CSV-008-AC02:** A batch is single-use, expires exactly 30 minutes after creation, and is consumed atomically with transaction persistence.

#### FF-CSV-009 — Atomic Concurrent Confirmation

Confirmation is atomic, idempotent, and concurrency-safe.

- **FF-CSV-009-AC01:** Failure on any accepted row rolls back every row in that confirmation.
- **FF-CSV-009-AC02:** Repeated or concurrent confirmation creates each canonical transaction at most once.

#### FF-CSV-010 — Non-Destructive Uniqueness

Import-hash uniqueness is enforced at account scope without rewriting historical v1 hashes or automatically changing or deleting financial records. Migration classifies unprefixed 64-hex values as v1, validates v2 syntax, and checks same-version collisions before adding the constraint.

- **FF-CSV-010-AC01:** Every non-null hash must be either exactly 64 lowercase hexadecimal characters (v1) or `v2:` plus exactly 64 lowercase hexadecimal characters. Any other value, same-version collision, or malformed v2 value aborts migration before mutation and reports account ID, import hash, and transaction IDs with a remediation-runbook reference.
- **FF-CSV-010-AC02:** After migration, historical v1 values remain byte-identical; new rows store v2; lookup recognizes both versions; account-scoped uniqueness prevents same-version concurrent duplicates.

#### FF-CSV-011 — Safe CSV Failures

CSV failures are user-readable and request-correlated. Logs contain profile/account/row-count identifiers and error codes but no CSV bytes, description, payee, purpose, note, or amount.

- **FF-CSV-011-AC01:** Rejection includes `X-Request-Id`, produces one sanitized request log, and persists nothing.

#### FF-CSV-012 — Purpose-Aware Duplicate Identity

Duplicate identity consists of account, canonical date, minor-unit amount, normalized description, normalized payee, and normalized imported purpose. Text normalization applies Unicode NFKC, trims leading/trailing whitespace, collapses internal whitespace to one ASCII space, and applies `toLocaleLowerCase("de-DE")`; null and blank purpose are equivalent.

New hashes use `v3:<sha256>` over all six unambiguous UTF-8 length-framed fields. Historical unprefixed v1 and prefixed v2 hashes remain byte-identical. A historical candidate suppresses a current row only when the persisted transaction purpose has the same normalized value, because v1/v2 hashes do not encode purpose. New persistence stores v3 only.

Migration validates exact lowercase v1/v2/v3 grammar and account-scoped hash uniqueness before changing anything. It never rewrites transaction hashes or financial records and invalidates only unconsumed preview batches whose stored hashes were produced under the previous identity version.

- **FF-CSV-012-AC01:** Purpose-distinct otherwise identical rows are independently previewed and persisted; equivalent normalized purposes and repeated rows deduplicate to one v3 identity.
- **FF-CSV-012-AC02:** Historical v1/v2 candidates suppress only rows whose normalized purpose matches the persisted transaction purpose, while same-v3 concurrent confirmation remains account-scoped and unique.
- **FF-CSV-012-AC03:** Migration accepts exact v1/v2/v3 hashes, aborts transactionally on malformed values or collisions with identifiers and runbook guidance, preserves all transaction hashes, and deletes only unconsumed previews after successful validation.

### Categorization Rules

#### FF-CAT-001 — Rule Matching Inputs

Rules use Unicode NFKC, trim and collapse whitespace to one ASCII space, and `toLocaleLowerCase("de-DE")` for search text and candidate fields. A rule matches when its non-empty normalized search text is a substring of normalized description, payee, or persisted imported purpose. It may be restricted by exact account ID.

- **FF-CAT-001-AC01:** Description, payee, and purpose each have positive and negative cases, with and without a matching account restriction.

#### FF-CAT-002 — Rule Actions

Rules assign a category and may set fixed-cost state. Import preview records category origin. Reapplication preserves categories with origin `manual`, `csv_mapped`, or `legacy_preserved` but may still apply fixed-cost actions. It recalculates category for `rule` and `fallback` origins using the current deterministic rule set.

- **FF-CAT-002-AC01:** A newly imported transaction produces the same rule/fallback category and fixed-cost decision during preview and later reapplication; protected category origins retain category while accepting matching fixed-cost action.

#### FF-CAT-003 — Deterministic Priority

Lower numeric priority wins. Equal priorities are ordered by canonical rule ID using ascending ASCII lexicographic comparison. In-memory and PostgreSQL adapters provide the same candidate set and ordering inputs.

- **FF-CAT-003-AC01:** Overlapping rules with equal and unequal priorities choose the same rule in core, in-memory, and PostgreSQL-backed tests.

#### FF-CAT-004 — Category Precedence

Category names must be unique after NFKC/trim/collapse/`de-DE` lowercase normalization; create/edit rejects collisions and migration aborts with category IDs if historical collisions exist. A mapped CSV category uses that normalization. One normalized-equal category precedes rule category assignment, then `category-other` (`Sonstiges`) applies. A matching rule may still apply its fixed-cost action.

- **FF-CAT-004-AC01:** E2E coverage verifies `csv_mapped`, `rule`, and `fallback` origins, normalized mapped category, rule category, `Sonstiges`, and fixed-cost interaction.
- **FF-CAT-004-AC02:** Core, HTTP, and PostgreSQL boundaries reject duplicate normalized category names; migration diagnostics identify historical collisions without mutation.

#### FF-CAT-005 — Rule Maintenance And Reapplication

Authenticated users can list, create, edit, and delete rules and explicitly reapply the current ordered rule set to existing transactions.

- **FF-CAT-005-AC01:** Full-page and HTMX-compatible management flows persist create, edit, and delete operations with friendly validation.
- **FF-CAT-005-AC02:** Reapplication processes all persisted booked and planned transactions once, in stable transaction-ID order, applies the origin policy from `FF-CAT-002`, and reports changed and unchanged counts without changing unmatched records.
- **FF-CAT-005-AC03:** Migration marks existing manual transactions `manual` and existing CSV transactions `legacy_preserved`; it never guesses historical mapped/rule/fallback provenance or overwrites their categories.

### Income Planning

#### FF-INC-001 — Recurring Income

Users can create and edit recurring income with name, positive minor-unit amount, owner context, inclusive start month, optional inclusive end month, and active state.

- **FF-INC-001-AC01:** Create and edit round-trip every field through core, HTTP, in-memory, and PostgreSQL boundaries.
- **FF-INC-001-AC02:** Invalid Gregorian months, end-before-start, zero/negative amounts, fractional cents, and unsafe amounts fail without mutation.

#### FF-INC-002 — Monthly Override

A monthly override replaces rather than adds to the recurring amount and may be zero.

- **FF-INC-002-AC01:** Before, start, end, and after-range months and zero overrides calculate correctly.

#### FF-INC-003 — Income Views

Income views filter by owner and calculation month and show individual plans and total planned income.

- **FF-INC-003-AC01:** Each owner context produces exact expected totals.

#### FF-INC-004 — Controlled Month

Month-dependent defaults and calculations use a controlled clock.

- **FF-INC-004-AC01:** Default calculation month and boundary tests are independent of host date and timezone.

#### FF-INC-005 — Income Activation

Users can deactivate and reactivate income plans without deleting plans or overrides. Inactive plans remain maintainable and historically visible but contribute zero to current calculations.

- **FF-INC-005-AC01:** Deactivation excludes the plan from totals while preserving fields and overrides; reactivation restores calculation under the original range and override rules.

### Dashboard And Forecasting

#### FF-DASH-001 — Monthly Summary

The selected month must not be later than the controlled current month. It shows a non-negative magnitude for booked, non-transfer expenses in that month, non-negative planned income, and balance. Planned expense transactions do not contribute to actual expenses. Aggregation converts each negative persisted expense to its absolute magnitude exactly once.

- **FF-DASH-001-AC01:** Balance equals planned income minus the non-negative booked-expense magnitude; displayed expense totals never expose the persisted negative sign.

#### FF-DASH-002 — Expense Breakdowns

The dashboard shows expense totals by category and by account and owner context.

- **FF-DASH-002-AC01:** Group totals reconcile exactly with the filtered total.

#### FF-DASH-003 — Dashboard Filters

Filters support month, explicit owner context, one account, and category. Month constrains both expenses and income. Explicit owner constrains expenses through account owner and constrains income through income-plan owner. Account and category constrain expense totals, breakdowns, averages, and forecast only; they do not constrain income. Balance always subtracts the resulting filtered expense magnitude from income constrained only by month and explicit owner. Account and explicit owner filters intersect when both are present.

- **FF-DASH-003-AC01:** Each filter works alone; combinations cover month+account, owner+category, month+owner+category, and owner+account, with exact income, expense, balance, breakdown, average, and forecast expectations for full-page and HTMX requests.

#### FF-DASH-004 — Historical Averages

The dashboard shows three-, six-, and twelve-month expense averages over completed calendar months immediately preceding the selected dashboard month, including zero-expense months and excluding planned transactions and internal transfers. Future dashboard months are rejected under `FF-DASH-001`.

Average is `sum(nonNegativeMonthlyExpenseMagnitudes) / windowLength`, using safe integer intermediates and one half-up rounding to a minor unit after division. The same average service supplies scenario snapshots.

- **FF-DASH-004-AC01:** Controlled fixtures verify each selected-month anchor, window, filter, zero month, status exclusion, transfer exclusion, overflow rejection, and below-half/exact-half/above-half rounding.

#### FF-FOR-001 — Forecast Components

Forecast is available only when the selected dashboard month equals the controlled clock's current month. Earlier months show actuals without a forecast. Future dashboard months are rejected under `FF-DASH-001`.

For the current month, components are mutually exclusive:

- Booked fixed: `status=booked`, fixed-cost flag set, not an internal transfer.
- Open planned/fixed: `status=planned`, fixed-cost flag set, date in the current month, not an internal transfer.
- Booked variable: `status=booked`, fixed-cost flag not set, not an internal transfer.

Final forecast total is `bookedFixedMagnitude + openPlannedFixedMagnitude + extrapolatedBookedVariableMagnitude`.

- **FF-FOR-001-AC01:** Each qualifying transaction belongs to exactly one component; the total equals the stated equation; non-current selected months contain no forecast result.

#### FF-FOR-002 — Variable Extrapolation

Variable extrapolation is `absoluteBookedVariable / elapsedDays * daysInMonth`, using integer intermediates and one half-up rounding to a minor unit. For non-negative values, a remainder exactly one-half rounds upward. Overflow is rejected.

- **FF-FOR-002-AC01:** Below-half, exact-half, and above-half cases plus day 1, month end, zero spend, and 28-, 29-, 30-, and 31-day months produce exact expected minor units.

#### FF-FOR-003 — Forecast Clock

A controlled local-calendar clock determines the current month, `elapsedDays` as the inclusive one-based day of month, and Gregorian month length. Host timezone never changes a fixture.

- **FF-FOR-003-AC01:** Day 1 has one elapsed day; leap day and month-end fixtures remain timezone-independent.

#### FF-FOR-004 — Planned And Booked Separation

Planned and booked expenses are displayed separately. A planned transaction becomes booked by changing the status of the same transaction ID. Automatic replacement matching and creation of a second booked record are outside MVP scope.

- **FF-FOR-004-AC01:** Transitioning one transaction ID from planned to booked moves its amount from the open-planned component to the booked component and never counts it twice.

### Scenarios And Calculators

#### FF-SCN-001 — Scenario Definition

A scenario has editable name, inclusive start and end months, starting buffer, manually supplied base monthly income, and either a three-, six-, or twelve-month expense average or a manual expense baseline. Duration is 18 to 24 months inclusive.

A historical average uses all qualifying expenses in the selected number of completed calendar months immediately preceding the controlled current month, includes zero-expense months, excludes internal transfers, and is snapshotted as a minor-unit baseline at creation. Later source-data or clock changes do not recalculate it.

- **FF-SCN-001-AC01:** Valid 18- and 24-month boundaries succeed; out-of-range or reversed periods fail.
- **FF-SCN-001-AC02:** Persisted historical baseline remains unchanged after source transactions, owner labels, categories, or the clock change. Editing name, dates, starting buffer, or base income also preserves it. Explicitly changing baseline mode, window, or manual value recomputes or replaces the snapshot at save time and stores the new value.

#### FF-SCN-002 — Scenario Adjustments

Adjustments are typed as income or expense and contain a signed minor-unit delta over one month or an inclusive month range. In each month, all matching deltas of the same type add in stable adjustment-ID order; mathematical addition determines the result regardless of order.

- **FF-SCN-002-AC01:** Adjustment ranges outside the scenario range are rejected. Valid start/end boundaries and overlapping positive and negative income/expense deltas produce exact expected totals.
- **FF-SCN-002-AC02:** Shrinking a scenario range is rejected while any existing adjustment would fall outside it; no adjustment is silently clipped or deleted.

#### FF-SCN-003 — Family Planning Inputs

Adjustments can represent parental leave, parental benefit, part-time net income, child benefit, child costs, and daycare costs without calculating tax or statutory benefit amounts.

- **FF-SCN-003-AC01:** Every input can be represented with manually supplied minor-unit values.

#### FF-SCN-004 — Scenario Results

For each month:

- `income = baseIncome + sum(incomeDeltas)`
- `expense = snapshottedOrManualBaseline + sum(expenseDeltas)`
- `balance = income - expense`
- `buffer = previousBuffer + balance`, beginning with the starting buffer
- `fundingGap = max(0, -balance)`

Lowest buffer is the minimum of the starting buffer and every month-end buffer. Required additional net income is the maximum monthly funding gap.

- **FF-SCN-004-AC01:** Exact fixtures verify income, expense, balance, month-end buffer, lowest buffer, and funding gap for every month.
- **FF-SCN-004-AC02:** Required additional net income equals the largest monthly funding gap, or zero when none exists.

#### FF-SCN-005 — Exact Scenario Arithmetic

Scenario base income and expense baselines are non-negative minor-unit magnitudes. Adjustment deltas may be positive or negative but may not produce a negative monthly income or expense. Arithmetic supports zero and negative buffers and rejects unsafe intermediate or final values.

- **FF-SCN-005-AC01:** Zero, one-cent, negative-buffer, positive/negative delta, overlap, invalid negative monthly magnitude, and safe-limit fixtures are covered.

#### FF-SCN-006 — External Calculators

The authenticated help page links to:

- `https://familienportal.de/familienportal/rechner-antraege/elterngeldrechner`
- `https://www.bmf-steuerrechner.de`

- **FF-SCN-006-AC01:** Both exact HTTPS links are present in authenticated navigation.

### Localization And UI

#### FF-LOC-001 — German User Interface

Navigation, authentication pages, dashboard, master data, transactions, CSV import, categorization rules, income, internal transfers, scenarios, calculators, form labels, help, validation, empty states, and error pages are German once their owning phase is complete.

- **FF-LOC-001-AC01:** Authentication, master data, transactions, CSV import, categorization rules, income, and internal-transfer surfaces contain their expected German headings and no known English source literals.
- **FF-LOC-001-AC02:** Dashboard and forecast surfaces introduced in `PH-13` meet the same German-text policy.
- **FF-LOC-001-AC03:** Scenario and calculator surfaces introduced in `PH-14` meet the same German-text policy.

The finite localization inventory is:

| Surface | Required message groups |
|---|---|
| `/auth/login` and authentication errors | heading, login action, callback/session errors, request-ID help |
| `/admin/master-data` and account/category edit fragments | navigation, headings, field labels, active states, actions, validation, empty states |
| `/transactions` and list/form/edit fragments | navigation, headings, fields, filters, statuses, transfer state, actions, validation, empty states |
| `/imports/csv` and preview/error fragments | profile options, mappings, row outcomes, actions, limits, validation, empty states |
| `/categorization-rules` and edit/list fragments | fields, priority, account restriction, actions, reapplication result, validation, empty states |
| `/income` and form/list fragments | fields, owner/month filters, active states, overrides, totals, actions, validation, empty states |
| `/` dashboard and fragments | filters, metrics, breakdowns, averages, forecast components, validation, empty states |
| `/scenarios` and scenario fragments | fields, adjustments, results, actions, validation, empty states |
| `/calculators` | headings, explanatory text, link labels |
| Rendered 400, 401, 404, and 500 pages | German title/message and request-ID help |

Allowed untranslated user-facing tokens are limited to `FamilyFlow`, `Authentik`, `CSV`, `OIDC`, `HTMX`, canonical IDs, documented input-format examples, and external proper names/URLs. Catalog completeness tests enumerate every message key used by prepared view models; rendered-surface tests cover every row above.

#### FF-LOC-002 — German Human Input

Human-form grammar is finite:

- Amount magnitude: ASCII digits without grouping, or one group of one to three digits followed by dot-separated groups of exactly three digits; optional comma plus one or two decimal digits; no sign, spaces, currency symbol, exponent, or dot decimal. Expense transactions and recurring income require a value greater than zero. Income overrides and scenario base income/expense allow zero. Scenario adjustments use a separate required `increase`/`decrease` direction control plus a magnitude greater than zero; adapters create the signed core delta.
- Date: exactly `DD.MM.YYYY`, validated as a Gregorian date.
- Month: exactly `MM.YYYY`, with month `01` through `12`.

Adapters convert these values to positive minor-unit input, `YYYY-MM-DD`, and `YYYY-MM` before invoking core use cases.

- **FF-LOC-002-AC01:** `1234`, `1234,5`, `1.234,56`, `31.12.2026`, `02.2026`, and valid leap dates succeed with exact canonical values.
- **FF-LOC-002-AC02:** Signs in amount text, spaces, currency symbols, malformed grouping, dot decimals, excess precision, unsafe amounts, invalid dates, and invalid months fail without mutation. Zero succeeds only for income overrides and scenario base values and fails for expenses, recurring income, and adjustment magnitudes.

#### FF-LOC-003 — Adapter-Owned Formatting

Money and dates are formatted by localization adapters into prepared view models.

- **FF-LOC-003-AC01:** Core and templates contain no locale-sensitive formatting.

#### FF-LOC-004 — Independent CSV Formats

CSV profile parsing remains independent from human-form localization.

- **FF-LOC-004-AC01:** Changing human-form parsing cannot change a CSV profile result.

#### FF-UI-001 — Progressive Enhancement

Transaction create/edit/delete, account and category create/edit/deactivate/reactivate, categorization-rule create/edit/delete/reapply, income create/edit/deactivate/reactivate, internal-transfer mark/unmark, and scenario create/edit flows work without JavaScript. HTMX requests for transaction, income, dashboard, and scenario interactions return compatible fragments.

- **FF-UI-001-AC01:** Transaction, master-data, rule, and income operations have no-JavaScript full-page assertions plus HTMX fragment assertions where those routes expose HTMX.
- **FF-UI-001-AC02:** Internal-transfer mark/unmark introduced in `PH-11` works without JavaScript and through its declared HTMX contract.
- **FF-UI-001-AC03:** Dashboard filters in `PH-13` and scenario operations in `PH-14` have full-page and declared HTMX parity.

#### FF-UI-002 — Shared Styling

Application HTML uses shared external styles and contains no inline style attributes.

- **FF-UI-002-AC01:** Every application page loads the stylesheet with the correct content type.

#### FF-UI-003 — Escaped User Content

User-controlled account, category, transaction, rule, income, and error text remains escaped in pages, fragments, and validation messages.

- **FF-UI-003-AC01:** `<script>`, event-handler attributes, and HTML-bearing account, category, transaction, rule, income, and error fixtures render as text and never execute.

## Financial And Date Semantics

- Money is represented as integer minor units. Persisted expense transactions are negative; human expense forms and scenario income/expense magnitudes are positive.
- Adapters perform sign conversion exactly once at their input boundary.
- Floating-point arithmetic is prohibited for financial calculations.
- Operations reject fractional minor units, unsafe integers, and overflow.
- Calendar dates use Gregorian rules and canonical `YYYY-MM-DD` values at core boundaries.
- Months use canonical `YYYY-MM` values.
- Calendar ranges are inclusive.
- Controlled clocks determine current dates and months; tests never depend on host time or timezone.
- Historical averages use preceding completed calendar months and include zero-expense months.
- Internal transfers contribute zero expense.
- Forecast division rounds once to the nearest minor unit.
- Planned and booked costs are never counted twice.
- Scenario range adjustments add deterministically when they overlap.

## Operations And Deployment Requirements

#### FF-OPS-001 — Complete Operations Manual

`OPERATIONS.md` contains named runbooks for development, deployment, update, rollback, migrations, backup, restore, debugging, OIDC, CSV, logs, session cleanup, template packaging, master data, transactions, rules, income, transfers, dashboard interpretation, and scenarios.

- **FF-OPS-001-AC01:** Every named runbook states prerequisites, exact command or procedure, fixture or precondition, expected result, failure diagnosis, and rollback or recovery.

#### FF-OPS-002 — Complete Backup

Backup covers all PostgreSQL financial and configuration data, including security-sensitive session records.

- **FF-OPS-002-AC01:** A test backup restores without losing or silently altering financial records.

#### FF-OPS-003 — Safe Restore

Restore invalidates sessions before reopening traffic and documents verification and rollback.

- **FF-OPS-003-AC01:** A pre-backup session token fails after the restore smoke test.

#### FF-DEP-001 — Production Image

The production image contains compiled code, migrations, templates, static assets, and maintenance entry points and starts without pnpm or runtime package installation.

- **FF-DEP-001-AC01:** Image build and startup smoke tests resolve each runtime artifact and execute the session-cleanup entry point in dry-run or empty-result mode.

#### FF-DEP-002 — Compose Startup And Migrations

Docker Compose starts the application and PostgreSQL, applies migrations before accepting application traffic, and exposes useful healthchecks.

- **FF-DEP-002-AC01:** Empty-database and update smoke tests become ready without manual intervention.

#### FF-DEP-003 — Reverse Proxy Base URL

Operation behind Caddy at `https://finances.home.arpa` honors `BASE_URL`.

- **FF-DEP-003-AC01:** Links, secure cookies, callback URLs, and OIDC redirects use the external URL.

#### FF-DEP-004 — Environment-Only Secrets

Secrets are supplied only through environment variables, and production example files contain placeholders.

- **FF-DEP-004-AC01:** Repository secret scanning and log fixtures contain no production credentials, tokens, cookies, authorization codes, or session values.

#### FF-DEP-005 — Prebuilt Production Image

Production deployment uses `compose.prod.yaml` with a required prebuilt `APP_IMAGE` pinned by OCI digest (`registry/repository@sha256:<digest>`). The target server never builds the image, installs packages, or requires pnpm.

- **FF-DEP-005-AC01:** Deployment pulls and starts the digest-pinned image with build disabled and no package installation; inspecting the running image reports the configured digest.

#### FF-REL-001 — Versioned Release Artifact

Starting with the first release created after adoption of `FF-REL-001`, every release updates `package.json`, adds a `CHANGELOG.md` entry, and builds a Linux/amd64 image labeled with version and Git revision. The authoritative digest is the top-level registry descriptor digest in the canonical `Name` output of `docker buildx imagetools inspect <versioned-image-ref>`. The annotated `vMAJOR.MINOR.PATCH` Git tag message records it as one `image-digest: sha256:<digest>` line. Historical lightweight tags remain immutable historical evidence and are not rewritten.

- **FF-REL-001-AC01:** For each new release, package version, changelog heading, annotated Git tag, Linux/amd64 image version/revision labels, and the registry-inspected digest agree before deployment.

#### FF-REL-002 — Update And Rollback

Before deploying release B, the target creates an immutable deployment record for B containing deployment ID/time, B digest, previous running digest A, pre-B backup identifier/path/checksum, schema version before B, schema version after B, and the tested direct-rollback compatibility decision. Compatibility belongs to B's deployment record because B introduces the schema transition.

Rollback from B uses only that record. When direct rollback is compatible, start recorded digest A against the current database. When incompatible, stop traffic, restore the recorded pre-B backup, verify its checksum/schema/data, and start recorded digest A. Never restore A's older historical pre-A backup for a B rollback.

- **FF-REL-002-AC01:** A smoke procedure updates from digest A to B and follows B's deployment record to roll back directly when compatible or restore B's pre-deployment backup before A when incompatible; health, migration state, and data reconciliation are verified.
- **FF-REL-002-AC02:** Deployment records are append-only, reference existing digest/backup artifacts, and their backup checksum plus before/after schema versions are verified before traffic opens.

## Verification And Quality Requirements

#### FF-QUA-001 — Tests First

Behavior changes begin with an observed failing E2E test, followed by failing core unit tests for each changed business rule and integration tests for each changed adapter boundary. Behavior-preserving refactors begin with green characterization and a failing architecture or adapter integration test. Evidence-only work is expected green; an observed failure converts it into behavior remediation before production changes.

- **FF-QUA-001-AC01:** `TASKS.md` classifies each pending item as behavior, refactor, or evidence work and records linked test IDs plus expected red or expected-green evidence before production changes.

#### FF-QUA-002 — Core Coverage

Core rules have unit tests, including explicit financial and date boundaries and controlled clocks.

- **FF-QUA-002-AC01:** No business-rule acceptance depends only on adapter or E2E tests.

#### FF-QUA-003 — Adapter Coverage

HTTP, OIDC, CSV, logging, template, and database adapters have realistic integration coverage.

- **FF-QUA-003-AC01:** Adapter tests cover successful mapping and every validation, error, rollback, redaction, and concurrency path named by the owning active acceptance criteria.

#### FF-QUA-004 — Canonical Quality Gates

Every phase passes:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`

When a PostgreSQL adapter or migration changes, non-skippable `pnpm test:postgres` provisions an isolated PostgreSQL service and passes. When Docker or image packaging changes, `pnpm docker:build` also passes using the non-secret Compose interpolation values from `.env.example`. When deployment behavior changes, a Docker Compose smoke test also passes.

- **FF-QUA-004-AC01:** No phase commit is created while a canonical or applicable conditional gate is failing or skipped.

## Glossary

- **Booked expense:** An expense that has occurred.
- **Planned expense:** A future or expected expense not yet booked.
- **Internal transfer:** A user-classified movement between family-owned accounts that remains visible but contributes zero expense.
- **Owner context:** A stable reporting key unrelated to authentication.
- **Canonical row:** Locale-neutral validated import data passed from the CSV adapter to the import core.
- **Minor unit:** One cent for EUR values.
- **Controlled clock:** An injected source of current date or time used for deterministic behavior and tests.

## Retired Or Superseded Requirements

None. Future removals remain listed here with their original stable IDs and rationale.
