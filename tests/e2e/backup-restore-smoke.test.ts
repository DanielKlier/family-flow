import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { operationRegistry } from "../../scripts/operations/registry.js";

const composeFile = resolve("compose.yaml");
const smokeTimeoutMs = 180_000;
const projectPrefix = `family-flow-backup-restore-${process.pid}`;
const proxyNetwork = "proxy";

test.describe.configure({ mode: "serial" });
test.setTimeout(smokeTimeoutMs);

type Environment = {
  directory: string;
  envFile: string;
  overrideFile: string;
  project: string;
  ownsProxyNetwork: boolean;
};

type RecoveryFixture = {
  environment: Environment;
  baseUrl: string;
  manifest: string;
  sessionCookie: string;
  dumpPath: string;
};

function docker(arguments_: string[], input?: string): string {
  return execFileSync("docker", arguments_, { encoding: "utf8", input, stdio: "pipe" });
}

function compose(environment: Environment, arguments_: string[], input?: string): string {
  return docker(
    [
      "compose",
      "--project-name",
      environment.project,
      "--env-file",
      environment.envFile,
      "-f",
      composeFile,
      "-f",
      environment.overrideFile,
      ...arguments_,
    ],
    input,
  );
}

async function createEnvironment(name: string): Promise<Environment> {
  const directory = await mkdtemp(join(tmpdir(), `${projectPrefix}-${name}-`));
  const networks = docker(["network", "ls", "--format", "{{.Name}}"]).split("\n");
  const ownsProxyNetwork = !networks.includes(proxyNetwork);
  if (ownsProxyNetwork) docker(["network", "create", proxyNetwork]);
  const environment = {
    directory,
    envFile: join(directory, ".env"),
    overrideFile: join(directory, "compose.override.yaml"),
    project: `${projectPrefix}-${name}`,
    ownsProxyNetwork,
  };
  await writeFile(
    environment.envFile,
    [
      "BASE_URL=http://127.0.0.1:3000",
      "AUTH_MODE=oidc",
      "OIDC_ISSUER_URL=http://unused-oidc:8080",
      "OIDC_CLIENT_ID=recovery-smoke",
      "OIDC_CLIENT_SECRET=synthetic-placeholder",
    ].join("\n"),
  );
  await writeFile(
    environment.overrideFile,
    ["services:", "  app:", "    ports:", '      - "127.0.0.1::3000"'].join("\n"),
  );
  return environment;
}

async function cleanup(environment: Environment | undefined): Promise<void> {
  if (environment === undefined) return;
  try {
    compose(environment, ["down", "--volumes", "--remove-orphans"]);
  } catch {
    // A failed disposable startup must not affect other Compose projects.
  }
  if (environment.ownsProxyNetwork) {
    try {
      docker(["network", "rm", proxyNetwork]);
    } catch {
      // Docker may still be removing the project network asynchronously.
    }
  }
  await rm(environment.directory, { recursive: true, force: true });
}

function appBaseUrl(environment: Environment): string {
  const address = compose(environment, ["port", "app", "3000"]).trim().split("\n")[0];
  if (!address) throw new Error("The disposable app did not publish its HTTP port");
  return `http://${address}`;
}

async function waitForHealth(baseUrl: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        expect(response.headers.get("x-request-id")).toBeTruthy();
        return;
      }
    } catch {
      // The app may still be applying migrations and seed data.
    }
    await new Promise((resolve_) => setTimeout(resolve_, 1_000));
  }
  throw new Error("The disposable app did not become healthy");
}

function database(environment: Environment, sql: string): string {
  return compose(environment, [
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "family_flow",
    "-d",
    "family_flow",
    "-At",
    "-c",
    sql,
  ]).trim();
}

