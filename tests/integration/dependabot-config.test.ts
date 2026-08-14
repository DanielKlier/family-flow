import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Dependabot configuration", () => {
  it("schedules weekly npm version updates for root pnpm dependencies", async () => {
    const configuration = await readFile(".github/dependabot.yml", "utf8");

    expect(configuration).toMatch(/^version: 2$/m);
    expect(configuration.match(/^\s*-\s+package-ecosystem:/gm)).toHaveLength(1);
    expect(configuration).toMatch(
      /package-ecosystem: "npm"[\s\S]*directory: "\/"[\s\S]*interval: "weekly"/,
    );
  });
});
