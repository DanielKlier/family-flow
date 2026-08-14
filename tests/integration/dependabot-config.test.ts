import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Dependabot configuration", () => {
  it.each(["npm", "docker", "docker-compose"])(
    "schedules weekly root updates for the %s ecosystem",
    async (ecosystem) => {
      const configuration = await readFile(".github/dependabot.yml", "utf8");
      const updateEntry = new RegExp(
        `- package-ecosystem: "${ecosystem}"\\n` +
          `\\s+directory: "/"[^\\n]*\\n` +
          `\\s+schedule:\\n` +
          `\\s+interval: "weekly"`,
      );

      expect(configuration).toMatch(/^version: 2$/m);
      expect(configuration).toMatch(updateEntry);
    },
  );

  it("configures only the supported project dependency ecosystems", async () => {
    const configuration = await readFile(".github/dependabot.yml", "utf8");

    expect(configuration.match(/^\s*-\s+package-ecosystem:/gm)).toHaveLength(3);
  });
});
