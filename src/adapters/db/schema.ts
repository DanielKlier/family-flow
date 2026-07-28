import { pgTable, text } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerContext: text("owner_context").notNull(),
});

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});
