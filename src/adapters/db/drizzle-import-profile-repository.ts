import { asc, eq } from "drizzle-orm";

import { createImportProfile, type ImportProfile } from "../../core/imports/import-profile.js";
import type { ImportProfileRepository } from "../../ports/repositories/import-profile-repository.js";
import type { PostgresDatabase } from "./postgres.js";
import { importProfiles } from "./schema.js";

export class DrizzleImportProfileRepository implements ImportProfileRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async list(): Promise<ImportProfile[]> {
    const rows = await this.db.select().from(importProfiles).orderBy(asc(importProfiles.name));

    return rows.map(mapImportProfileRow);
  }

  async get(id: string): Promise<ImportProfile | null> {
    const [row] = await this.db.select().from(importProfiles).where(eq(importProfiles.id, id));

    return row === undefined ? null : mapImportProfileRow(row);
  }

  async save(importProfile: ImportProfile): Promise<void> {
    await this.db
      .insert(importProfiles)
      .values(importProfile)
      .onConflictDoUpdate({
        target: importProfiles.id,
        set: {
          name: importProfile.name,
          kind: importProfile.kind,
          delimiter: importProfile.delimiter,
          encoding: importProfile.encoding,
          dateFormat: importProfile.dateFormat,
          decimalFormat: importProfile.decimalFormat,
          dateColumn: importProfile.dateColumn,
          amountColumn: importProfile.amountColumn,
          descriptionColumn: importProfile.descriptionColumn,
          payeeColumn: importProfile.payeeColumn,
          purposeColumn: importProfile.purposeColumn,
          categoryColumn: importProfile.categoryColumn,
        },
      });
  }
}

type ImportProfileRow = typeof importProfiles.$inferSelect;

function mapImportProfileRow(row: ImportProfileRow): ImportProfile {
  return createImportProfile({
    id: row.id,
    name: row.name,
    kind: row.kind,
    delimiter: row.delimiter,
    encoding: row.encoding,
    dateFormat: row.dateFormat,
    decimalFormat: row.decimalFormat,
    dateColumn: row.dateColumn,
    amountColumn: row.amountColumn,
    descriptionColumn: row.descriptionColumn,
    payeeColumn: row.payeeColumn,
    purposeColumn: row.purposeColumn,
    categoryColumn: row.categoryColumn,
  });
}
