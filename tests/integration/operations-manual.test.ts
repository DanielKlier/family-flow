import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("operations manual", () => {
  it("documents categorization rule maintenance", async () => {
    const manual = await readFile("OPERATIONS.md", "utf8");

    expect(manual).toContain("## Categorization Rule Maintenance");
    expect(manual).toContain("/categorization-rules");
    expect(manual).toContain("Apply rules to existing transactions");
  });

  it("documents income planning maintenance", async () => {
    const manual = await readFile("OPERATIONS.md", "utf8");

    expect(manual).toContain("## Income Planning Maintenance");
    expect(manual).toContain("/income");
    expect(manual).toContain("Monthly overrides replace the recurring amount");
  });
});
