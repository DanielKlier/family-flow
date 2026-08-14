# FamilyFlow Delivery Plan

## Purpose And Task-ID Governance

This document maps the stable requirements in `PLAN.md` to historical delivery, pending remediation, tests, operations evidence, and future phases.

Identifiers use these formats:

- Phase: `PH-NN` or immutable lettered phase `PH-NNA`, for example `PH-10A`.
- Historical gap remediation: `<phase-id>-RNN`, for example `PH-08-R01`.
- Requirement: `FF-<AREA>-NNN` from `PLAN.md`.
- Test evidence: `<TYPE>-<requirement-id>-NN`, where `TYPE` is `E2E`, `UNIT`, `INT`, or `SMOKE`.
- Operations evidence: `OPS-<requirement-id>-NN`.

Identifiers are never renumbered or reused. A completed phase remains a historical record even when later requirements expose acceptance gaps. Those gaps receive new remediation IDs instead of rewriting history.

Every pending phase must list:

- `Classification`: behavior change, behavior-preserving refactor, or evidence-only work.
- `Implements`: requirements whose production behavior changes.
- `Verifies`: requirements whose acceptance evidence is added or strengthened.
- `Operations`: runbooks or operational evidence changed by the phase.
- Unique test IDs and either an expected-red reason or explicit expected-green evidence classification.
- Required core unit and mandatory realistic adapter integration tests.
- The canonical quality gates.
- Named targeted verification with an executable command or documented procedure.
- A Conventional Commit message.

Behavior changes require observed failing E2E evidence before production changes, followed by failing core unit tests for changed business rules and integration tests for every changed adapter boundary. Behavior-preserving refactors require green characterization first and a failing architecture or integration test. Evidence-only work is expected green and must not manufacture a failure; an observed failure reclassifies the item as behavior remediation before production changes.

`traceability.json` maps every criterion to primary evidence and lists supplemental core and adapter evidence. A phase cannot complete unless its collected evidence passes. A `Gap` or `Planned` criterion is expected red before behavior implementation; a `Delivered-unverified` criterion is expected green.

## Delivery Status

`traceability.json` is the authoritative machine-readable phase, acceptance, test, and operations ledger. Human-readable phase records remain below. Update the JSON document directly; `pnpm requirements:check` validates its schema and references.

## Dependency And Execution Order

Only arrows impose ordering; independent siblings may run in parallel.

```text
PH-10D ─→ every pending phase and remediation item

PH-04-R01 ─┐
PH-08-R01 ─┤
PH-09-R01 ─┼→ PH-10B ─┬→ PH-01-R01
PH-10-R01 ─┘          ├→ PH-03-R01 ─→ PH-10A ─→ PH-02-R01
                      └→ PH-10C ─┬→ PH-06-R01
                                 ├→ PH-07-R01
                                 └→ PH-11

PH-10A + PH-10B + PH-10C ─→ PH-00-R01

all historical remediation + PH-11 ─→ PH-12
PH-09-R01 + PH-11 + PH-12 ─→ PH-13
PH-13 ─→ PH-14
all phases and remediation ─→ PH-15
```

Rules:

- `PH-11` starts only after `PH-10C`, because the transaction round-trip contract includes imported purpose before transfer classification is added. It implements transfer classification, persistence, editing, and list visibility. Dashboard and forecast verification waits for `PH-13`.
- `PH-12` localizes the finite surface inventory delivered through `PH-11`.
- `PH-13` introduces and localizes dashboard and forecast behavior.
- `PH-14` depends on `PH-13` because historical-average scenario baselines reuse completed dashboard aggregation rules.
- `PH-15` revalidates deployment, backup, restore, update, and rollback rather than introducing them for the first time.

## Global Red-Green-Refactor Workflow

For behavior changes:

1. Add the behavior-focused E2E test, record its ID and expected red reason, and observe that failure.
2. Add failing core unit tests for business rules and failing integration tests for affected adapters.
3. Implement the smallest correct production change.
4. Run targeted tests until green and refactor without changing behavior.

For behavior-preserving refactors, record green characterization first, then observe a failing architecture or adapter integration test for the missing target boundary. For evidence-only work, record expected-green evidence; if it fails, stop, reclassify the item, and begin a behavior red-green loop.

Every classification updates required documentation and ends with a small Conventional Commit after targeted checks. Prefer multiple reviewable commits during a phase; they may be combined later with interactive rebase. Run the full canonical and applicable conditional gates once before the final phase commit and again before push. Syntax, infrastructure, uncontrolled-time, or unrelated failures never establish a valid red phase.

## Canonical Quality Gates

