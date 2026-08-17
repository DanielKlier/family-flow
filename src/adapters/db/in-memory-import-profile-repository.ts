import type { ImportProfile } from "../../core/imports/import-profile.js";
import { compareCodePoints } from "../../core/shared/compare-code-points.js";
import type { ImportProfileRepository } from "../../ports/repositories/import-profile-repository.js";

export class InMemoryImportProfileRepository implements ImportProfileRepository {
  readonly #importProfiles = new Map<string, ImportProfile>();

  constructor(importProfiles: ImportProfile[] = []) {
    for (const importProfile of importProfiles) {
      this.#importProfiles.set(importProfile.id, importProfile);
    }
  }

  async list(): Promise<ImportProfile[]> {
    return [...this.#importProfiles.values()].sort((left, right) =>
      compareCodePoints(left.name, right.name),
    );
  }

  async get(id: string): Promise<ImportProfile | null> {
    return this.#importProfiles.get(id) ?? null;
  }

  async save(importProfile: ImportProfile): Promise<void> {
    this.#importProfiles.set(importProfile.id, importProfile);
  }
}
