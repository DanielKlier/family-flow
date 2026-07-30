import type { ImportProfile } from "../../../core/imports/import-profile.js";
import type { ImportProfileRepository } from "../../../ports/repositories/import-profile-repository.js";

export const initialImportProfiles: ImportProfile[] = [];

export type ImportProfileRepositories = {
  importProfiles: ImportProfileRepository;
};

export async function seedImportProfiles(repositories: ImportProfileRepositories): Promise<void> {
  for (const importProfile of initialImportProfiles) {
    await repositories.importProfiles.save(importProfile);
  }
}
