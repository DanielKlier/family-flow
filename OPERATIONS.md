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

### Deployment smoke evidence

Docker Engine and Docker Compose are prerequisites. The smoke verifiers build the current image, create isolated Compose projects and disposable PostgreSQL volumes, and clean them up after each scenario.

- Run `pnpm ops:verify --id OPS-FF-DEP-002-01` for empty-database and N-1 update evidence. Success means `/health` returns 2xx only after startup migrations complete, PostgreSQL is healthy, and `schema_migrations` contains every bundled migration.
- Run `pnpm ops:verify --id OPS-FF-DEP-003-01` for external-URL evidence. Success means rendered links resolve to `https://finances.home.arpa` without exposing the Compose-published address, the callback and post-logout URLs use HTTPS, and OIDC state, session, and cleared session cookies are `Secure`.
- For a direct focused run of all four scenarios, use `pnpm exec playwright test tests/e2e/deployment-smoke.test.ts --workers=1`.

A failure before readiness usually indicates an image build, PostgreSQL startup, migration, seed, session-cleanup, or synthetic OIDC discovery problem. Inspect the failing Playwright assertion and captured Docker command output; the verifier removes its disposable project even on failure. For a production deployment, inspect `docker compose -f compose.prod.yaml logs app postgres`. A URL or cookie assertion failure indicates that `BASE_URL`, OIDC provider redirect registration, or reverse-proxy HTTPS routing differs from the external origin. Never work around a failed migration by marking it complete manually.

After a failed production update, stop traffic and the updated deployment. Restore the pre-update database backup and its compatible prior image when the migration is not backward-compatible; otherwise restart the prior known-good image against the current database. After a reverse-proxy failure, restore the prior proxy route and image/configuration pair, then verify `/health` locally before reopening traffic.

Image distribution alternatives:

- Current production default: build locally or in CI, push a versioned image to GHCR, Docker Hub, or a LAN registry, and let the target server pull images by tag.
- Local development default: use `pnpm docker:build` when you intentionally want to build the `compose.yaml` image on the development machine. The gate supplies `.env.example` for non-secret Compose interpolation and does not depend on the operator's `.env`.
- A registry is required for production because the target server must not build images or install npm packages.

## Updates

Before the final commit and again before pushing, run `pnpm install` when dependencies changed, then run `pnpm verify`. Add `pnpm test:postgres`, `pnpm docker:build`, migration, or deployment smoke gates when the changed boundary requires them. Push the resulting immutable image and deploy it with `compose.prod.yaml`.

Dependabot checks the root pnpm dependencies, Dockerfile base images, and Docker Compose images weekly and opens pull requests for available Node.js, PostgreSQL, and Dex updates. Review all manifest, lockfile, Dockerfile, and Compose changes in each pull request. Require `pnpm verify` plus applicable boundary-specific gates, including `docker compose config` and Docker builds for container changes, before merging.

When database schema changes are included, inspect the SQL files in `drizzle/` before deployment and check `docker compose logs app` after startup for migration failures.

## Pull Request Checks

The GitHub Actions workflow runs on the `pull_request` event for all pull requests, including Dependabot updates. It grants only `contents: read`, uses no secrets, and disables persisted checkout credentials so untrusted pull request code receives no repository write access.

One Ubuntu job runs these gates sequentially and stops at the first failure:

1. `pnpm verify`
2. `env -u TEST_DATABASE_URL pnpm test:postgres`
3. `docker compose --env-file .env.example config`
4. `docker compose --env-file .env.example -f compose.prod.yaml config`
5. `pnpm docker:build`

The workflow installs the locked Node and pnpm toolchain plus Chromium system dependencies before running the gates. Investigate the first failed step and do not merge a Dependabot or contributor pull request until all five gates pass.

## Quality And Operations Evidence

`traceability.json` is the authoritative requirements, phases, acceptance, test-evidence, adapter-boundary, and operations inventory. Run `pnpm requirements:check` after changing it or package commands. The validator checks typed structure and references only; it deliberately does not interpret Markdown, shell prose, or TypeScript control flow. Run `pnpm evidence:check` to compare completed evidence with tests actually collected by Vitest and Playwright.

For Drizzle adapter or migration work, run `env -u TEST_DATABASE_URL pnpm test:postgres`. This gate uses `compose.test.yaml` to create a uniquely named PostgreSQL-only Compose project, publishes PostgreSQL on a Docker-selected `127.0.0.1` port, and replaces any inherited `TEST_DATABASE_URL` before running Vitest sequentially. On Vitest failure, the runner relays stdout and stderr after redacting PostgreSQL URLs and environment values named as secrets, tokens, passwords, or database URLs. It never exposes the private Compose-port probe. The runner always executes Compose `down --volumes --remove-orphans`, including startup, test, and signal failure paths, and preserves exit codes 130 for SIGINT and 143 for SIGTERM. Docker Engine and Docker Compose are prerequisites. If the gate fails, inspect the sanitized command error and `docker ps -a`; do not reuse a development or production database as test evidence.

Run named operational evidence with `pnpm ops:verify --id <OPS-ID>`. Only verifiers explicitly registered in `scripts/operations/registry.ts` are executable; inventory rows in `traceability.json` are documentation and mapping metadata, not commands. The package command clears inherited Node preload options before starting the dispatcher, and each verifier receives only `PATH` and `HOME`. Unknown IDs and non-passing or mismatched results fail closed. Follow the inventory rollback procedure after any failed production-facing operation.

