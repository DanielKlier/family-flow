import type { ImportProfile } from "../../core/imports/import-profile.js";

export type ImportProfileRepository = {
  list(): Promise<ImportProfile[]>;
  get(id: string): Promise<ImportProfile | null>;
  save(importProfile: ImportProfile): Promise<void>;
};
