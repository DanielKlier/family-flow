export const ownerContexts = ["person_a", "person_b", "shared"] as const;

export type OwnerContext = (typeof ownerContexts)[number];

export type OwnerContextLabel = {
  ownerContext: OwnerContext;
  label: string;
};

export const defaultOwnerContextLabels: OwnerContextLabel[] = [
  { ownerContext: "person_a", label: "Person A" },
  { ownerContext: "person_b", label: "Person B" },
  { ownerContext: "shared", label: "Shared" },
];

export function parseOwnerContext(value: string): OwnerContext {
  if (value === "person_a" || value === "person_b" || value === "shared") {
    return value;
  }

  throw new Error("Owner context must be person_a, person_b or shared");
}

export function createOwnerContextLabel(input: {
  ownerContext: string;
  label: string;
}): OwnerContextLabel {
  const label = input.label.trim();
  if (label === "") {
    throw new Error("Owner context label is required");
  }

  return {
    ownerContext: parseOwnerContext(input.ownerContext),
    label,
  };
}

export function ownerContextLabelMap(labels: OwnerContextLabel[]): Record<OwnerContext, string> {
  return Object.fromEntries(labels.map((label) => [label.ownerContext, label.label])) as Record<
    OwnerContext,
    string
  >;
}