The final phase commit and every push require:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`

Additionally:

- Run non-skippable `pnpm test:postgres`, which provisions an isolated PostgreSQL service, whenever a Drizzle adapter or migration changes. `PH-10D` adds this shared command before any later phase relies on it; `TEST_DATABASE_URL`-absent skips do not satisfy the gate.
- Run operations evidence through the shared `pnpm ops:verify --id <OPS-ID>` dispatcher added by `PH-10D`; an unknown ID, missing fixture, or skipped procedure fails.
- Run `docker compose build` when Docker, migrations, templates, image packaging, or deployment configuration changes.
- Run a readiness-based Docker Compose smoke test when deployment behavior changes.
- Run migration, backup, or restore smoke tests when the corresponding behavior changes.

## Historical Delivery Records

### PH-00 — Repository Bootstrap

**Status:** Completed
**Evidence refs:** `70207e2 chore: bootstrap node project`, `3896a23 chore: use biome and add versioning`, and `2fe08f7 docs: document target server deployment`; release baseline `v0.1.0`. Historical tags and deployment docs are evidence only and do not satisfy the post-adoption digest/annotated-tag requirements.

**Delivered outcome:** Node.js and TypeScript project, Fastify healthcheck, Biome, Vitest, Playwright, Dockerfile, Docker Compose, PostgreSQL service, environment example, architecture skeleton, README, and initial Operations Manual.

**Requirements represented:** `FF-SCP-001`, `FF-ARC-005`, `FF-DEP-001`, `FF-DEP-002`, `FF-DEP-004`, `FF-QUA-004`.

**Existing evidence:** health E2E coverage, configuration unit tests, build, and image configuration.

**Pending gap:** `PH-00-R01` adds executable readiness and reverse-proxy smoke evidence.

### PH-01 — Request Lifecycle, Logging, And Request IDs

**Status:** Completed
**Evidence refs:** `6dd3369 feat: add request logging and request ids`; release `v0.2.0`.

**Delivered outcome:** Request IDs, `X-Request-Id`, human-readable stdout logging, structured log context, and exactly one normal request log.

**Requirements represented:** `FF-OBS-001`, `FF-OBS-002`, `FF-OBS-003`, `FF-OBS-004`, `FF-OBS-005`.

**Existing evidence:** `tests/integration/request-logging.test.ts`, request-log normalization unit coverage, and E2E response-header coverage.

**Pending gap:** `PH-01-R01` covers redirects, 404s, validation, authentication, exceptions, visible error-page IDs, and comprehensive redaction.

### PH-02 — Database, Migrations, And Initial Master Data

**Status:** Completed
**Evidence refs:** `d9768de feat: add accounts and categories`; release `v0.3.0`.

**Delivered outcome:** Drizzle configuration, PostgreSQL migrations, account and category core models, repository ports and adapters, idempotent initial seeds, initial master-data pages, and migration documentation.

**Requirements represented:** `FF-ARC-001`, `FF-ARC-002`, `FF-MDM-002`, `FF-MDM-005`, `FF-DEP-002`. Full backup and restore behavior was not delivered and belongs to `PH-02-R01`.

**Existing evidence:** account/category unit tests, in-memory repository integration tests, optional PostgreSQL adapter tests, and master-data E2E coverage.

**Pending gap:** `PH-02-R01` adds mandatory real-database migration, backup, restore, and empty-database recovery evidence.

### PH-03 — OIDC Authentication And Interim Sessions

**Status:** Completed
**Evidence refs:** `c647664 feat: add oidc authentication`, `20c454a fix: use authentik oidc endpoints`, `39ba71f fix: use oidc discovery metadata`, and `0bfa3aa chore: add local oidc development provider`; releases `v0.4.0` through `v0.4.2`.

**Delivered outcome:** Authentik OIDC adapter, callback flow, local E2E authentication mode, protected-route hook, authenticated request context, login/logout, and interim signed-cookie sessions.

The current composition registers authentication before protected routes. This document records current evidence without attributing an unsupported historical correction commit.

**Requirements represented:** `FF-AUTH-001`, `FF-AUTH-002`, `FF-AUTH-007`, `FF-AUTH-008`.

**Existing evidence:** `tests/e2e/auth.test.ts`, `tests/integration/session-http.test.ts`, and OIDC unit tests.

**Pending gaps:** `PH-03-R01` adds realistic OIDC and HTTP boundary coverage. Target session requirements `FF-AUTH-003`, `FF-AUTH-004`, `FF-AUTH-005`, `FF-AUTH-006`, and `FF-AUTH-009` belong to `PH-10A`.

### PH-04 — Manual Transactions And Filters

**Status:** Completed
**Evidence refs:** `f5fff90 feat: add manual transactions`; release `v0.5.0`.

**Delivered outcome:** Transaction core and persistence, booked and planned manual expenses, editing, deletion, fixed-cost marking, and list filters.

**Requirements represented:** `FF-TXN-001`, `FF-TXN-002`, and `FF-TXN-003` partially. Imported transaction maintenance under `FF-TXN-004` begins with `PH-06`.

**Existing evidence:** transaction E2E tests, core unit tests, and repository integration tests.

**Pending gap:** `PH-04-R01` verifies every filter plus month+account, owner+category, and status+fixed-cost combinations, validation boundaries, and HTTP adapter behavior.

### PH-05 — Styling And HTMX

**Status:** Completed
**Evidence refs:** `f57513b feat: add initial styling and htmx interactions`; release `v0.6.0`.

**Delivered outcome:** Shared stylesheet, removal of inline styling, common navigation and layout, HTMX transaction updates and filters, friendly validation fragments, and no-JavaScript transaction creation.

**Requirements represented:** `FF-UI-001`, `FF-UI-002`.

**Existing evidence:** `tests/e2e/styling-and-htmx.test.ts` and static-asset integration coverage.

**Pending gap:** Nunjucks characterization, global escaping, fragment contracts, and runtime template packaging belong to `PH-10B`.

### PH-06 — Initial CSV Import

**Status:** Completed
**Evidence refs:** `9c1f3df feat: add csv transaction imports`, `a325a72 feat: complete csv import profiles`, and `0e20609 refactor: tidy csv import adapter`; release `v0.7.0`.

**Delivered outcome:** Import profiles, CSV parser port and adapter, profile persistence, upload and mapping UI, preview, canonical import hashes, duplicate marking, confirmation, and user-readable errors.

**Requirements represented:** `FF-CSV-001`, `FF-CSV-002`, `FF-CSV-003`, `FF-CSV-004`, and `FF-CSV-005` partially, plus `FF-TXN-004` partially.

**Existing evidence:** CSV import E2E tests, parser integration tests, import unit tests, and import-profile repository tests.

**Pending gaps:** `PH-06-R01` completes profile, delimiter, purpose, and mapped-field acceptance. `PH-10C` owns security limits, strict content validation, atomicity, and concurrency.

### PH-07 — Categorization Rules

**Status:** Completed
**Evidence refs:** `ff17117`, `3802b2e`, `808df3f`, `acb9615`, `e5ab8d1`, `8e6fa64`, `49e6c8e`, `bc294a8`, `798a623`, and `a32d927`, covering rule core, persistence, migration, CRUD, account restriction, CSV application, reapplication, action improvements, and fixed-cost actions.

**Delivered outcome:** Rule core, deterministic matching, account restrictions, category and fixed-cost actions, persistence, management UI, CSV application, and application to existing transactions.

**Requirements represented:** `FF-CAT-001`, `FF-CAT-002`, `FF-CAT-003`, `FF-CAT-004`, and `FF-CAT-005` partially.

**Existing evidence:** categorization E2E tests, core unit tests, repository integration tests, and migration tests.

**Pending gap:** `PH-07-R01` verifies each matching field, priority and tie behavior, account restrictions, mapped-category precedence, fallback, and fixed-cost interactions.

### PH-08 — Editable Master Data

**Status:** Completed
**Evidence refs:** `4fe799f feat: add master data management`; included in release `v0.8.0`.

**Delivered outcome:** Create, edit, deactivate, and reactivate behavior for accounts and categories while preserving historical references.

**Requirements represented:** `FF-MDM-003`, `FF-MDM-004`, `FF-MDM-005`.

**Existing evidence:** master-data E2E tests, account/category unit tests, and repository integration tests.

### PH-09 — Income Planning

**Status:** Completed
**Evidence refs:** `e74bec6 feat: add income planning`.

**Delivered outcome:** Recurring planned income, inclusive ranges, monthly overrides, owner contexts, month calculations, persistence, and HTMX forms. Active state exists in core and persistence, but the HTTP UI does not deliver deactivation/reactivation.

**Requirements represented:** `FF-INC-001`, `FF-INC-002`, and `FF-INC-003`, with partial evidence for `FF-INC-004`.

**Existing evidence:** income E2E tests, income unit tests, and repository integration tests.

**Pending gap:** `PH-09-R01` implements deactivation/reactivation, zero overrides where currently rejected, controlled-clock defaults, and any missing safe arithmetic, then verifies all range and owner boundaries.

### PH-10 — Editable Owner Display Names

**Status:** Completed
**Evidence refs:** `a5d9803 feat: add editable account owner names`.

**Delivered outcome:** Stable owner keys with editable labels used across master data, transaction filters, and income filters without coupling to OIDC users.

**Requirements represented:** `FF-MDM-001`, `FF-SCP-003`, `FF-AUTH-008`.

**Existing evidence:** owner-context E2E, unit, and repository integration tests.

## Pending Architecture And Security Remediation

### PH-10D — Requirement Traceability Enforcement

**Status:** Completed
**Classification:** Behavior change
**Implements:** traceability enforcement for `FF-QUA-001` and `FF-QUA-004`
**Verifies:** every active requirement, acceptance criterion, phase, test, and operations ID
**Operations:** none

**Red:**

- [x] Add `INT-FF-QUA-001-01` and observe failure because no executable validator checks the current documents and complete test inventory.
- [x] Add `INT-FF-QUA-004-01` and observe failure because non-skippable PostgreSQL and operations-evidence gate commands do not exist.

**Tasks:**

- [x] Add `traceability.json` as the machine-readable source of truth and validate its typed schema, identifiers, references, statuses, mappings, boundaries, and exact package-script allowlist.
- [x] Use Vitest and Playwright collection for completed test evidence instead of parsing TypeScript control flow.
- [x] Add non-skippable `pnpm test:postgres`, provisioning isolated PostgreSQL without accepting a missing-URL skip as evidence.
- [x] Dispatch operations only through the static `scripts/operations/registry.ts`; never interpret Markdown or arbitrary shell commands.
- [x] Add `pnpm requirements:check` to lint and `pnpm evidence:check` to the final `pnpm verify` gate.

**Tests:** `INT-FF-QUA-001-01`, `INT-FF-QUA-004-01`.

**Red evidence:** The focused structured-tooling test initially failed because the typed validator, runner collection adapter, static operations registry, and exact package-script validator did not exist.

**Quality gates:** `pnpm verify` plus direct `pnpm test:postgres` for the PostgreSQL runner.

**Targeted verification:** run the focused traceability-tooling and PostgreSQL-runner integration tests. Keep validator coverage to representative schema, reference, boundary, collection, registry, environment-sanitization, and exact-wiring cases rather than speculative Markdown, shell, or TypeScript grammar mutations.

**Commit:** `chore: enforce requirement traceability`

### PH-10A — Opaque PostgreSQL Sessions

**Status:** Completed
**Classification:** Behavior change
**Implements:** `FF-AUTH-003`, `FF-AUTH-004`, `FF-AUTH-005`, `FF-AUTH-006`, `FF-AUTH-009`
**Verifies:** `FF-AUTH-001`, `FF-AUTH-007`, `FF-AUTH-008`, `FF-OBS-001`, `FF-OBS-002`, `FF-OBS-003`, `FF-OBS-004`, `FF-OPS-002`, `FF-OPS-003`, `FF-QUA-003`
**Operations:** `OPS-FF-AUTH-006-01`, `OPS-FF-AUTH-009-01`

**Red:**

- [x] Add `E2E-FF-AUTH-005-01`: copy a valid session token, log out in the original context, replay the copy against `/transactions`, and expect login redirection.
- [x] Preserve the handoff's reviewed Red evidence: the prerequisite POST logout contract was absent and GET logout remained independently valid.

**Tasks:**

- [x] Define authentication use cases for lifetime, lookup outcomes, revocation, and bounded cleanup behind session-store, controlled-clock, token-generation, and token-hashing ports.
- [x] Generate a cryptographically random 256-bit bearer token.
- [x] Add a session migration and Drizzle adapter storing only SHA-256 token hashes and required metadata.
- [x] Keep the raw token only in the secure cookie.
- [x] Resolve every authenticated request through the session store.
- [x] Revoke the database session before expiring the browser cookie.
- [x] Delete at most 1,000 expired/revoked rows per invocation in expiry/session-ID order; invoke one batch at startup and expose `node dist/app/session-cleanup.js --limit 1000` in the production image.
- [x] Preserve the eight-hour absolute lifetime and cookie attributes.
- [x] Remove signed payload handling and `SESSION_SECRET`; intentionally invalidate old signed cookies.
- [x] Preserve authentication-before-protected-route composition.
- [x] Invalidate restored sessions before accepting traffic.
- [x] Update configuration, README, and Operations runbooks. Do not introduce Redis.

**Tests:**

- [x] `E2E-FF-AUTH-005-01`: copied opaque token is rejected after the original session is logged out.
- [x] `UNIT-FF-AUTH-004-01`: active, exactly expired, revoked, and unknown outcomes with a controlled clock.
- [x] `INT-FF-AUTH-003-01`: PostgreSQL stores the hash and metadata but never the raw token.
- [x] `INT-FF-AUTH-003-02`: authenticated HTTP requests resolve opaque tokens through PostgreSQL, exclude the raw bearer token from persistence and request logs, and reject unknown tokens.
- [x] `INT-FF-AUTH-004-01`: the HTTP/session boundary rejects exactly expired sessions using the controlled clock.
- [x] `INT-FF-AUTH-004-02`: session creation and lookup preserve the absolute eight-hour lifetime without sliding extension.
- [x] `INT-FF-AUTH-005-01`: logout records revocation and subsequent lookup fails.
- [x] `UNIT-FF-AUTH-006-01`: authentication cleanup use case enforces limit, ordering, eligibility, and idempotent outcomes.
- [x] `INT-FF-AUTH-006-01`: PostgreSQL cleanup removes eligible rows and preserves active rows.
- [x] `INT-FF-AUTH-006-02`: startup and maintenance entry points invoke bounded cleanup and report deterministic outcomes.
- [x] `INT-FF-AUTH-007-01`: verify every cookie attribute.
- [x] `INT-FF-OBS-001-01`: authentication failures retain request IDs and produce one sanitized request log.
- [x] `SMOKE-FF-AUTH-009-01`: deployment rejects old signed cookies.
- [x] `SMOKE-FF-AUTH-009-02`: restore invalidates pre-backup sessions.

**Quality gates:** the five canonical commands plus `docker compose build`.

**Targeted verification:** execute the documented migration/authentication Compose procedure plus `SMOKE-FF-AUTH-009-01` and `SMOKE-FF-AUTH-009-02`; run the cleanup command until it reports zero rows and verify active sessions remain.

**Commit:** `fix: migrate sessions to postgres`

### PH-10B — Nunjucks Template Boundary

**Status:** Completed
**Classification:** Behavior-preserving refactor
**Implements:** `FF-ARC-003`, `FF-ARC-004`
**Verifies:** `FF-UI-001`, `FF-UI-002`, `FF-UI-003`, `FF-DEP-001`, `FF-QUA-003`
**Operations:** `OPS-FF-ARC-003-01`, `OPS-FF-DEP-001-01`

**Red:**

- [x] Characterize transaction full-page, no-JavaScript, escaping, and HTMX behavior before refactoring.
- [x] Add `INT-FF-ARC-003-01`, expecting `@fastify/view` to render a Nunjucks template with global escaping.
- [x] Observe failure because Nunjucks integration and `.njk` templates do not exist.

**Tasks:**

- [x] Add `@fastify/view` and Nunjucks as the only template integration.
- [x] Enable automatic escaping globally and prohibit per-template disabling.
- [x] Create typed prepared view models for every route family in the HTTP adapter.
- [x] Move layouts, pages, and fragments to `src/views`.
- [x] Preserve transaction and income HTMX target contracts and progressive enhancement.
- [x] Keep formatting, links, labels, display flags, and user-facing validation in prepared view models.
- [x] Remove TypeScript string renderers after every route is migrated.
- [x] Package views in compiled output and the production image.
- [x] Update template and HTMX diagnostics in `OPERATIONS.md`.

**Tests:**

- [x] `E2E-FF-UI-001-01`: full-page and HTMX create, edit, delete, validation, and filter parity.
- [x] `E2E-FF-UI-002-01`: expected-green characterization proves primary full-page flows remain usable without JavaScript.
- [x] `E2E-FF-UI-003-01`: untrusted account, category, transaction, income, rule, and error text renders as text in globally autoescaped templates.
- [x] `INT-FF-ARC-003-01`: @fastify/view renders Nunjucks with global escaping.
- [x] `INT-FF-ARC-004-01`: Nunjucks-aware static checks reject remaining user-facing literals at any position among expressions and controls in text nodes and display attributes (including accessible text, alternative text, placeholders, titles, `hx-confirm`, and `hx-prompt`), while allowing expression-only, control-only, and whitespace-only content. They also reject disabled escaping, the Nunjucks safe filter, parser/formatter arithmetic, and repository/use-case access from templates.
- [x] `INT-FF-ARC-004-02`: named page and fragment methods expose declared view-model boundaries.
- [x] `INT-FF-DEP-001-01`: compiled application resolves packaged templates.
- [x] `SMOKE-FF-DEP-001-01`: production image packages every template family and renders representative full pages and HTMX fragments.

**Quality gates:** the five canonical commands plus `docker compose build`.

**Targeted verification:** run `SMOKE-FF-DEP-001-01` against the production image and verify one full page and one HTMX fragment resolve packaged templates.

**Commit:** `refactor: standardize nunjucks rendering`

### PH-10C — CSV Security And Atomicity

**Status:** Completed
**Evidence refs:** `8cf8702 feat: harden trusted and atomic csv imports` and `451caae fix: update loaded csv import profiles`.
**Classification:** Behavior change
**Implements:** `FF-TXN-001`, `FF-TXN-004`, `FF-CSV-001`, `FF-CSV-002`, `FF-CSV-003`, `FF-CSV-004`, `FF-CSV-005`, `FF-CSV-006`, `FF-CSV-007`, `FF-CSV-008`, `FF-CSV-009`, `FF-CSV-010`, `FF-CSV-011`
**Verifies:** `FF-CSV-005`, `FF-OBS-001`, `FF-OBS-002`, `FF-OBS-003`, `FF-OBS-004`, `FF-QUA-003`
**Operations:** `OPS-FF-CSV-006-01`, `OPS-FF-CSV-009-01`, `OPS-FF-CSV-011-01`

**Red:**

- [x] Add and independently observe `E2E-FF-CSV-001-01`, `E2E-FF-CSV-001-02`, `E2E-FF-CSV-002-01`, `E2E-FF-CSV-004-01`, `E2E-FF-CSV-004-02`, `E2E-FF-CSV-006-01`, `E2E-FF-CSV-007-01`, `E2E-FF-CSV-007-02`, `E2E-FF-CSV-008-01`, and `E2E-FF-CSV-009-01` failing because profile options/purpose, profile persistence, row preview outcomes, limits, file validation, trusted confirmation, atomicity, and database uniqueness are absent.

**Tasks:**

- [x] Add finite persisted profile options: comma/semicolon/tab delimiter, UTF-8/Latin1 encoding, three date formats, and two decimal formats.
- [x] Add nullable imported purpose to transaction core, schema, repositories, preview, confirmation, editing, and rule reapplication.
- [x] Enforce inclusive 6 MiB multipart, 5 MiB extracted-file, and 10,000-data-row limits before filtering.
- [x] Make overflow, binary/NUL, malformed encoding/quotes, inconsistent structure, missing mapped headers, and unsupported options whole-file failures.
- [x] Make invalid required mapped cells, Gregorian dates, amounts, or descriptions visible invalid-row outcomes; never confirm them.
- [x] Keep source interpretation in the CSV adapter and canonical eligibility/duplicate decisions in the core.
- [x] Persist a 30-minute, single-use server-side preview batch with opaque ID, user/account binding, immutable profile snapshot, canonical row outcomes, and controlled timestamps.
- [x] Put confirmation orchestration in a core use case behind a transactional persistence port; atomically consume the server batch and ignore browser-supplied financial values/outcomes/hashes.
- [x] Introduce v2 length-prefixed NFKC hashes while preserving byte-identical historical v1 hashes; lookup computes both versions and new rows store v2.
- [x] Persist batch consumption and accepted transactions in one PostgreSQL transaction with account-scoped same-version uniqueness and conflict-safe inserts.
- [x] Abort migration for every non-null hash outside exact lowercase v1/v2 grammar and for same-version collisions, reporting account/hash/transaction identifiers; never recompute, mutate, or delete historical hashes automatically.
- [x] Return request-correlated failures with allowlisted identifiers/counts and no CSV content.
- [x] Update profile, limit, preview, migration-abort, rollback, retry, and troubleshooting runbooks.

**Tests:**

- [x] `UNIT-FF-TXN-001-01` and `UNIT-FF-TXN-001-02`: purpose-inclusive field contract and negative persisted amount invariant.
- [x] `INT-FF-TXN-001-01`: PostgreSQL preserves the complete post-PH-10C transaction round-trip contract.
- [x] `E2E-FF-TXN-004-01`: imported transaction editing preserves source, purpose, and import hash.
- [x] `INT-FF-TXN-004-01`: PostgreSQL round-trips imported purpose and import identity.
- [x] `E2E-FF-CSV-001-01`, `E2E-FF-CSV-001-02`, and `E2E-FF-CSV-002-01`: finite profile options, persistence, reuse, and every mapped field including purpose.
- [x] `INT-FF-CSV-008-01`: HTTP preview/confirmation mapping cannot authorize tampered data.
- [x] `INT-FF-CSV-003-01`: every encoding/delimiter/date/decimal option, including 31.12.26 → 2026-12-31.
- [x] `INT-FF-CSV-003-02`: CSV structure, header mapping, and finite parser options remain adapter-owned and deterministic.
- [x] `E2E-FF-CSV-004-01`: one mixed file shows importable, ignored, invalid, and duplicate rows.
- [x] `E2E-FF-CSV-004-02`: preview exposes deterministic row-level reasons and never makes invalid rows confirmable.
- [x] `E2E-FF-CSV-007-01` and `E2E-FF-CSV-007-02`: binary, malformed encoding/quotes, inconsistent structure, missing mapped headers, and every other structural trust-boundary failure reject the whole file.
- [x] `E2E-FF-CSV-006-01`: exact three limits succeed; each boundary plus one fails.
- [x] `INT-FF-CSV-007-01`: every whole-file failure and every row-level invalid outcome.
- [x] `UNIT-FF-CSV-004-01`: core row eligibility and deterministic preview outcomes.
- [x] `E2E-FF-CSV-008-01`: invalid, expired, reused, other-user/account, or tampered batches cannot be confirmed.
- [x] `UNIT-FF-CSV-008-01`: core confirmation permits only eligible rows from one unexpired unused server batch.
- [x] `INT-FF-CSV-008-02`: PostgreSQL batch creation, expiry, and atomic consumption; HTTP opaque-ID mapping remains exclusively in `INT-FF-CSV-008-01`.
- [x] `E2E-FF-CSV-009-01`: confirmation persists every accepted row atomically or none.
- [x] `INT-FF-CSV-009-01`: a later-row failure rolls back every row.
- [x] `INT-FF-CSV-009-02`: concurrent confirmation creates no duplicate or unhandled conflict.
- [x] `INT-FF-CSV-010-01`: collision/malformed-version abort reports identifiers and leaves all records unchanged.
- [x] `INT-FF-CSV-010-02`: v1 hashes remain byte-identical, v2 rows persist, and same-version uniqueness is enforced.
- [x] `UNIT-FF-CSV-005-01`: canonical duplicate identity changes only when an identity field changes.
- [x] `UNIT-FF-CSV-005-02`: v1 compatibility, v2 length framing, Unicode normalization, delimiter safety, and dual-version lookup.
- [x] `INT-FF-CSV-011-01`: rejection persists nothing, returns a request ID, and emits one sanitized log.

**Quality gates:** the five canonical commands plus `docker compose build`.

**Targeted verification:** execute documented profile migration, collision-abort, rollback, concurrency, exact-limit, and production Compose CSV procedures with named deterministic fixtures.

**Completion evidence (2026-08-13):** `pnpm verify`, isolated `pnpm test:postgres`, `docker compose build`, and an isolated empty-volume Docker Compose startup smoke all passed. The startup smoke reached `/health`, applied all 12 migrations through `0012_csv_security_atomicity.sql`, and verified the preview-batch table and account/import-hash unique index.

**Commit:** `fix: harden csv import confirmation`

### PH-10C-R01 — Purpose-Aware CSV Duplicate Identity

**Status:** Completed
**Evidence refs:** `de928d0 fix: include purpose in csv duplicate identity`.
**Classification:** Behavior change
**Implements:** `FF-CSV-012` (supersedes `FF-CSV-005` identity composition)
**Verifies:** `FF-CSV-012`
**Operations:** CSV import migration and duplicate troubleshooting runbook

**Red:**

- [x] Observe `E2E-FF-CSV-012-01` collapse two otherwise identical purpose-distinct rows into one importable row.
- [x] Observe `UNIT-FF-CSV-012-02` produce v2 instead of purpose-aware v3 identities.
- [x] Observe `INT-FF-CSV-012-03` fail because migration `0013_csv_import_purpose_identity.sql` is absent.
- [x] Observe `INT-FF-CSV-012-04` produce v2 and lack purpose-aware persistence compatibility.

**Tasks:**

- [x] Add normalized purpose to a v3 UTF-8 length-framed identity while retaining immutable v1/v2 candidate generation.
- [x] Compare v1/v2 candidates only when the repository-loaded persisted purpose normalizes to the current purpose.
- [x] Persist purpose-distinct v3 rows independently while preserving account-scoped concurrent same-v3 protection.
- [x] Validate v1/v2/v3 grammar and collisions before mutation, preserve transaction hashes, and invalidate only unconsumed pre-v3 previews.
- [x] Update duplicate-identity and migration operations guidance.

**Tests:**

- [x] `E2E-FF-CSV-012-01`: purpose-distinct identical rows preview, persist, and retain their purposes.
- [x] `UNIT-FF-CSV-012-02`: v3 purpose identity, normalization, repeated rows, null/blank behavior, and guarded v1/v2 compatibility.
- [x] `INT-FF-CSV-012-03`: migration grammar, malformed/collision rollback, immutable hashes, and preview invalidation.
- [x] `INT-FF-CSV-012-04`: v3 persistence, same-v3 concurrency, and repository-loaded v1/v2 purpose compatibility.

**Quality gates:** the five canonical commands plus non-skippable `pnpm test:postgres` and `docker compose build` because migration/database behavior changes.

**Targeted verification:** run the four `FF-CSV-012` tests, then apply all migrations to isolated PostgreSQL and verify malformed/collision rollback and active-preview invalidation.

**Commit:** `fix: include purpose in csv duplicate identity`

## Historical Acceptance-Gap Remediation

### PH-00-R01 — Deployment And Reverse-Proxy Smoke Evidence

**Status:** Pending
**Classification:** Evidence-only; expected green after prerequisite phases
**Implements:** none
**Verifies:** `FF-SCP-001`, `FF-DEP-001`, `FF-DEP-002`, `FF-DEP-003`
**Operations:** `OPS-FF-DEP-002-01`, `OPS-FF-DEP-003-01`

- [ ] Add readiness-based Compose smoke against an empty database.
- [ ] Add update smoke with pending migrations.
- [ ] Add reverse-proxy smoke using `BASE_URL=https://finances.home.arpa` and verify links, secure cookies, and OIDC redirect URLs.
- [ ] Record commands, expected readiness, failure diagnosis, and rollback in `OPERATIONS.md`.

