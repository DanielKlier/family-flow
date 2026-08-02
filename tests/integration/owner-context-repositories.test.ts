import { describe, expect, it } from "vitest";

import { InMemoryOwnerContextRepository } from "../../src/adapters/db/in-memory-owner-context-repository.js";

describe("owner context repositories", () => {
  it("stores editable labels while preserving stable owner keys", async () => {
    const repository = new InMemoryOwnerContextRepository();

    await repository.save({ ownerContext: "person_a", label: "Daniel" });

    await expect(repository.list()).resolves.toEqual([
      { ownerContext: "person_a", label: "Daniel" },
      { ownerContext: "person_b", label: "Person B" },
      { ownerContext: "shared", label: "Shared" },
    ]);
    await expect(repository.get("person_a")).resolves.toEqual({
      ownerContext: "person_a",
      label: "Daniel",
    });
  });
});
