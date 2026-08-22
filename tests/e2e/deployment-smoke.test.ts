import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test } from "@playwright/test";

const smokeTimeoutMs = 180_000;
const composeFile = resolve("compose.yaml");
const migrationDirectory = resolve("drizzle");
const fixtureDirectory = resolve("tests/fixtures");
const proxyNetwork = "proxy";
const projectPrefix = `family-flow-deployment-smoke-${process.pid}`;

test.describe.configure({ mode: "serial" });
test.setTimeout(smokeTimeoutMs);

type SmokeEnvironment = {
  project: string;
  directory: string;
  envFile: string;
  overrideFile: string;
  ownsProxyNetwork: boolean;
};

function docker(arguments_: string[]): string {
  return execFileSync("docker", arguments_, { encoding: "utf8", stdio: "pipe" });
}

function compose(environment: SmokeEnvironment, arguments_: string[]): string {
  return docker([
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
  ]);
}

async function createEnvironment(
  name: string,
  baseUrl = "https://finances.home.arpa",
): Promise<SmokeEnvironment> {
  const directory = await mkdtemp(join(tmpdir(), `${projectPrefix}-${name}-`));
  const project = `${projectPrefix}-${name}`;
  const envFile = join(directory, ".env");
  const overrideFile = join(directory, "compose.override.yaml");
  const networks = docker(["network", "ls", "--format", "{{.Name}}"]).split("\n").filter(Boolean);
  const ownsProxyNetwork = !networks.includes(proxyNetwork);
  if (ownsProxyNetwork) docker(["network", "create", proxyNetwork]);

  await writeFile(
    envFile,
    [
      `BASE_URL=${baseUrl}`,
      "AUTH_MODE=oidc",
      "OIDC_ISSUER_URL=https://oidc:8080",
      "OIDC_CLIENT_ID=smoke-client",
      "OIDC_CLIENT_SECRET=synthetic-placeholder",
    ].join("\n"),
  );
  await writeFile(
    overrideFile,
    [
      "services:",
      "  app:",
      "    environment:",
      "      NODE_EXTRA_CA_CERTS: /app/test-ca/fake-oidc.crt",
      "    volumes:",
      `      - "${join(fixtureDirectory, "fake-oidc.crt")}:/app/test-ca/fake-oidc.crt:ro"`,
      "    ports:",
      '      - "127.0.0.1::3000"',
    ].join("\n"),
  );
  return { project, directory, envFile, overrideFile, ownsProxyNetwork };
}

async function cleanup(environment: SmokeEnvironment): Promise<void> {
  try {
    compose(environment, ["down", "--volumes", "--remove-orphans"]);
  } catch {
    // Cleanup must remain project-scoped when startup fails.
  }
  if (environment.ownsProxyNetwork) {
    try {
      docker(["network", "rm", proxyNetwork]);
    } catch {
      // The network may still be in Docker's asynchronous removal phase.
    }
  }
  await rm(environment.directory, { recursive: true, force: true });
}

async function waitForPostgres(environment: SmokeEnvironment): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if (
        compose(environment, [
          "exec",
          "-T",
          "postgres",
          "pg_isready",
          "-U",
          "family_flow",
          "-d",
          "family_flow",
        ])
      ) {
        return;
      }
    } catch {
      // PostgreSQL is still initializing its empty volume.
    }
    await new Promise((resolve_) => setTimeout(resolve_, 1_000));
  }
  throw new Error("Compose PostgreSQL did not become ready");
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
      // Startup migrations, seed data, or session cleanup may still be running.
    }
    await new Promise((resolve_) => setTimeout(resolve_, 1_000));
  }
  throw new Error("Compose app did not become healthy after startup work");
}

function appBaseUrl(environment: SmokeEnvironment): string {
  const address = compose(environment, ["port", "app", "3000"]).trim().split("\n").at(0);
  if (address === undefined) throw new Error("Compose app did not publish port 3000");
  return `http://${address}`;
}

function migrationNames(): Promise<string[]> {
  return readdir(migrationDirectory).then((names) =>
    names.filter((name) => name.endsWith(".sql")).sort(),
  );
}

function recordedMigrations(environment: SmokeEnvironment): string[] {
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
    "select name from schema_migrations order by name",
  ])
    .split("\n")
    .filter(Boolean);
}