**Tests:** `SMOKE-FF-SCP-001-01`, `SMOKE-FF-SCP-001-02`, `SMOKE-FF-DEP-002-01`, `SMOKE-FF-DEP-003-01`.

**Quality gates:** the five canonical commands; apply the global conditional Docker and smoke gates when this phase changes migrations, runtime configuration, or deployment behavior.

**Targeted verification:** `pnpm ops:verify --id OPS-FF-DEP-002-01`, `pnpm ops:verify --id OPS-FF-DEP-003-01`.

**Commit:** `test: cover deployment smoke paths`

### PH-01-R01 — Complete Request-Lifecycle Behavior

**Status:** Pending
**Classification:** Behavior change
**Implements:** `FF-OBS-001`, `FF-OBS-003`, `FF-OBS-004`
**Verifies:** `FF-OBS-002`, `FF-OBS-005`
**Operations:** `OPS-FF-OBS-003-01`

- [ ] Add `E2E-FF-OBS-001-01`: valid canonical UUID is propagated to response and log. Expected red: UUID policy is not enforced.
- [ ] Add `E2E-FF-OBS-001-02`: missing, repeated, and malformed IDs generate UUIDv4 values across success, redirect, 404, validation, authentication, and exception paths. Expected red: malformed values are currently propagated.
- [ ] Display the same ID on finite error-page paths and assert exactly one matching log.
- [ ] Implement the explicit denylist and allowlisted aggregate-count/stable-ID policy.

