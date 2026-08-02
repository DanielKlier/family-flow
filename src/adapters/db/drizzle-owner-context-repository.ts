import { eq, sql } from "drizzle-orm";

import {
  createOwnerContextLabel,
  type OwnerContext,
  type OwnerContextLabel,
} from "../../core/shared/owner-context.js";
import type { OwnerContextRepository } from "../../ports/repositories/owner-context-repository.js";
import type { PostgresDatabase } from "./postgres.js";
import { ownerContextLabels } from "./schema.js";

export class DrizzleOwnerContextRepository implements OwnerContextRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async list(): Promise<OwnerContextLabel[]> {
    const rows = await this.db
      .select()
      .from(ownerContextLabels)
      .orderBy(
        sql`array_position(array['person_a', 'person_b', 'shared'], ${ownerContextLabels.ownerContext})`,
      );

    return rows.map(mapOwnerContextLabelRow);
  }

  async get(ownerContext: OwnerContext): Promise<OwnerContextLabel | null> {
    const [row] = await this.db
      .select()
      .from(ownerContextLabels)
      .where(eq(ownerContextLabels.ownerContext, ownerContext));

    return row === undefined ? null : mapOwnerContextLabelRow(row);
  }

  async save(label: OwnerContextLabel): Promise<void> {
    await this.db
      .insert(ownerContextLabels)
      .values(label)
      .onConflictDoUpdate({
        target: ownerContextLabels.ownerContext,
        set: { label: label.label },
      });
  }
}

type OwnerContextLabelRow = typeof ownerContextLabels.$inferSelect;

function mapOwnerContextLabelRow(row: OwnerContextLabelRow): OwnerContextLabel {
  return createOwnerContextLabel({ ownerContext: row.ownerContext, label: row.label });
}