For request lifecycle and log-analysis evidence, run `pnpm ops:verify --id OPS-FF-OBS-003-01`. It executes only the request-context unit fixture, request-logging integration fixture, and request-ID lifecycle E2E fixture. A pass confirms one correlated final log per lifecycle path and query logging limited to canonical transaction UUIDv4 IDs and integer row counts from 0 through 10,000. Month filters, repeated values, malformed IDs, out-of-range counts, secrets, and financial text are omitted. If this verifier fails or sensitive context appears, restrict log access, retain the minimized request ID for investigation, and roll back the application image.

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

## Browser Locale And Localized Input

The server negotiates German (`de-DE`) and English (`en`) independently for every request from `Accept-Language`. Each representation takes its quality from the most-specific matching range, so an exact or language-level `q=0` exclusion is not overridden by a less-specific positive range or `*`. Set `DEFAULT_LOCALE=de-DE` or `DEFAULT_LOCALE=en` to choose the fallback for missing, malformed, wildcard-only, or unsupported language ranges; if that locale is explicitly excluded, the server selects a non-excluded supported locale. If all supported locales are excluded, the configured locale is the terminal fallback instead of a `406` response. The process refuses to start with any other value. Docker Compose forwards this setting and defaults it to German.

HTML pages, HTMX fragments, and rendered HTML errors carry `Content-Language` and `Vary: Accept-Language`; redirects and `/health` intentionally do not. Preserve these headers in reverse-proxy and cache configuration so one user's representation is not served to another locale. No locale preference is stored in the session, so concurrent browsers and requests remain isolated.

German forms accept amounts such as `1234`, `1234,5`, and `1.234,56`, dates in `DD.MM.YYYY`, and months in `MM.YYYY`. English forms accept amounts such as `1234`, `1234.5`, and `1,234.56`, dates in `MM/DD/YYYY`, and months in `MM/YYYY`. Stored values remain canonical minor units, ISO dates, and ISO months. CSV imports continue to use the date and decimal grammar selected in each import profile. If localized text is missing or incorrect, inspect the corresponding catalog and adapter under `src/adapters/localization/`; HTTP and core modules must not contain fallback translations or locale APIs.

If a localized form submission fails:

1. Confirm that the browser sends the expected `Accept-Language` value and inspect the response `Content-Language`.
2. Confirm that amount, date, and month values use the grammar for that response locale and represent valid Gregorian values.
3. Reproduce through the same form rather than changing canonical database values.
4. Use the response `X-Request-Id` (also displayed on rendered transaction validation errors) to find the single request log entry. Validation logs do not contain the submitted financial value.
5. For CSV failures, inspect the selected import profile and preview outcome instead; do not apply human-form grammar to the uploaded file.

Fresh-database seed names use `DEFAULT_LOCALE` only when their stable IDs are first inserted. The database seed adapter owns the stable owner keys, account/category IDs, and account-owner assignments; localization supplies display names for those keys only. Changing `DEFAULT_LOCALE`, startup, and upgrades never rename an existing account, category, or owner label. If an existing name differs from the active locale, retain it unless an operator explicitly chooses to edit it.

## Authentication And Sessions

All non-health application routes are protected. `/health` remains public for local health checks. Login uses `/auth/login` and `/auth/callback`. Each login creates an opaque server-side state/nonce transaction in PostgreSQL; it expires exclusively after ten minutes and the callback consumes it atomically exactly once. No state or nonce is stored in a browser cookie. Logout uses `POST /auth/logout` and requires an `Origin` matching the normalized `BASE_URL` origin; failed origin checks do not revoke. A missing, unknown, expired, or revoked logout session receives a localized `401` response instead of the protected-route login redirect. `GET /auth/logout` is not a logout operation.

Production uses Authentik through `AUTH_MODE=oidc` and requires these environment variables:

- `BASE_URL`: the externally visible application URL, normally `https://finances.home.arpa`.
- `OIDC_ISSUER_URL`: the Authentik provider URL for the FamilyFlow application.
- `OIDC_CLIENT_ID`: the Authentik client ID.
- `OIDC_CLIENT_SECRET`: the Authentik client secret.

Authentik application settings:

- Redirect URI: `https://finances.home.arpa/auth/callback`.
- Post-logout redirect URI: `https://finances.home.arpa/auth/login`.
- Scopes: `openid`, `email`, and `profile`.

Local E2E tests and development without Authentik can use `AUTH_MODE=test`. In this mode `/auth/test-login` creates an opaque PostgreSQL-backed session for the deterministic `test-user`. Do not run production with `AUTH_MODE=test`. Production startup also rejects a non-HTTPS application or issuer URL, a Dex issuer, the committed `family-flow-dev` credentials, and the historical committed development session placeholder.

The callback accepts only a signed RS256 ID token from the discovery document's exact configured issuer and JWKS. Issuer, audience, expiry, transaction nonce, signature, and non-empty `sub`, `name`, and `email` claims must all validate before a session is created.

### OIDC/Auth problems

1. Capture the response `X-Request-Id`; do not copy authorization codes, ID tokens, client secrets, state, or nonce values into tickets or logs.
2. Fetch `${OIDC_ISSUER_URL}/.well-known/openid-configuration` from the app network and confirm its `issuer` exactly equals the normalized configured issuer and that its authorization, token, userinfo, and JWKS endpoints are reachable.
3. Confirm Authentik uses the exact callback `${BASE_URL}/auth/callback`, the FamilyFlow client ID, and the `openid email profile` scopes. Confirm its ID token supplies non-empty `sub`, `name`, and `email` claims.
4. For an invalid or reused callback, start a new login. Transactions expire at exactly ten minutes and cannot be retried after any callback attempt, including a failed code exchange or claim check.
5. Correlate the single sanitized request log by request ID. Callback query `code` and `state` values are redacted; tokens, nonce, and client secrets must never appear.
6. For local Dex only, follow the development procedure below. Never point production at Dex or copy `.env.dev` values into production.