**Tests:** `E2E-FF-OBS-001-01`, `E2E-FF-OBS-001-02`, `INT-FF-OBS-002-01`, `INT-FF-OBS-003-01`, `INT-FF-OBS-004-01`, `INT-FF-OBS-005-01`.

**Quality gates:** the five canonical commands; apply the global conditional Docker and smoke gates when this phase changes migrations, runtime configuration, or deployment behavior.

**Targeted verification:** `pnpm ops:verify --id OPS-FF-OBS-003-01`.

**Commit:** `fix: validate request ids and redact logs`

### PH-02-R01 — Migration, Backup, And Restore Behavior

**Status:** Pending
**Classification:** Behavior change
**Implements:** `FF-OPS-002`, `FF-OPS-003`
**Verifies:** `FF-MDM-002`, `FF-MDM-005`, `FF-OPS-002`, `FF-OPS-003`, `FF-DEP-002`
**Operations:** `OPS-FF-OPS-002-01`, `OPS-FF-OPS-003-01`

- [ ] Add `SMOKE-FF-OPS-002-01` and observe red because no executable backup/restore reconciliation procedure exists.
- [ ] Test all migrations against an empty PostgreSQL database.
- [ ] Test update from the oldest supported schema state.
- [ ] Execute backup and restore against deterministic financial fixtures.
- [ ] Verify record counts, monetary totals, references, seeds, and user edits after restore.
- [ ] Integrate restored-session invalidation after `PH-10A`.

