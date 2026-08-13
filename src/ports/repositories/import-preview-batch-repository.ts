import type {
  ImportConfirmationPersistence,
  StoredImportOutcome,
} from "../../core/imports/confirm-csv-import.js";
import type { ImportProfile } from "../../core/imports/import-profile.js";

export type ImportPreviewBatch = {
  id: string;
  userId: string;
  accountId: string;
  createdAt: Date;
  expiresAt: Date;
  profileSnapshot: ImportProfile;
  outcomes: StoredImportOutcome[];
};

export type ImportPreviewBatchRepository = ImportConfirmationPersistence & {
  save(batch: ImportPreviewBatch): Promise<void>;
};