Run `pnpm ops:verify --id OPS-FF-AUTH-002-01` for signed-token, invalid/reused callback, expiry, production-rejection, PostgreSQL atomic-consumption, and protected-route evidence. Roll back by disabling traffic and restoring the prior compatible image/config; retain only sanitized request-ID logs.

Session cookies contain only a random 256-bit token and expire after an absolute eight hours. PostgreSQL stores its SHA-256 hash and user/lifetime/revocation metadata. `SESSION_SECRET`, signed sessions, and Redis are not used; deployment of migration `0011_sessions.sql` intentionally rejects old signed cookies.

### Session cleanup

Startup deletes one deterministic batch of at most 1,000 expired or revoked sessions. For maintenance, repeat `docker compose -f compose.prod.yaml run --rm app node dist/app/session-cleanup.js --limit 1000` until it reports `0 row(s)`. Active sessions are preserved and authentication never depends on cleanup.

Run `pnpm ops:verify -- --id OPS-FF-AUTH-006-01` to verify against PostgreSQL that startup invokes exactly one bounded batch and that the repeatable maintenance entry point preserves active sessions.

### Restored session safety

A database backup includes bearer-session rows. The canonical `Restore` runbook below requires invalidation and cleanup before application startup or traffic.

Local development can also use Dex as a lightweight OIDC provider instead of Authentik. Start it with `docker compose --env-file .env.dev -f compose.yaml -f compose.dev.yaml up -d dex` and run the app on the host with `pnpm dev:oidc`.

Dex development settings:

- Issuer URL: `http://127.0.0.1:5556/dex`.
- Client ID: `family-flow-dev`.
- Client secret: `family-flow-dev-secret`.
- Redirect URI: `http://127.0.0.1:3000/auth/callback`.
- Test user email: `dev@example.invalid`.
- Test user password: `family-flow-dev`.

The committed `.env.dev` file contains these local-only OIDC values. Keep production Authentik settings in `.env`, and use `.env.dev` for the Dex development flow. This local Dex setup is not intended for production and must not be exposed outside the development host. Run `pnpm ops:verify --id OPS-FF-DEV-001-01` to verify the committed development contract remains separate from production configuration.

## Seeds

The app seeds initial account owner labels, accounts, and categories during startup after migrations. Seeds are idempotent: existing rows with the same stable ID are kept unchanged, and missing rows are inserted. This preserves renamed owner labels, renamed accounts, or deactivated seeded master data across restarts.

Initial account owner labels:

- `person_a`: `Person A`.
- `person_b`: `Person B`.
- `shared`: `Gemeinsam`.

Initial accounts:

- `Girokonto Person A` with owner context `person_a`.
- `Girokonto Person B` with owner context `person_b`.
- `Gemeinsames Girokonto` with owner context `shared`.

Initial categories include `Wohnen/Miete`, `Lebensmittel`, `Drogerie`, `Versicherungen`, `Mobilität`, `Gesundheit`, `Kind/Baby`, `Abos`, `Freizeit`, `Urlaub`, `Kleidung`, and `Sonstiges`.

## Master Data Maintenance

Authenticated users can maintain account owner display names, accounts, and categories at `/admin/master-data`.

Supported maintenance actions:

- Create accounts with a name and owner context.
- Edit account name, owner context, and active status.
- Deactivate accounts from the list without deleting them.
- Edit account owner display names for `person_a`, `person_b`, and `shared`.
- Create categories with a name.
- Edit category name and active status.
- Deactivate categories from the list without deleting them.

Operational notes:

- Deactivated accounts and categories remain in PostgreSQL so existing transactions keep valid foreign keys and continue to render in transaction lists.
- Account owner display names are labels for reporting and filters only. They are not linked to OIDC users or access control.
- Accounts, transactions, and income plans keep storing the stable owner keys `person_a`, `person_b`, and `shared`; changing a display name only changes rendered labels.
- New transaction forms show only active accounts and categories. Existing transactions still display inactive category names from stored IDs.
- Use the edit page to reactivate a deactivated account or category.
- Validation errors are shown in the master data form. Use the visible `X-Request-Id` to inspect the matching request log entry if saving fails unexpectedly.
- Before broad cleanup of master data, create a database backup because deactivation is reversible through the UI, but direct database edits are not protected by the application.

## Manual Transaction Maintenance

Authenticated users can maintain manual expenses at `/transactions`.

Supported maintenance actions:

- Create booked or planned manual expenses.
- Mark planned or booked expenses as fixed costs.
- Edit account, category, date, description, payee, amount, status, fixed-cost flag, and note.
- Delete incorrectly entered manual transactions.
- Mark or unmark manual and CSV-imported expenses as internal transfers.
- Filter by month, account, owner context, category, status, fixed-cost flag, and transfer state.

Operational notes:

- Amounts are entered as positive expense amounts in the UI and stored as negative cents in PostgreSQL. Stored values must fit PostgreSQL's signed `integer` range; invalid, fractional-cent, zero, or negative human inputs are rejected without mutation.
- Dates must be real Gregorian calendar dates. Native month filters submit canonical `YYYY-MM` values and can be combined with the other transaction filters.
- Transaction creation and editing reject account or category IDs that do not exist. Inactive referenced master data remains valid for existing transactions because deactivation does not delete it.
- Owner-context filtering is derived from the selected account, not from a separate transaction field.
- Run `pnpm ops:verify --id OPS-FF-TXN-002-01` to verify calendar and cent boundaries, reference validation, localized HTTP behavior, PostgreSQL round trips and filters, and the full-page filter scenarios. The verifier starts an isolated PostgreSQL service and removes it afterward.
- Use `/admin/master-data` to verify account and category status if transaction forms have missing options. A missing reference response includes the request ID and must not create or update a transaction.
- For manual correction issues, capture the visible `X-Request-Id` and inspect the matching request log entry. Do not log or paste broad financial exports when a single minimized transaction example is enough.

## Internal Transfer Classification

Migration `0014_internal_transfers.sql` adds a non-null transfer flag and classifies every existing transaction as unmarked. Migration `0015_categorization_rule_internal_transfer.sql` additively adds the nullable categorization-rule action and leaves existing rules unchanged. Neither infers pairs nor rewrites financial values. Run the bounded migrations, atomic mark/unmark, rule-action, filter, and aggregate verifier with `pnpm ops:verify --id OPS-FF-TXN-005-01`; a passing `Operation OPS-FF-TXN-005-01 passed` result is the required PH-11 operations evidence. After deployment, verify the behavior with one minimized fixture:

1. Open `/transactions`, create a temporary expense, and use `Mark as transfer` in its row.
2. Confirm that the row remains visible and shows `Internal transfer`.
3. Select `marked` in the `Transfer state` filter and confirm that the fixture remains listed.
4. Use `Unmark transfer`, select the `unmarked` filter, and confirm that the label is removed while the row remains listed.
5. Delete the temporary fixture. Repeat mark/unmark on a non-sensitive imported fixture when validating CSV identity preservation; its source, purpose, and duplicate-detection hash must not change.

Interpretation and correction:

- Mark each transaction leg that represents movement between household-owned accounts. Classification is explicit; FamilyFlow does not automatically match transfer pairs.
- Marking either one leg or both legs makes every marked leg contribute zero to the reusable core expense aggregate and to dashboard actuals, historical averages, and forecasts.
- If an expense was marked incorrectly, unmark it through its transaction row. If many historical rows need correction, take a backup first, identify rows by stable transaction ID, and apply deliberate changes rather than guessing pairs from equal amounts.
- Transfer actions preserve active canonical transaction filters. A row that no longer matches after mark/unmark disappears from the filtered list without exposing rows from another transfer state.
- Requests must submit exactly `internalTransfer=true` or `internalTransfer=false`. Invalid values return HTTP 400 with the response request ID and do not mutate the transaction.
- To troubleshoot a missing label or filter result, capture the response `X-Request-Id`, inspect the matching request log, and verify `internal_transfer` for only the affected transaction. Do not include broad financial data in logs or support material.
- If migration `0014_internal_transfers.sql` fails, keep the previous application version stopped, inspect the migration error and `schema_migrations`, and retry after correcting the database issue. Never edit the deployed migration or infer transfer state during rollback; the additive column is safe for the updated application and older data remains unmarked by default.

## Categorization Rule Maintenance

Authenticated users can maintain automatic transaction categorization rules at `/categorization-rules`.

Supported maintenance actions:

- Create text rules with a name, search text, target category, optional account restriction, optional fixed-cost action, optional internal-transfer action, and numeric priority.
- Use a lower priority number for more specific rules when multiple rules match the same transaction. Rules with the same priority are evaluated by ascending ASCII rule ID.
- Leave the account restriction as `All accounts` for household-wide rules, or select one account when the same text should only apply to a specific account.
- Use `Apply rules to existing transactions` after creating or changing rules to re-categorize already stored transactions and apply fixed-cost or internal-transfer actions.

Operational notes:

- Rules match transaction description, payee, and imported purpose after NFKC normalization, trimming, whitespace collapse, and German case folding.
- Disabled rule support is represented in the data model; the current UI creates enabled rules only.
- Migration `0015_categorization_rule_internal_transfer.sql` additively introduces the nullable rule action. Existing rules remain `unchanged`; no transaction is reclassified during migration.
- Migration `0016_category_origin_and_normalized_names.sql` validates normalized category uniqueness before mutation, adds the mandatory category origin, marks historical manual rows `manual` and CSV rows `legacy_preserved`, and invalidates only unconsumed pre-origin previews. It never guesses historical rule or mapping provenance and never changes a transaction category. If it reports a normalized collision, keep the application stopped, use the reported category IDs to choose distinct canonical names, update only the intended master-data rows, and rerun the unchanged migration. Restore the pre-deployment backup if the intended correction cannot be established safely.
- CSV import preview applies normalized mapped-category matching first, then categorization rules, then the `Sonstiges` fallback. It stores `csv_mapped`, `rule`, or `fallback` origin with the category decision. Matching rules can still set fixed-cost and internal-transfer actions when the category comes from the CSV file. Confirmation validates that authoritative snapshot; malformed origin or non-boolean action values abort atomically.
- Reapplication processes booked and planned transactions in stable ID order and displays changed and unchanged counts. It preserves categories with `manual`, `csv_mapped`, or `legacy_preserved` origin while still applying matching state actions; only `rule` and `fallback` categories are recalculated. Source, purpose, import hash, and unmatched transactions remain unchanged.
- Run `pnpm ops:verify --id OPS-FF-CAT-002-01` before deployment. A passing `Operation OPS-FF-CAT-002-01 passed` result verifies PostgreSQL origin persistence, origin-preserving description edits, manual category-change provenance, migration diagnostics, normalization, collation-independent code-point ordering, import precedence, and reapplication counts. If it fails, do not apply rules in production; retain the backup, inspect the bounded failing test, and roll back the image if deployment has started.
- If rule application gives unexpected results, capture the visible `X-Request-Id`, inspect the matching request log entry, compare the displayed counts with the intended scope, and verify only minimized affected transactions instead of exporting broad financial data.