**Tests:** `INT-FF-MDM-002-01`, `SMOKE-FF-OPS-002-01`, `SMOKE-FF-OPS-003-01`.

**Quality gates:** the five canonical commands; apply the global conditional Docker and smoke gates when this phase changes migrations, runtime configuration, or deployment behavior.

**Targeted verification:** `pnpm ops:verify --id OPS-FF-OPS-002-01`, `pnpm ops:verify --id OPS-FF-OPS-003-01`.

**Commit:** `feat: add database recovery procedures`

### PH-03-R01 — OIDC And Authentication Hardening

**Status:** Pending
**Classification:** Behavior change
**Implements:** `FF-AUTH-002`
**Verifies:** `FF-AUTH-001`, `FF-AUTH-007`, `FF-AUTH-008`, `FF-DEV-001`, `FF-DEP-004`
**Operations:** `OPS-FF-AUTH-002-01`, `OPS-FF-DEV-001-01`

- [ ] Add `E2E-FF-AUTH-002-01` and observe red because server-side ten-minute single-use state/nonce transactions do not exist.
- [ ] Protect logout, replace GET with same-origin `POST /auth/logout`, validate normalized `Origin` against `BASE_URL`, and verify failed attempts do not revoke.
- [ ] Implement exact discovery issuer comparison, ID-token signature/issuer/audience/expiry/nonce validation, and mandatory non-empty `sub`, `name`, and `email`.
- [ ] Persist opaque state/nonce transactions behind authentication ports and consume them atomically.
- [ ] Cover expiry, reuse, invalid code/callback/claims, safe return-to, request IDs, and sanitized logs.
- [ ] Preserve committed Dex development and prove production rejects test mode, non-HTTPS/Dex issuer, `family-flow-dev` credentials, and committed development session placeholders.

**Tests:** `E2E-FF-AUTH-001-01`, `E2E-FF-AUTH-001-02`, `E2E-FF-AUTH-001-03` (protected same-origin POST logout), `UNIT-FF-AUTH-002-01` (ten-minute single-use state/nonce rules), `E2E-FF-AUTH-002-01`, `INT-FF-AUTH-002-01` (valid protocol path), `INT-FF-AUTH-002-02` (callback failures plus PostgreSQL state/nonce persistence and atomic consumption), `INT-FF-AUTH-002-03` (production configuration rejection), and `INT-FF-DEV-001-01`.

**Quality gates:** the five canonical commands; apply the global conditional Docker and smoke gates when this phase changes migrations, runtime configuration, or deployment behavior.

**Targeted verification:** `pnpm ops:verify --id OPS-FF-AUTH-002-01`, `pnpm ops:verify --id OPS-FF-DEV-001-01`.

**Commit:** `fix: harden oidc boundaries`

### PH-04-R01 — Complete Transaction Boundaries

**Status:** Pending
**Classification:** Behavior change
**Implements:** `FF-TXN-001`, `FF-TXN-002`, `FF-TXN-003`, `FF-ARC-006`
**Verifies:** `FF-TXN-001`, `FF-TXN-002`, `FF-TXN-003`, `FF-ARC-006`, `FF-UI-001`
**Operations:** `OPS-FF-TXN-002-01`

- [ ] Add `E2E-FF-TXN-002-02` and observe red for nonexistent Gregorian dates, negative human input, and unsafe amounts before production validation changes.
- [ ] Cover every filter individually plus month+account, owner+category, and status+fixed-cost combinations.
- [ ] Cover invalid dates, invalid amounts, fractional cents, unsafe values, missing references, and friendly error rendering.
- [ ] Add mandatory HTTP integration tests for parsing, use-case orchestration, redirects, and fragments plus mandatory PostgreSQL repository round-trip/filter tests.
**Tests:** `E2E-FF-TXN-002-01`, `E2E-FF-TXN-002-02`, `E2E-FF-TXN-003-01`, `UNIT-FF-ARC-006-01`, `UNIT-FF-ARC-006-02`, `INT-FF-TXN-002-01` (HTTP), and `INT-FF-TXN-003-01` (PostgreSQL baseline round trip and filters).

**Quality gates:** the five canonical commands; apply the global conditional Docker and smoke gates when this phase changes migrations, runtime configuration, or deployment behavior.

**Targeted verification:** `pnpm ops:verify --id OPS-FF-TXN-002-01`.

**Commit:** `fix: enforce transaction boundaries`

