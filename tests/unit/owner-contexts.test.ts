import { describe, expect, it } from "vitest";

import { createOwnerContextLabel, ownerContexts } from "../../src/core/shared/owner-context.js";

describe("owner context labels", () => {
  it("keeps stable owner keys separate from editable labels", () => {
    expect(ownerContexts).toEqual(["person_a", "person_b", "shared"]);

    expect(createOwnerContextLabel({ ownerContext: "person_a", label: " Daniel " })).toEqual({
      ownerContext: "person_a",
      label: "Daniel",
    });
  });

  it("rejects empty labels and invalid owner keys", () => {
    expect(() => createOwnerContextLabel({ ownerContext: "person_x", label: "Other" })).toThrow(
      "Owner context must be person_a, person_b or shared",
    );
    expect(() => createOwnerContextLabel({ ownerContext: "shared", label: " " })).toThrow(
      "Owner context label is required",
    );
  });
});