## Income Planning Maintenance

Authenticated users can maintain recurring income plans and monthly income overrides at `/income`.

Supported maintenance actions:

- Create recurring income plans with owner context, name, amount, start month, and optional end month.
- Edit existing income plans from the income list.
- Capture a monthly override amount, including zero, for a specific income plan and month.
- Deactivate a plan without deleting its fields or overrides, and reactivate it under the same range and override rules.
- Filter income plans and monthly planned income totals by owner context.
- Change the calculation month to review the recurring income and matching overrides for that month.

Operational notes:

- Income amounts are entered as positive decimal amounts and stored as positive cents in PostgreSQL.
- Monthly overrides replace the recurring amount for the selected income plan in that month; they do not add an extra income row. A zero override intentionally contributes no income for that plan and month.
- Deactivation excludes a plan from every monthly total. Reactivation restores it without changing its amount, range, owner, or overrides.
- Owner-context filtering uses the income plan owner context directly.
- If an income calculation looks unexpected, verify the selected calculation month, owner-context filter, start and end months, and matching monthly overrides before editing database rows directly.
- For support cases, capture the visible `X-Request-Id` and use minimized examples. Avoid exporting broad income or household finance data into logs or tickets.

## Dashboard Interpretation And Forecast Limits

Authenticated users can review the monthly dashboard at `/`. The selected month defaults from the application clock and cannot be later than the current controlled month.

Interpretation rules:

- Planned income uses active recurring plans and exact monthly overrides. The owner filter constrains both income and expenses; account and category filters constrain expenses only.
- Actual expenses include booked transactions only, display their non-negative magnitude, and exclude internal transfers. Balance is planned income minus that expense magnitude.
- Category and account/owner breakdowns use the same filters and reconcile with the displayed expense total.
- Three-, six-, and twelve-month averages use the completed months immediately before the selected month. Zero-expense months remain in each divisor; planned expenses and internal transfers are excluded.
- Forecast is shown only for the controlled current month. It combines booked fixed expenses, open planned fixed expenses, and booked variable expenses extrapolated over the calendar month. A transaction changing from planned to booked on the same ID moves components rather than being counted twice.
- Variable extrapolation uses elapsed calendar days inclusively and one half-up rounding step to cents. It is an estimate, not a commitment or available-balance calculation; unusual early-month spending can make it volatile.

Troubleshooting:

1. Confirm the selected month and all owner, account, and category filters.
2. Review transaction status, fixed-cost classification, account owner, and internal-transfer flag at `/transactions`.
3. Review active income ranges and overrides at `/income`.
4. Future-month requests return HTTP 400. Use the visible `X-Request-Id` to correlate the response with the single request log entry.
5. If totals do not reconcile, use a minimized fixture and compare actual, breakdown, and forecast components. Do not place broad financial records in logs or support tickets.

Run `pnpm ops:verify --id OPS-FF-DASH-001-01` to provision isolated PostgreSQL for the canonical repository fixture and then execute the named reconciled/filter/current/past/future UI and core fixtures. The verifier checks the documented fixture exactly: €3,000.00 income, €1,300.00 actual expense, €1,700.00 balance; category and account rows each sum to €1,300.00; the three/six/twelve-month averages are €600.00/€300.00/€150.00; the combined owner/account/category filter leaves €300.00 expense; a past month has no forecast; and a future month returns HTTP 400.

Run `pnpm ops:verify --id OPS-FF-FOR-001-01` to execute the named current, past, future, and planned-to-booked forecast fixtures. The current fixture verifies €1,000.00 booked fixed, €500.00 open planned fixed, €930.00 extrapolated variable, and €2,430.00 total; the past fixture shows actuals without a forecast, and the future fixture is rejected. After booking the €500.00 planned item on the same transaction ID, booked fixed becomes €1,500.00, open planned becomes zero, actual expense becomes €1,800.00, and the forecast total remains €2,430.00. Any different value fails the verifier; investigate rather than adjusting the fixture to production data.

## Template Packaging And Rendering

Dashboard and authentication, master data, categorization rules, CSV import, income, and transaction responses are rendered through named `@fastify/view` methods from globally autoescaped Nunjucks templates. Source execution (`pnpm dev` and `pnpm dev:oidc`) always loads `src/views`, even when a previous build left `dist/views` in the worktree. `pnpm build` copies layouts, pages, and fragments recursively to `dist/views`; compiled execution and the production image load that packaged directory.

Packaging verification:

1. Install the locked dependencies with `pnpm install --frozen-lockfile`.
2. Run `pnpm build` from the repository root.
3. Run `find dist/views -type f -name '*.njk' -print` and verify the `layouts/app.njk`, declared `pages/*.njk`, and income/transaction `partials/*.njk` inventory.
4. For image-facing changes, run `pnpm exec playwright test tests/e2e/image-smoke.test.ts --reporter=line`. The smoke fixture requires Docker, starts isolated PostgreSQL and application containers, authenticates in test mode, and checks representative full pages, income and transaction HTMX fragments, and escaped transaction content.