### PH-06-R01 — Complete CSV Profile Acceptance Evidence

**Status:** Pending
**Classification:** Evidence-only after `PH-10C`; expected green
**Implements:** none
**Verifies:** `FF-CSV-001`, `FF-CSV-002`, `FF-CSV-003`, `FF-CSV-004`, `FF-CSV-005`
**Operations:** `OPS-FF-CSV-001-01`

- [ ] Cover two distinct saved profiles and profile reuse.
- [ ] Cover delimiter, encoding, date, decimal, description, payee, purpose, and category mapping.
- [ ] Verify documented `DD.MM.YY → 20YY-MM-DD` profile behavior.
- [ ] Verify importable, ignored, invalid, and duplicate row outcomes.
- [ ] Verify duplicate identity changes when normalized payee changes.
- [ ] Add mandatory PostgreSQL integration for profile options, mapping, and round-trip behavior.

**Tests:** `INT-FF-CSV-002-01` (CSV parsing/mapping) and `INT-FF-CSV-002-02` (PostgreSQL). The acceptance-primary E2E and duplicate-identity evidence is owned and completed by prerequisite PH-10C; this phase adds only the expected-green adapter evidence assigned to it.

**Quality gates:** the five canonical commands; apply the global conditional Docker and smoke gates when this phase changes migrations, runtime configuration, or deployment behavior.

**Targeted verification:** `pnpm ops:verify --id OPS-FF-CSV-001-01`.

**Commit:** `test: complete csv profile coverage`

### PH-07-R01 — Complete Categorization Behavior

**Status:** Pending
**Classification:** Behavior change
**Implements:** `FF-CAT-001`, `FF-CAT-003`, `FF-CAT-004`, `FF-CAT-005`
**Verifies:** `FF-CAT-002`
**Operations:** `OPS-FF-CAT-002-01`

- [ ] Add `E2E-FF-CAT-001-01` and observe red because persisted purpose is not included in matching.
- [ ] Add purpose matching after the red result.
- [ ] Add category origin to transaction core/schema/repositories; migrate manual rows to `manual` and CSV rows to `legacy_preserved` without changing categories.
- [ ] Implement origin-aware reapplication plus ascending priority then ascending ASCII rule-ID tie-breaking and verify identical core outcomes across adapters.
- [ ] Cover description, payee, purpose, account restrictions, origin policy, and no-match behavior.
- [ ] Cover mapped category, rule category, fallback category, and fixed-cost interaction.
- [ ] Verify import preview and reapplication to existing transactions produce the same decision.
- [ ] Add mandatory HTTP and PostgreSQL integration tests for create, edit, delete, ordered lookup, reapplication, and friendly validation.

**Tests:** `E2E-FF-CAT-001-01`, `UNIT-FF-CAT-001-01`, `UNIT-FF-CAT-002-01` (origin-aware decisions), `UNIT-FF-CAT-003-01`, `UNIT-FF-CAT-004-01` (normalized uniqueness), `E2E-FF-CAT-004-01`, `INT-FF-CAT-004-02` (normalized category migration), `E2E-FF-CAT-005-01`, `E2E-FF-CAT-005-02`, `UNIT-FF-CAT-005-02` (stable order, origin decisions, changed/unchanged counts), `INT-FF-CAT-005-01` (HTTP), `INT-FF-CAT-005-02` (PostgreSQL), `INT-FF-CAT-005-03` (origin migration), and `INT-FF-TXN-001-04` (PostgreSQL round-trip).

**Quality gates:** the five canonical commands; apply the global conditional Docker and smoke gates when this phase changes migrations, runtime configuration, or deployment behavior.

**Targeted verification:** `pnpm ops:verify --id OPS-FF-CAT-002-01`.

**Commit:** `fix: make categorization deterministic`

### PH-08-R01 — Master-Data Reactivation And Adapter Evidence

**Status:** Pending
**Classification:** Evidence-only; expected green
**Implements:** none
**Verifies:** `FF-MDM-003`, `FF-MDM-004`, `FF-MDM-005`, `FF-ARC-002`
**Operations:** `OPS-FF-MDM-003-01`

- [ ] Add `E2E-FF-MDM-003-02` and `E2E-FF-MDM-004-02`: deactivate, verify historical visibility and choice exclusion, reactivate through edit, and verify choices return.
- [ ] Add `INT-FF-MDM-003-01` and `INT-FF-MDM-004-01` for HTTP mapping and `INT-FF-MDM-003-02` and `INT-FF-MDM-004-02` for PostgreSQL create/edit/deactivate/reactivate and active filtering.
- [ ] Add `INT-FF-MDM-005-01`: restart preserves names and active state.
- [ ] If any expected-green evidence fails, stop and reclassify this phase as behavior remediation before changing production code.

**Tests:** `E2E-FF-MDM-003-01`, `E2E-FF-MDM-003-02`, `E2E-FF-MDM-004-01`, `E2E-FF-MDM-004-02`, `INT-FF-MDM-003-01`, `INT-FF-MDM-003-02`, `INT-FF-MDM-004-01`, `INT-FF-MDM-004-02`, and `INT-FF-MDM-005-01`.

**Quality gates:** the five canonical commands; apply the global conditional Docker and smoke gates when this phase changes migrations, runtime configuration, or deployment behavior.

**Targeted verification:** `pnpm ops:verify --id OPS-FF-MDM-003-01`.

**Commit:** `test: complete master data adapter coverage`

### PH-09-R01 — Income Boundaries, Clock, And Activation

**Status:** Pending
**Classification:** Behavior change
**Implements:** `FF-INC-001`, `FF-INC-002`, `FF-INC-004`, `FF-INC-005`, `FF-ARC-006`
**Verifies:** `FF-INC-003`
**Operations:** `OPS-FF-INC-001-01`

- [ ] Cover before, start, end, and after-range months.
- [ ] Add `E2E-FF-INC-005-01` and observe red because activation/deactivation UI is absent.
- [ ] Add zero-override HTTP behavior and observe red because the current parser rejects it.
- [ ] Cover invalid month, reversed range, invalid/unsafe amount, and every owner context.
- [ ] Inject a controlled clock for month defaults and calculations.
- [ ] Assert exact per-plan and total minor-unit values.
- [ ] Add mandatory HTTP and PostgreSQL integration coverage for form parsing, activation, overrides, filtering, and translated-error preparation.

**Tests:** `E2E-FF-INC-001-01`, `E2E-FF-INC-001-02`, `E2E-FF-INC-005-01`, `UNIT-FF-INC-001-01` (recurring-plan validation/safe arithmetic), `UNIT-FF-INC-002-01`, `UNIT-FF-INC-004-01`, `UNIT-FF-INC-005-01` (activation calculations), `E2E-FF-INC-003-01`, `INT-FF-INC-001-01` and `INT-FF-INC-005-01` (PostgreSQL), and `INT-FF-INC-001-02` and `INT-FF-INC-005-02` (HTTP).

**Quality gates:** the five canonical commands; apply the global conditional Docker and smoke gates when this phase changes migrations, runtime configuration, or deployment behavior.

**Targeted verification:** `pnpm ops:verify --id OPS-FF-INC-001-01`.

**Commit:** `feat: add income activation controls`

### PH-10-R01 — Owner-Context Independence Evidence

**Status:** Pending
**Classification:** Evidence-only; expected green
**Implements:** none
**Verifies:** `FF-MDM-001`, `FF-SCP-003`, `FF-AUTH-008`, `FF-ARC-002`
**Operations:** `OPS-FF-MDM-001-01`

- [ ] Add `E2E-FF-MDM-001-01`: edited labels appear in account, transaction, and income surfaces.
- [ ] Add `INT-FF-AUTH-008-01`: label changes cannot alter OIDC subject, session user context, or authorization.
- [ ] Add `INT-FF-SCP-003-01`: two deterministic authenticated identities can maintain every owner context.
- [ ] Add `INT-FF-MDM-001-01` for HTTP mapping and `INT-FF-MDM-001-02` for PostgreSQL owner-label round trips.
- [ ] Add `SMOKE-FF-SCP-003-01`: expected-green deployment evidence proves both authenticated identities retain equal access to every owner context.
- [ ] If expected-green evidence fails, stop and reclassify before production changes.