function manifest(environment: Environment): string {
  // The manifest deliberately contains IDs, relationship columns, and signed totals, not dump data.
  return database(
    environment,
    `select json_build_object(
      'counts', json_build_object(
        'accounts', (select count(*) from accounts),
        'owner_context_labels', (select count(*) from owner_context_labels),
        'categories', (select count(*) from categories),
        'transactions', (select count(*) from transactions),
        'import_profiles', (select count(*) from import_profiles),
        'import_preview_batches', (select count(*) from import_preview_batches),
        'categorization_rules', (select count(*) from categorization_rules),
        'income_plans', (select count(*) from income_plans),
        'monthly_income_overrides', (select count(*) from monthly_income_overrides),
        'sessions', (select count(*) from sessions)),
      'transaction_total_cents', (select coalesce(sum(amount_cents), 0) from transactions),
      'income_total_cents', (select coalesce(sum(amount_cents), 0) from income_plans),
      'references', json_build_object(
        'transaction', (select json_agg(json_build_array(id, account_id, category_id) order by id) from transactions),
        'preview', (select json_agg(json_build_array(id, account_id) order by id) from import_preview_batches),
        'rule', (select json_agg(json_build_array(id, category_id, account_id) order by id) from categorization_rules),
        'override', (select json_agg(json_build_array(id, income_plan_id) order by id) from monthly_income_overrides)),
      'seed_edits', json_build_object(
        'account', (select name from accounts where id = 'account-person-a-checking'),
        'owner', (select label from owner_context_labels where owner_context = 'shared')),
      'ids', json_build_object(
        'accounts', (select json_agg(id order by id) from accounts),
        'categories', (select json_agg(id order by id) from categories),
        'profiles', (select json_agg(id order by id) from import_profiles),
        'sessions', (select json_agg(id order by id) from sessions)))::text;`,
  );
}

function seedRecoveryFixture(environment: Environment, token: string): void {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  database(
    environment,
    `update accounts set name = 'Recovered user account' where id = 'account-person-a-checking';
     update owner_context_labels set label = 'Recovered user owner' where owner_context = 'shared';
     insert into categories (id, name, normalized_name, active) values ('recovery-category', 'Recovery category', 'recovery category', true);
     insert into accounts (id, name, owner_context, active) values ('recovery-account', 'Recovery account', 'shared', true);
     insert into transactions (id, account_id, category_id, category_origin, date, amount_cents, description, source, status, fixed_cost, internal_transfer)
       values ('recovery-expense-a', 'recovery-account', 'recovery-category', 'manual', '2025-01-15', -125000, 'Recovery expense A', 'manual', 'booked', false, false),
              ('recovery-expense', 'recovery-account', 'recovery-category', 'manual', '2025-01-16', -4567, 'Recovery expense', 'manual', 'booked', true, false);
     insert into import_profiles (id, name, kind, delimiter, encoding, date_format, decimal_format, date_column, amount_column, description_column)
       values ('recovery-profile', 'Recovery profile', 'custom', ';', 'utf8', 'DD.MM.YYYY', 'comma-decimal', 'date', 'amount', 'description');
     insert into import_preview_batches (id, user_id, account_id, created_at, expires_at, profile_snapshot, outcome_snapshot)
       values ('recovery-preview', 'recovery-user', 'recovery-account', '2025-01-01T00:00:00Z', '2099-01-01T00:00:00Z', '{}'::jsonb, '{}'::jsonb);
     insert into categorization_rules (id, name, search_text, category_id, account_id, priority, enabled)
       values ('recovery-rule', 'Recovery rule', 'recovery', 'recovery-category', 'recovery-account', 10, true);
     insert into income_plans (id, owner_context, name, amount_cents, start_month, active)
       values ('recovery-income-plan', 'shared', 'Recovery plan', 250000, '2025-01', true);
     insert into monthly_income_overrides (id, income_plan_id, month, amount_cents, note)
       values ('recovery-income-override', 'recovery-income-plan', '2025-02', 275000, 'Recovery override');
     insert into sessions (id, token_hash, user_id, user_display_name, user_email, created_at, expires_at)
       values ('recovery-session', '${tokenHash}', 'recovery-user', 'Recovery User', 'recovery@example.test', '2025-01-01T00:00:00Z', '2099-01-01T00:00:00Z');`,
  );
}

