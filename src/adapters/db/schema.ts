import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerContext: text("owner_context").notNull(),
});

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id),
  date: text("date").notNull(),
  amountCents: integer("amount_cents").notNull(),
  description: text("description").notNull(),
  payee: text("payee"),
  source: text("source").notNull(),
  status: text("status").notNull(),
  fixedCost: boolean("fixed_cost").notNull().default(false),
  note: text("note"),
  importHash: text("import_hash"),
});
