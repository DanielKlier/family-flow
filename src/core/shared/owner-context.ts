export const ownerContexts = ["person_a", "person_b", "shared"] as const;

export type OwnerContext = (typeof ownerContexts)[number];

export function parseOwnerContext(value: string): OwnerContext {
  if (ownerContexts.includes(value as OwnerContext)) {
    return value as OwnerContext;
  }

  throw new Error("Owner context must be person_a, person_b or shared");
}