**Tests:** `E2E-FF-MDM-001-01`, `INT-FF-AUTH-008-01`, `INT-FF-SCP-003-01`, `INT-FF-MDM-001-01`, `INT-FF-MDM-001-02`, and `SMOKE-FF-SCP-003-01`.

**Quality gates:** the five canonical commands; apply the global conditional Docker and smoke gates when this phase changes migrations, runtime configuration, or deployment behavior.

**Targeted verification:** `pnpm ops:verify --id OPS-FF-MDM-001-01`.

**Commit:** `test: verify owner context independence`

## Planned Feature Delivery

### PH-11 — Explicit Internal Transfers

**Status:** Completed
**Classification:** Behavior change
**Implements:** `FF-TXN-005`, transaction-level foundations for `FF-TXN-006`
**Verifies:** `FF-TXN-001`, `FF-TXN-002`, `FF-TXN-004`, `FF-ARC-006`, `FF-UI-001`
**Operations:** `OPS-FF-TXN-005-01`

**Red:**

- [x] Add `E2E-FF-TXN-005-01`, observe failure because transfer classification does not exist, and record the red result.
- [x] Then add `UNIT-FF-TXN-005-01` and `UNIT-FF-TXN-006-01` for classification and zero expense contribution.

**Tasks:**

- [x] Add explicit internal-transfer classification to the transaction core and persistence model.
- [x] Support mark/unmark in manual and imported transaction maintenance.
- [x] Keep transfers visible and clearly labeled in lists and filters.
- [x] Exclude transfers from reusable expense aggregation rules.
- [x] Do not implement automatic pair matching.
- [x] Do not claim dashboard, average, or forecast UI behavior before `PH-13`.
- [x] Update correction and interpretation runbooks.

**Tests:** `E2E-FF-TXN-005-01`, `E2E-FF-TXN-005-02`, `E2E-FF-TXN-005-03`, `E2E-FF-UI-001-02`, `UNIT-FF-TXN-005-01`, `UNIT-FF-TXN-006-01`, `INT-FF-TXN-001-03`, `INT-FF-TXN-005-01`, and `INT-FF-TXN-005-03` (PostgreSQL), and `INT-FF-TXN-005-02` (HTTP).

**Quality gates:** the five canonical commands plus `docker compose build`.

**Targeted verification:** `pnpm ops:verify --id OPS-FF-TXN-005-01` (registered migration, atomic mark/unmark, filter, and aggregate evidence).

**Commit:** `feat: classify internal transfers`

### PH-12 — German Localization For Existing Surfaces

**Status:** Pending
**Classification:** Behavior change
**Implements:** `FF-LOC-001`, `FF-LOC-002`, `FF-LOC-003`, `FF-LOC-004`, `FF-ARC-007`, `FF-MDM-002`
**Verifies:** `FF-ARC-004`, `FF-UI-001`, `FF-UI-003`
**Operations:** `OPS-FF-LOC-002-01`

**Red:**

- [ ] Add `E2E-FF-LOC-002-01`: enter `1.234,56` and `31.12.2026` and verify canonical storage and German display.
- [ ] Add `E2E-FF-LOC-001-01`: verify German navigation, labels, help, and validation across surfaces delivered through `PH-11`.
- [ ] Observe failure because current UI and human-form parsing are not fully German-localized.

**Tasks:**

- [ ] Move human amount/date parsing out of core modules and keep core values and typed error codes locale-neutral.
- [ ] Replace user-facing core error strings with typed errors where needed.
- [ ] Add adapter-owned translation catalogs, `de-DE` formatters, and human-form parsers.
- [ ] Prepare translated and formatted Nunjucks view models.
- [ ] Keep CSV profile parsing independent from human-form parsing.
- [ ] Localize only the `FF-LOC-001-AC01` inventory available through `PH-11`: authentication, master data, transactions/internal transfers, CSV import, categorization rules, income, and rendered 400/401/404/500 pages. Enforce the explicit untranslated-token allowlist.
- [ ] Leave dashboard/forecast inventory to `E2E-FF-LOC-001-02` in `PH-13` and scenario/calculator inventory to `E2E-FF-LOC-001-03` in `PH-14`.
- [ ] Add a catalog completeness check covering every key used by prepared view models.
- [ ] Use the target German fresh-database seed literals from `FF-MDM-002` without renaming existing user-maintained rows.
- [ ] Document accepted formats and troubleshooting.

**Tests:** `E2E-FF-LOC-001-01`, `INT-FF-LOC-001-04` (catalog keys and allowlist), `E2E-FF-LOC-002-01`, `UNIT-FF-LOC-003-02` (locale-neutral amount/date values), `UNIT-FF-ARC-007-01` (typed domain errors), `INT-FF-ARC-007-01` (core/adapters localization boundary), `INT-FF-LOC-002-01` and `INT-FF-LOC-002-02` (valid/invalid HTTP grammar), `INT-FF-LOC-003-01` (formatting/error translation), `INT-FF-LOC-004-01` (CSV independence), `INT-FF-ARC-004-03` (template boundary), and `INT-FF-MDM-002-02` (fresh versus existing seeds).

**Quality gates:** the five canonical commands plus `docker compose build` when packaged localization resources change.

**Targeted verification:** `pnpm ops:verify --id OPS-FF-LOC-002-01` and fresh/existing database seed verification.

**Commit:** `feat: add german localization`

### PH-13 — Dashboard And Monthly Forecast

**Status:** Pending
**Classification:** Behavior change
**Implements:** `FF-DASH-001`, `FF-DASH-002`, `FF-DASH-003`, `FF-DASH-004`, `FF-FOR-001`, `FF-FOR-002`, `FF-FOR-003`, `FF-FOR-004`, completes `FF-TXN-006`
**Verifies:** `FF-ARC-006`, `FF-INC-003`, `FF-LOC-001`, `FF-LOC-003`, `FF-UI-001`
**Operations:** `OPS-FF-DASH-001-01`, `OPS-FF-FOR-001-01`

**Red:**

- [ ] Add `E2E-FF-DASH-001-01`, observe failure because dashboard metrics do not exist, and record the red result.
- [ ] Add `E2E-FF-DASH-003-01`, `E2E-FF-DASH-004-01`, `E2E-FF-FOR-001-01`, and `E2E-FF-FOR-004-01`; observe each missing behavior before production implementation.
- [ ] Then add controlled-clock and exact-arithmetic unit tests.

**Tasks:**

- [ ] Implement expense qualification, averages, and forecast calculations in core services; PostgreSQL queries return canonical transactions/income data only.
- [ ] Exclude internal transfers from every expense-derived result.
- [ ] Use planned income and monthly overrides for income totals.
- [ ] Include zero-expense months in preceding completed-month averages.
- [ ] Implement all dashboard filters consistently for full-page and HTMX requests; reject a selected month later than the controlled current month.
- [ ] Anchor 3/6/12-month averages immediately before the selected month and include zero months while excluding planned expenses and transfers.
- [ ] Show category and account/owner breakdowns that reconcile with totals.
- [ ] Show forecast only for the controlled current month; historical months show actuals and future month selection is rejected.
- [ ] Extrapolate variable expenses with safe integer intermediates and one half-up minor-unit rounding step.
- [ ] Transition a planned item to booked on the same transaction ID and move it between mutually exclusive components.
- [ ] Add German prepared view models and translated errors.
- [ ] Update dashboard interpretation and forecast-limit runbooks.

**Tests:** `E2E-FF-DASH-001-01`, `UNIT-FF-DASH-001-01` (sign conversion and balance), `E2E-FF-DASH-002-01`, `UNIT-FF-DASH-002-01` (reconciliation), `E2E-FF-DASH-003-01`, `UNIT-FF-DASH-003-01` (filter aggregation), `E2E-FF-DASH-004-01`, `UNIT-FF-DASH-004-01`, `E2E-FF-FOR-001-01`, `UNIT-FF-FOR-001-01`, `UNIT-FF-FOR-002-01`, `UNIT-FF-FOR-003-01`, `E2E-FF-FOR-004-01`, `UNIT-FF-FOR-004-01`, `E2E-FF-TXN-006-02`, `E2E-FF-MDM-001-02`, `E2E-FF-LOC-001-02`, `INT-FF-DASH-001-01` (PostgreSQL), and `INT-FF-DASH-003-01` (HTTP/HTMX).

