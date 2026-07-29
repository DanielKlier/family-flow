export const ownerContexts = ["person_a", "person_b", "shared"] as const;

export type OwnerContext = (typeof ownerContexts)[number];

export function parseOwnerContext(value: string): OwnerContext {
  if (value === "person_a" || value === "person_b" || value === "shared") {
    return value;
  }

  throw new Error("Owner context must be person_a, person_b or shared");
}