async function startOidcProvider(environment: SmokeEnvironment): Promise<void> {
  docker([
    "run",
    "--detach",
    "--name",
    `${environment.project}-oidc`,
    "--network",
    proxyNetwork,
    "--network-alias",
    "oidc",
    "--mount",
    `type=bind,src=${join(fixtureDirectory, "fake-oidc-server.mjs")},dst=/app/server.mjs,readonly`,
    "--mount",
    `type=bind,src=${join(fixtureDirectory, "fake-oidc.crt")},dst=/app/tls/oidc.crt,readonly`,
    "--mount",
    `type=bind,src=${join(fixtureDirectory, "fake-oidc.key")},dst=/app/tls/oidc.key,readonly`,
    "--env",
    "ISSUER_URL=https://oidc:8080",
    "node:24-alpine",
    "node",
    "/app/server.mjs",
  ]);
}

async function loginOidcUser(baseUrl: string, subject: string): Promise<string> {
  const login = await fetch(`${baseUrl}/auth/login`, { redirect: "manual" });
  const authorizationUrl = new URL(login.headers.get("location") ?? "http://invalid");
  const state = authorizationUrl.searchParams.get("state");
  const nonce = authorizationUrl.searchParams.get("nonce");
  const callback = await fetch(
    `${baseUrl}/auth/callback?code=${encodeURIComponent(`${subject}:${nonce ?? ""}`)}&state=${encodeURIComponent(state ?? "")}`,
    { redirect: "manual" },
  );
  const cookie = callback.headers
    .getSetCookie()
    .find((value) => value.startsWith("ff_session="))
    ?.split(";", 1)[0];
  if (callback.status !== 302 || cookie === undefined) {
    throw new Error("Smoke OIDC login must establish a session");
  }
  return cookie;
}

function stopOidcProvider(environment: SmokeEnvironment): void {
  try {
    docker(["rm", "--force", `${environment.project}-oidc`]);
  } catch {
    // The disposable provider was not started.
  }
}

async function prepareOldestMigrationSet(environment: SmokeEnvironment): Promise<string> {
  const oldest = (await migrationNames()).at(0);
  if (oldest === undefined) throw new Error("Expected at least one bundled migration");
  const fixtureMigrations = join(environment.directory, "oldest-migration");
  await mkdir(fixtureMigrations);
  await writeFile(
    join(fixtureMigrations, oldest),
    await readFile(join(migrationDirectory, oldest)),
  );
  return oldest;
}

test("SMOKE-FF-SCP-003-01 two OIDC identities can update every owner label without reassigning accounts", async () => {
  const environment = await createEnvironment("owner-context-access");
  try {
    await startOidcProvider(environment);
    compose(environment, ["up", "--build", "--detach"]);
    const baseUrl = appBaseUrl(environment);
    await waitForHealth(baseUrl);
    const cookies = await Promise.all([
      loginOidcUser(baseUrl, "fixture-owner-a"),
      loginOidcUser(baseUrl, "fixture-owner-b"),
    ]);

    for (const [index, cookie] of cookies.entries()) {
      const masterData = await fetch(`${baseUrl}/admin/master-data`, {
        headers: { Cookie: cookie },
      });
      expect(masterData.status).toBe(200);
      for (const ownerContext of ["person_a", "person_b", "shared"]) {
        const update = await fetch(`${baseUrl}/admin/master-data/owner-contexts/${ownerContext}`, {
          method: "POST",
          headers: {
            Cookie: cookie,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ label: `${ownerContext} user ${index + 1}` }),
          redirect: "manual",
        });
        expect(update.status).toBe(302);
      }
    }

    for (const cookie of cookies) {
      const body = await (
        await fetch(`${baseUrl}/admin/master-data`, { headers: { Cookie: cookie } })
      ).text();
      for (const ownerContext of ["person_a", "person_b", "shared"]) {
        expect(body).toContain(`${ownerContext} user 2`);
      }
    }
    expect(
      compose(environment, [
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
        "select owner_context from accounts order by id",
      ])
        .split("\n")
        .filter(Boolean),
    ).toEqual(["person_a", "person_b", "shared"]);
  } finally {
    stopOidcProvider(environment);
    await cleanup(environment);
  }
});

test("SMOKE-FF-SCP-001-01 empty Compose DB becomes healthy only after all bundled migrations", async () => {
  const environment = await createEnvironment("empty");
  try {
    await startOidcProvider(environment);
    compose(environment, ["up", "--build", "--detach"]);
    const baseUrl = appBaseUrl(environment);
    await waitForHealth(baseUrl);

    expect(compose(environment, ["ps", "postgres", "--format", "json"])).toContain('"healthy"');
    expect(recordedMigrations(environment)).toEqual(await migrationNames());
  } finally {
    stopOidcProvider(environment);
    await cleanup(environment);
  }
});