If a compiled template is absent, inspect the recursive copy in the `build` script and rerun the build from a clean checkout; do not copy templates into a running production container. If startup reports a missing template, verify that the deployed immutable image contains `/app/dist/views`, roll back to the previous known-good image, and rebuild rather than editing the container. If an HTMX replacement fails, verify that transaction responses retain `id="transactions-list"` or `id="transactions-panel"` and income create, edit, validation, and filter responses retain `id="income-panel"`; fragment responses must not contain a full document. Repeat the failing transaction or income operation with JavaScript disabled: the equivalent form must redirect after success or render a shared-layout validation page, which distinguishes server-side progressive-enhancement failures from HTMX targeting failures.

Run `pnpm arch:check` after template edits. The checker removes Nunjucks expression, control, and comment tokens before inspecting the remaining text-node and user-visible attribute content, so a literal mixed before, between, or after dynamic tokens is still prohibited. This includes accessible labels and descriptions, placeholders, titles, alternative text, and `hx-confirm` or `hx-prompt` messages; move such text into the prepared view model rather than hiding it among controls. Expression-only, control-only, and whitespace-only display content remains valid. Disabled autoescaping, `safe`, calculations, imports, calls, repository access, and use-case access are also prohibited.

## Static Assets And HTMX

The app serves its own UI assets from `/assets/`.

Current assets:

- `/assets/app.css`: application stylesheet for all server-rendered pages.
- `/assets/htmx.min.js`: local `htmx.org` runtime used by transaction interactions.

Operational notes:

- HTML responses must not include inline `style` attributes. Use stable IDs and CSS classes, then add styling in `/assets/app.css`.
- Transaction create, delete, and filter interactions progressively enhance normal forms with HTMX. They must keep working as normal requests when JavaScript is disabled.
- If an HTMX interaction does not update the page, inspect the browser network request for `HX-Request: true`, verify that the response is an HTML fragment, and use the `X-Request-Id` response header to find the matching request log entry.
- Asset requests are public so browsers can load CSS and JavaScript before or during authentication redirects. Do not place secrets or user-specific financial data in static assets.

## Backup 

PostgreSQL is the durable store for master data, transactions, import configuration and previews, categorization rules, income plans and overrides, and security-sensitive sessions. Back up the complete database rather than selected tables.

Use a short maintenance mode so the dump and its separately collected evidence describe the same database state. Announce the interruption, stop external traffic at the reverse proxy, and wait for in-flight requests to finish before stopping the app. Confirm that no other maintenance client or integration can write directly to PostgreSQL; this procedure is unsafe while any writer other than the stopped app remains active. Keep external traffic closed until the final health check succeeds.

From a trusted host in the repository root, run the following commands. The `trap` attempts to start the app whenever the shell exits, including after a failed command; it deliberately does not reopen external traffic. The two evidence captures prove that no data changed while `pg_dump` ran.

```sh
set -eu
umask 077
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="/var/backups/family-flow/$STAMP"
DUMP="$BACKUP_DIR/family-flow.dump"
MANIFEST="$BACKUP_DIR/manifest.txt"
EVIDENCE_BEFORE="$BACKUP_DIR/evidence-before.json"
EVIDENCE_AFTER="$BACKUP_DIR/evidence-after.json"
mkdir -p "$BACKUP_DIR"

restart_app() {
  docker compose -f compose.prod.yaml up --detach --no-deps app
}
trap restart_app EXIT

docker compose -f compose.prod.yaml stop app
docker compose -f compose.prod.yaml ps --status running --services | grep -Fx app && {
  printf 'The app is still running; aborting backup.\n' >&2
  exit 1
}

docker compose -f compose.prod.yaml exec -T postgres \
  psql -X -U family_flow -d family_flow -At -v ON_ERROR_STOP=1 \
  <scripts/recovery-evidence.sql >"$EVIDENCE_BEFORE"
docker compose -f compose.prod.yaml exec -T postgres \
  pg_dump -U family_flow -d family_flow --format=custom --no-owner --no-privileges >"$DUMP"
docker compose -f compose.prod.yaml exec -T postgres \
  psql -X -U family_flow -d family_flow -At -v ON_ERROR_STOP=1 \
  <scripts/recovery-evidence.sql >"$EVIDENCE_AFTER"
# Compare the snapshots before accepting the dump.
cmp "$EVIDENCE_BEFORE" "$EVIDENCE_AFTER"

{
  printf 'created_at=%s\n' "$STAMP"
  printf 'app_image_id=%s\n' "$(docker compose -f compose.prod.yaml images -q app)"
  printf 'database_evidence='
  cat "$EVIDENCE_BEFORE"
  sha256sum "$DUMP"
} >"$MANIFEST"
sha256sum "$MANIFEST" >"$MANIFEST.sha256"
sha256sum --check "$MANIFEST.sha256"
grep -F "$(sha256sum "$DUMP")" "$MANIFEST"
pg_restore --list "$DUMP" >/dev/null
rm "$EVIDENCE_BEFORE" "$EVIDENCE_AFTER"

restart_app
trap - EXIT
curl --fail --silent --show-error http://127.0.0.1:3000/health >/dev/null
```

