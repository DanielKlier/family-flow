import {
  createOwnerContextLabel,
  defaultOwnerContextLabels,
  type OwnerContext,
  type OwnerContextLabel,
  ownerContexts,
} from "../../core/shared/owner-context.js";
import type { OwnerContextRepository } from "../../ports/repositories/owner-context-repository.js";

export class InMemoryOwnerContextRepository implements OwnerContextRepository {
  readonly #labels = new Map<OwnerContext, OwnerContextLabel>();

  constructor(labels: OwnerContextLabel[] = defaultOwnerContextLabels) {
    for (const label of labels) {
      this.#labels.set(label.ownerContext, label);
    }
  }

  async list(): Promise<OwnerContextLabel[]> {
    return ownerContexts.map((ownerContext) => this.#labels.get(ownerContext)).filter(isLabel);
  }

  async get(ownerContext: OwnerContext): Promise<OwnerContextLabel | null> {
    return this.#labels.get(ownerContext) ?? null;
  }

  async save(label: OwnerContextLabel): Promise<void> {
    this.#labels.set(label.ownerContext, createOwnerContextLabel(label));
  }
}

function isLabel(label: OwnerContextLabel | undefined): label is OwnerContextLabel {
  return label !== undefined;
}