async function restoreFixture(name: string): Promise<RecoveryFixture> {
  const environment = await createEnvironment(name);
  const token = "recovery-token-that-is-long-enough-to-be-a-session-token";
  try {
    compose(environment, ["up", "--build", "--detach"]);
    const baseUrl = appBaseUrl(environment);
    await waitForHealth(baseUrl);
    seedRecoveryFixture(environment, token);
    const sessionBeforeBackup = await fetch(`${baseUrl}/transactions`, {
      headers: { Cookie: `ff_session=${token}` },
      redirect: "manual",
    });
    expect(sessionBeforeBackup.status).toBe(200);

    const beforeRestore = manifest(environment);
    const dumpPath = join(environment.directory, "recovery.dump");
    compose(environment, [
      "exec",
      "-T",
      "postgres",
      "pg_dump",
      "-U",
      "family_flow",
      "-Fc",
      "-f",
      "/tmp/recovery.dump",
      "family_flow",
    ]);
    docker(["cp", `${environment.project}-postgres-1:/tmp/recovery.dump`, dumpPath]);
    compose(environment, ["stop", "app"]);
    database(
      environment,
      "truncate sessions, monthly_income_overrides, income_plans, categorization_rules, import_preview_batches, import_profiles, transactions, owner_context_labels, categories, accounts cascade;",
    );
    docker(["cp", dumpPath, `${environment.project}-postgres-1:/tmp/recovery.dump`]);
    compose(environment, [
      "exec",
      "-T",
      "postgres",
      "pg_restore",
      "-U",
      "family_flow",
      "-d",
      "family_flow",
      "--clean",
      "--if-exists",
      "/tmp/recovery.dump",
    ]);
    expect(manifest(environment)).toBe(beforeRestore);
    return {
      environment,
      baseUrl,
      manifest: beforeRestore,
      sessionCookie: `ff_session=${token}`,
      dumpPath,
    };
  } catch (error) {
    await cleanup(environment);
    throw error;
  }
}

test("SMOKE-FF-OPS-002-01 restores a complete PostgreSQL recovery manifest", async () => {
  // This is the executable operations contract: it must be dispatchable as a focused verifier.
  expect(operationRegistry["OPS-FF-OPS-002-01"]).toBeDefined();

  const fixture = await restoreFixture("full");
  try {
    expect(fixture.manifest).toBe(manifest(fixture.environment));
    expect(fixture.dumpPath).toMatch(/recovery\.dump$/);
  } finally {
    await cleanup(fixture.environment);
  }
});

test("SMOKE-FF-OPS-003-01 invalidates restored sessions before reopening traffic", async () => {
  expect(operationRegistry["OPS-FF-OPS-003-01"]).toBeDefined();

  const fixture = await restoreFixture("safe");
  try {
    compose(fixture.environment, [
      "run",
      "--rm",
      "--no-deps",
      "app",
      "node",
      "dist/app/session-invalidate.js",
    ]);
    compose(fixture.environment, [
      "run",
      "--rm",
      "--no-deps",
      "app",
      "node",
      "dist/app/session-cleanup.js",
      "--limit",
      "1000",
    ]);
    compose(fixture.environment, ["start", "app"]);
    await waitForHealth(fixture.baseUrl);
    const replay = await fetch(`${fixture.baseUrl}/transactions`, {
      headers: { Cookie: fixture.sessionCookie },
      redirect: "manual",
    });
    expect(replay.status).toBe(302);
    expect(replay.headers.get("location")).toBe("/auth/login?returnTo=%2Ftransactions");
  } finally {
    await cleanup(fixture.environment);
  }
});
