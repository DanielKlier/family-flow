import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("local OIDC development compose", () => {
  it("configures Dex with the FamilyFlow development client", async () => {
    const [compose, dexConfig, devEnv] = await Promise.all([
      readFile("compose.dev.yaml", "utf8"),
      readFile("dev/dex/config.yaml", "utf8"),
      readFile(".env.dev", "utf8"),
    ]);

    expect(compose).toContain("dexidp/dex");
    expect(compose).toContain('"127.0.0.1:5556:5556"');
    expect(compose).toContain("./dev/dex/config.yaml:/etc/dex/config.yaml:ro");

    expect(dexConfig).toContain("issuer: http://127.0.0.1:5556/dex");
    expect(dexConfig).toContain("id: family-flow-dev");
    expect(dexConfig).toContain("secret: family-flow-dev-secret");
    expect(dexConfig).toContain("http://127.0.0.1:3000/auth/callback");
    expect(dexConfig).toContain("email: dev@example.invalid");

    expect(devEnv).toContain("BASE_URL=http://127.0.0.1:3000");
    expect(devEnv).toContain("AUTH_MODE=oidc");
    expect(devEnv).toContain("OIDC_ISSUER_URL=http://127.0.0.1:5556/dex");
    expect(devEnv).toContain("OIDC_CLIENT_ID=family-flow-dev");
    expect(devEnv).toContain("OIDC_CLIENT_SECRET=family-flow-dev-secret");
  });
});