test("SMOKE-FF-DEP-002-01 normal Compose startup upgrades the earliest supported schema before health", async () => {
  const environment = await createEnvironment("historical-update");
  try {
    const oldest = await prepareOldestMigrationSet(environment);
    compose(environment, ["up", "--build", "--detach", "postgres"]);
    await waitForPostgres(environment);
    const migrationsPath = join(environment.directory, "oldest-migration");
    compose(environment, [
      "run",
      "--rm",
      "--no-deps",
      "--entrypoint",
      "node",
      "--volume",
      `${migrationsPath}:/migrations:ro`,
      "app",
      "--input-type=module",
      "--eval",
      "import { migrate } from './dist/adapters/db/migrate.js'; await migrate(process.env.DATABASE_URL, '/migrations');",
    ]);
    expect(recordedMigrations(environment)).toEqual([oldest]);

    await startOidcProvider(environment);
    compose(environment, ["up", "--detach", "app"]);
    await waitForHealth(appBaseUrl(environment));
    expect(recordedMigrations(environment)).toEqual(await migrationNames());
  } finally {
    stopOidcProvider(environment);
    await cleanup(environment);
  }
});

test("SMOKE-FF-SCP-001-02 external BASE_URL keeps the OIDC callback HTTPS and state server-side", async () => {
  const environment = await createEnvironment("external-login", "https://finances.home.arpa");
  try {
    await startOidcProvider(environment);
    compose(environment, ["up", "--build", "--detach"]);
    const baseUrl = appBaseUrl(environment);
    await waitForHealth(baseUrl);
    const response = await fetch(`${baseUrl}/auth/login`, { redirect: "manual" });
    const location = response.headers.get("location");
    const stateCookie = response.headers.get("set-cookie");

    expect(response.status).toBe(302);
    expect(location).toBeTruthy();
    expect(new URL(location ?? "http://invalid").searchParams.get("redirect_uri")).toBe(
      "https://finances.home.arpa/auth/callback",
    );
    expect(stateCookie).toBeNull();
  } finally {
    stopOidcProvider(environment);
    await cleanup(environment);
  }
});

test("SMOKE-FF-DEP-003-01 external HTTPS links, logout, and session use the external origin", async () => {
  const externalBaseUrl = "https://finances.home.arpa";
  const environment = await createEnvironment("external-logout", externalBaseUrl);
  try {
    await startOidcProvider(environment);
    compose(environment, ["up", "--build", "--detach"]);
    const baseUrl = appBaseUrl(environment);
    await waitForHealth(baseUrl);
    const login = await fetch(`${baseUrl}/auth/login`, { redirect: "manual" });
    const authorizationUrl = new URL(login.headers.get("location") ?? "http://invalid");
    const state = authorizationUrl.searchParams.get("state");
    const nonce = authorizationUrl.searchParams.get("nonce");
    expect(state).toBeTruthy();
    expect(nonce).toBeTruthy();

    const callback = await fetch(`${baseUrl}/auth/callback?code=${nonce}&state=${state}`, {
      redirect: "manual",
    });
    const sessionCookie = callback.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith("ff_session="));
    expect(callback.status).toBe(302);
    expect(sessionCookie).toContain("Secure");

    const dashboard = await fetch(`${baseUrl}/`, {
      headers: { Cookie: sessionCookie?.split(";", 1)[0] ?? "" },
    });
    const dashboardHtml = await dashboard.text();
    const renderedHrefs = [...dashboardHtml.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    expect(dashboard.status).toBe(200);
    expect(renderedHrefs.length).toBeGreaterThan(0);
    expect(dashboardHtml).not.toContain(baseUrl);
    for (const href of renderedHrefs) {
      expect(new URL(href, externalBaseUrl).origin).toBe(externalBaseUrl);
    }

    const logout = await fetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: sessionCookie?.split(";", 1)[0] ?? "",
        Origin: externalBaseUrl,
      },
      redirect: "manual",
    });
    expect(logout.status).toBe(302);
    expect(logout.headers.get("set-cookie")).toContain("Secure");
    expect(
      new URL(logout.headers.get("location") ?? "http://invalid").searchParams.get(
        "post_logout_redirect_uri",
      ),
    ).toBe(`${externalBaseUrl}/auth/login`);
  } finally {
    stopOidcProvider(environment);
    await cleanup(environment);
  }
});