If stopping the app, either evidence command, `pg_dump`, or `cmp` fails, reject the incomplete backup directory. Let the trap start the app, diagnose the failure while traffic remains closed, require a successful local `/health` response with `X-Request-Id`, and only then reopen external traffic. After the complete command succeeds, reopen traffic and monitor app and PostgreSQL logs. Record the maintenance window with the backup timestamp.

The maintained `scripts/recovery-evidence.sql` command is the authoritative, content-minimized database inventory used by this runbook and the recovery smoke test. It records ordered `schema_migrations`, row counts for every application table, signed minor-unit totals for transactions, income plans, and monthly overrides, relationship IDs and orphan counts, seed IDs and edited labels, and active states. It does not include session tokens, transaction descriptions, or other row content. A backup is complete only after both evidence captures compare equal, the manifest checksum, the dump checksum recorded in the manifest, and `pg_restore --list` all succeed.

Copy the dump, manifest, and manifest checksum together to encrypted storage outside the Compose host. Keep at least 7 daily, 5 weekly, and 12 monthly sets, subject to the household's agreed data-retention policy. Delete an expired set as one unit and record the deletion; never retain a manifest without its dump or vice versa. Run the focused recovery drill with `pnpm ops:verify --id OPS-FF-OPS-002-01` after backup-procedure or PostgreSQL changes.

## Restore 

Treat the source dump and its manifest as one recovery unit. Restore in this order:

1. Verify both SHA-256 checksums, review the manifest's image and migration versions, and run `pg_restore --list`. If any check fails, reject that backup. Take and retain a pre-restore safety backup of the current database for rollback.
2. Stop external traffic at the reverse proxy, stop the app with `docker compose -f compose.prod.yaml stop app`, and confirm no application traffic can reach PostgreSQL. Keep traffic closed through reconciliation and token validation.
3. Restore a PostgreSQL dump with `docker compose -f compose.prod.yaml exec -T postgres pg_restore -U family_flow -d family_flow --clean --if-exists --no-owner --no-privileges --exit-on-error < "$DUMP"`. A non-zero exit aborts the recovery.
4. While the app remains stopped, run `docker compose -f compose.prod.yaml run --rm --no-deps app node dist/app/session-invalidate.js` and require success. This compiled entry point applies pending migrations and revokes every restored session.
5. Repeat `docker compose -f compose.prod.yaml run --rm --no-deps app node dist/app/session-cleanup.js --limit 1000` until it reports `0 row(s)`. Never bypass either session command.
6. Run the same maintained evidence command while the app is stopped: `docker compose -f compose.prod.yaml exec -T postgres psql -X -U family_flow -d family_flow -At -v ON_ERROR_STOP=1 <scripts/recovery-evidence.sql`. Compare ordered migrations, every non-session table count and ID, all three monetary totals, foreign-key relationships, seed inventory and edited labels, and active states with `database_evidence` in the manifest. Every orphan count must be zero. The restored session count and IDs may differ only after the mandatory invalidation step. Investigate any other difference instead of editing the manifest.
7. Start the app in a fresh container with `docker compose -f compose.prod.yaml up --detach --no-deps --force-recreate app` so idempotent seeds run and stale process/network state is not reused, but keep proxy traffic closed. Run `scripts/recovery-evidence.sql` again and repeat the complete comparison from step 6, explicitly rechecking all three monetary totals, migration inventory, edited labels, active states, seed inventory, and zero orphan counts after startup. Require a successful local `/health` response with `X-Request-Id`.
8. Validate that a session cookie captured before backup is rejected: `/transactions` must redirect to `/auth/login`. Only then reopen traffic and monitor app and PostgreSQL logs.

If restore, migration, invalidation, cleanup, reconciliation, health, or token validation fails, keep traffic closed. Preserve the failed database for diagnosis, stop the app, and roll back by restoring the pre-restore safety dump with the same ordered procedure, including compiled session invalidation and cleanup. Start the prior compatible immutable image when the recovered manifest requires it, repeat reconciliation and health/token checks, and reopen traffic only after they pass. Retain the failed dump, manifests, command output, and pre-restore safety backup until the incident is resolved; then apply the normal encrypted retention schedule.

Run `pnpm ops:verify --id OPS-FF-OPS-003-01` to exercise the restored-session safety sequence. These smoke verifiers use disposable Compose projects; they do not replace a scheduled restore drill against an operator-controlled recovery host.

## Debugging

- Use `docker compose ps` to inspect service state.
- Use `docker compose logs app` to inspect application output.
- Use `docker compose logs postgres` to inspect PostgreSQL output.
- Use `/health` to verify that the application process is reachable.
- Use `/admin/master-data` to verify that account and category seeds are visible.
- Every HTTP response contains an `X-Request-Id` header. Rendered resource, validation, authentication, and unexpected-error responses also display it. Use this value to find the matching request log entry.
- Send exactly one lowercase canonical UUIDv4 in `X-Request-Id` to preserve a caller-provided correlation ID. Missing, repeated, uppercase, or malformed values are replaced with a generated UUIDv4.

## OIDC/Auth Problems

Check these items when login fails:

- Confirm `BASE_URL` exactly matches the external URL used in Authentik redirect URIs.
- Confirm `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET` match the Authentik provider.
- Confirm the browser reaches the app through HTTPS when `BASE_URL` is HTTPS, because session cookies are marked `Secure` in that case.
- Use the visible `X-Request-Id` response header to find the matching request log entry.
- Check Authentik logs for denied redirect URIs, invalid client credentials, or provider errors.

Never log OIDC tokens, session cookies, client secrets, or complete callback URLs containing secret-like query values. Request logs omit all query parameters except the explicit diagnostic allowlist; values such as `code`, `state`, and `token` are absent rather than retained as redaction placeholders.

