import type { OwnerContext, OwnerContextLabel } from "../../core/shared/owner-context.js";

export type OwnerContextRepository = {
  list(): Promise<OwnerContextLabel[]>;
  get(ownerContext: OwnerContext): Promise<OwnerContextLabel | null>;
  save(label: OwnerContextLabel): Promise<void>;
};