**Quality gates:** the five canonical commands.

**Targeted verification:** `pnpm ops:verify --id OPS-FF-DASH-001-01` and `pnpm ops:verify --id OPS-FF-FOR-001-01`.

**Commit:** `feat: add dashboard forecasting`

### PH-14 — Family-Finance Scenarios

**Status:** Pending
**Classification:** Behavior change
**Implements:** `FF-SCN-001`, `FF-SCN-002`, `FF-SCN-003`, `FF-SCN-004`, `FF-SCN-005`, `FF-SCN-006`
**Verifies:** `FF-ARC-006`, `FF-LOC-001`, `FF-LOC-003`, `FF-UI-001`
**Operations:** `OPS-FF-SCN-001-01`

**Red:**

- [ ] Add `E2E-FF-SCN-001-01`, observe failure because scenarios do not exist, and record the red result.
- [ ] Add `E2E-FF-SCN-004-01` and `E2E-FF-SCN-006-01`; observe missing results and calculator pages.
- [ ] Then add exact-value core tests for snapshots, typed deltas, inclusive ranges, and formulas.

**Tasks:**

- [ ] Implement scenario and typed income/expense adjustment core entities and calculation service.
- [ ] Snapshot the selected completed-month historical average at creation; later source, ordinary scenario edits, or clock changes never recalculate it.
- [ ] Recompute/replace the snapshot only when the user explicitly changes baseline mode/window/value.
- [ ] Reject adjustments outside the scenario range and reject range shrinkage that would orphan an adjustment.
- [ ] Support family-planning income and expense adjustments without internal legal calculations.
- [ ] Calculate monthly balance, cumulative and lowest buffer, funding gap, and required additional net income in minor units.
- [ ] Add repository ports, migration, and PostgreSQL adapters.
- [ ] Add German scenario list, creation, editing, monthly table, and help page.
- [ ] Link the exact Familienportal and BMF calculator URLs.
- [ ] Update scenario interpretation and maintenance runbooks.

**Tests:** `E2E-FF-SCN-001-01`, `E2E-FF-SCN-001-02`, `UNIT-FF-SCN-001-01`, `INT-FF-SCN-001-01` (snapshot persistence), `UNIT-FF-SCN-002-01`, `UNIT-FF-SCN-002-02`, `E2E-FF-SCN-003-01`, `E2E-FF-SCN-004-01`, `UNIT-FF-SCN-004-01`, `UNIT-FF-SCN-004-02`, `UNIT-FF-SCN-005-01`, `E2E-FF-SCN-006-01`, `E2E-FF-LOC-001-03`, `E2E-FF-UI-001-03`, `INT-FF-SCN-001-02` (PostgreSQL), and `INT-FF-SCN-001-03` (HTTP).

**Quality gates:** the five canonical commands plus `docker compose build`.

**Targeted verification:** execute scenario migration and exact-fixture Compose procedure from `OPS-FF-SCN-001-01`.

**Commit:** `feat: add scenario planning`

### PH-15 — Deployment Hardening And MVP Release

**Status:** Pending
**Classification:** Behavior change
**Implements:** `FF-DEP-005`, `FF-REL-001`, `FF-REL-002`
**Verifies:** `FF-SCP-001`, `FF-SCP-002`, `FF-SCP-003`, `FF-SCP-004`, `FF-DEV-001`, `FF-OPS-001`, `FF-OPS-002`, `FF-OPS-003`, `FF-DEP-001`, `FF-DEP-002`, `FF-DEP-003`, `FF-DEP-004`, `FF-DEP-005`, `FF-REL-001`, `FF-REL-002`, `FF-QUA-001`, `FF-QUA-002`, `FF-QUA-003`, `FF-QUA-004`
**Operations:** `OPS-FF-DEP-005-01`, `OPS-FF-REL-001-01`, `OPS-FF-REL-002-01`; rerun every earlier operations evidence item without redefining ownership

**Red:**

- [ ] Add `SMOKE-FF-DEP-005-01` and observe failure because production currently accepts tag-only `APP_IMAGE` references rather than requiring a digest.
- [ ] Add `SMOKE-FF-REL-001-01` and observe failure because no post-adoption annotated release tag records an OCI digest/image labels contract.
- [ ] Add `SMOKE-FF-REL-002-01` and observe failure because digest-based update/rollback verification is not implemented.

**Expected-green verification:** All evidence owned by `PH-15` for requirements outside `Implements` is a verification-only rerun after its implementing phase. It must be green before release work starts. Any failure stops `PH-15` and creates an explicitly scoped behavior-remediation phase; `PH-15` does not make unplanned production changes for verification-only criteria.

**Tasks:**

- [ ] Run the complete requirement-linked E2E suite against the production Compose stack.
- [ ] Re-run empty-database and update migration smoke tests.
- [ ] Re-run backup, restore, data reconciliation, and restored-session invalidation.
- [ ] Verify Caddy-facing `BASE_URL`, secure cookies, callback URLs, and healthchecks.
- [ ] Preserve and verify host-local Dex development separately from production Authentik configuration.
- [ ] Deploy only a prebuilt digest-pinned `APP_IMAGE`; production performs no build or package installation.
- [ ] For releases created after `FF-REL-001` adoption, verify package version, changelog, image version/revision labels, and annotated Git tag agree; parse the authoritative `image-digest: sha256:<digest>` tag-message line and never rewrite historical lightweight tags.
- [ ] Before deploying digest B, write B's append-only deployment record with previous digest A, pre-B backup ID/path/checksum, before/after schema versions, and direct-rollback compatibility.
- [ ] Execute compatible and incompatible update/rollback fixtures: direct B→A for compatible schema, or stop traffic + restore B's pre-deployment backup + start A for incompatible schema.
- [ ] Audit environment examples, image contents, secrets, headers, logs, and anonymized fixtures.
- [ ] Re-run the existing `scripts/check-requirement-traceability.ts` and `tests/integration/requirement-traceability.test.ts`; reject duplicate IDs, missing acceptance rows, unknown requirement/phase/test/operations references, ID ranges, and planned tests without expected-red or expected-green classification.
- [ ] Verify every active acceptance criterion still has exactly one ledger row with an owning phase and evidence ID.
- [ ] Finalize README, Operations runbooks, release checklist, and rollback instructions.
- [ ] Record known limitations without weakening active acceptance criteria.

**Tests:** `SMOKE-FF-DEP-005-01`, `SMOKE-FF-REL-001-01`, `SMOKE-FF-REL-002-01`, and `SMOKE-FF-REL-002-02` are expected red before their production changes. `INT-FF-ARC-001-01`, `INT-FF-ARC-002-01`, `INT-FF-ARC-005-01`, `INT-FF-DEP-004-01`, `INT-FF-QUA-002-01`, `INT-FF-QUA-003-01`, `SMOKE-FF-DEV-001-01`, `SMOKE-FF-DEV-001-02`, `SMOKE-FF-OPS-001-01`, `SMOKE-FF-SCP-002-01`, and `SMOKE-FF-SCP-004-01` are expected-green evidence owned by PH-15.

**Quality gates:** the five canonical commands plus `docker compose build`.

**Targeted verification:** execute every named SMOKE and OPS procedure and the ID/traceability validator.

**Commit:** `chore: prepare mvp release`

## Traceability Inventories

The phase, acceptance, test-evidence, adapter-boundary, and operations inventories live in `traceability.json`. They are intentionally not duplicated as Markdown tables. Use:

- `pnpm requirements:check` for schema, identifier, mapping, boundary, and exact command-wiring validation.
- `pnpm evidence:check` to compare completed evidence with tests collected by Vitest and Playwright.
- `pnpm ops:verify --id <OPS-ID>` to invoke only a verifier registered in `scripts/operations/registry.ts`.