## CSV Import Problems

Authenticated users can import expense CSV files at `/imports/csv`.

Supported import flow:

- Select an import account.
- Select comma, semicolon, or tab delimiter; `UTF-8` or `Latin1` encoding; one of the three date formats; and comma- or dot-decimal amounts.
- Map date, amount, description, and optional payee, purpose, and category columns.
- Save reusable custom import profiles without bank-specific default data. Saving a manual mapping creates a new profile; loading and saving an existing profile updates that profile in place. A submitted profile ID that no longer exists is rejected and creates no profile.
- Preview normalized rows before writing transactions. Importable rows are kept separate from ignored non-expenses and invalid required values.
- Confirm the preview with the opaque server-generated batch ID to store non-duplicate expenses. Browser-submitted transaction values are never used for confirmation.

Operational notes:

- Only expense rows are imported. Zero amounts and positive amounts receive the deterministic `amount-not-negative` ignored outcome. Invalid dates, amounts, and missing descriptions remain line-aware invalid outcomes and cannot be confirmed.
- Supported date formats are `DD.MM.YY`, `DD.MM.YYYY`, and `YYYY-MM-DD`; dates must also exist in the Gregorian calendar.
- Comma-decimal amounts allow optional dot grouping, and dot-decimal amounts allow optional comma grouping. Grouped integer segments after the first must contain exactly three digits. Conversion to minor units is exact; values outside JavaScript's safe-integer range are line-aware `invalid-amount` outcomes.
- Preview batches are persisted in PostgreSQL with immutable profile/outcome snapshots, bound to the authenticated user and selected account, expire after 30 minutes, and are single-use. Every stored outcome retains its CSV line and canonical reason (or `null` for importable rows), and the complete snapshot shape is validated when loaded. Confirmation consumes the batch and inserts every accepted transaction in one database transaction; a failure rolls back both operations and permits a safe retry.
- New duplicate identities use `v3:` SHA-256 hashes with NFKC normalization and UTF-8 length-framed fields for account, date, amount, description, payee, and purpose. Null and blank purpose normalize identically.
- Duplicate lookup recognizes immutable historical unprefixed v1 and prefixed v2 hashes only when the persisted transaction purpose normalizes to the candidate row's purpose. This compatibility prevents a historical purpose-less hash from collapsing current rows with distinct purposes. Operators must not rewrite existing hashes manually.
- PostgreSQL enforces account-scoped import-hash uniqueness, including during concurrent confirmations.
- Multipart requests may be at most 6 MiB, the extracted CSV at most 5 MiB, and files at most 10,000 data rows. Each exact limit is accepted. Binary/NUL data, malformed UTF-8 or quotes, inconsistent columns, missing mapped headers, and unsupported profile options reject the whole file.
- Category matching uses exact normalized names when a category column is mapped; unmatched rows are checked against categorization rules before falling back to `Sonstiges`.
- If an import fails, reproduce the problem with a minimized CSV containing only representative rows. Do not log or paste complete bank exports.
- Use the visible `X-Request-Id` response header to find the matching request log entry in `docker compose logs app`.

Migration `0012_csv_security_atomicity.sql` first validates all historical import-profile options and required mappings. Unknown delimiters, encodings, date/decimal formats, kinds, or blank required fields abort the migration with every affected profile ID, this runbook reference, and remediation instructions. Correct the listed profile records deliberately and rerun `pnpm db:migrate`; the failed migration transaction leaves them unchanged.

Migration `0012_csv_security_atomicity.sql` validates every historical non-null import hash before creating the original unique index. It accepts lowercase 64-character v1 and `v2:` values and aborts on malformed values or an account/hash collision.

Migration `0013_csv_import_purpose_identity.sql` introduces the purpose-aware v3 identity contract. Before any mutation it accepts only exact lowercase v1, `v2:`, or `v3:` grammar and rejects account/hash collisions, reporting account, hash, transaction identifiers, and this runbook reference. On abort: keep the database backup, inspect the reported identifiers, correct source records deliberately, and rerun `pnpm db:migrate`; the migration transaction preserves hashes, financial records, and preview batches. On success it never rewrites transaction hashes or financial records. It deletes only unconsumed preview batches because their server-stored outcomes contain pre-v3 hashes; consumed audit rows remain. Users whose preview was invalidated must upload and preview the CSV again.

## Log Analysis

Every HTTP request writes exactly one human-readable request log entry to stdout. Docker logs are the primary log source.

Request log entries include the request ID, timestamp, method, path, allowlisted query diagnostics, final status code, duration, user context when available, outcome, and safe structured error details when available. Authenticated requests record the stable user ID, not session cookie contents or OIDC tokens. Failure details contain only a controlled `type` and generic `message`; raw validation and exception messages are not serialized.

Only canonical UUIDv4 `transactionId` values and bounded integer `rowCount` values from 0 through 10,000 are retained. All other query fields, including `month`, are omitted. Session cookies, authorization headers, OIDC values, uploaded CSV content, descriptions, payees, purposes, notes, amounts, validation details, raw exceptions, and unnecessary financial details must not be logged.

Use `docker compose logs app` and search for `request_id=<value>` to correlate a user-visible request ID with the server-side log entry. There must be exactly one final line for the ID and its status/outcome must match the response. If a sensitive value appears, restrict access to the captured output, treat it as a data exposure incident, and roll back to the prior logging implementation while the source is corrected.
