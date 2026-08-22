import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const oidcTransactions = pgTable(
  "oidc_transactions",
  {
    id: text("id").primaryKey(),
    state: text("state").notNull(),
    nonce: text("nonce").notNull(),
    returnTo: text("return_to").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("oidc_transactions_state_idx").on(table.state),
    index("oidc_transactions_expiry_idx").on(table.expiresAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id").notNull(),
    userDisplayName: text("user_display_name").notNull(),
    userEmail: text("user_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    index("sessions_cleanup_order_idx").on(table.expiresAt, table.id),
  ],
);

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerContext: text("owner_context").notNull(),
  active: boolean("active").notNull().default(true),
});

export const ownerContextLabels = pgTable("owner_context_labels", {
  ownerContext: text("owner_context").primaryKey(),
  label: text("label").notNull(),
});

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [uniqueIndex("categories_normalized_name_unique_idx").on(table.normalizedName)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    categoryOrigin: text("category_origin")
      .notNull()
      .$type<"manual" | "csv_mapped" | "rule" | "fallback" | "legacy_preserved">(),
    date: text("date").notNull(),
    amountCents: integer("amount_cents").notNull(),
    description: text("description").notNull(),
    payee: text("payee"),
    purpose: text("purpose"),
    source: text("source").notNull(),
    status: text("status").notNull(),
    fixedCost: boolean("fixed_cost").notNull().default(false),
    internalTransfer: boolean("internal_transfer").notNull().default(false),
    note: text("note"),
    importHash: text("import_hash"),
  },
  (table) => [
    uniqueIndex("transactions_account_import_hash_unique_idx")
      .on(table.accountId, table.importHash)
      .where(sql`${table.importHash} is not null`),
  ],
);

export const importProfiles = pgTable("import_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().$type<"custom">(),
  delimiter: text("delimiter").notNull().$type<"," | ";" | "\t">(),
  encoding: text("encoding").notNull().$type<"utf8" | "latin1">(),
  dateFormat: text("date_format").notNull().$type<"DD.MM.YY" | "DD.MM.YYYY" | "YYYY-MM-DD">(),
  decimalFormat: text("decimal_format").notNull().$type<"comma-decimal" | "dot-decimal">(),
  dateColumn: text("date_column").notNull(),
  amountColumn: text("amount_column").notNull(),
  descriptionColumn: text("description_column").notNull(),
  payeeColumn: text("payee_column"),
  purposeColumn: text("purpose_column"),
  categoryColumn: text("category_column"),
});

export const importPreviewBatches = pgTable("import_preview_batches", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  profileSnapshot: jsonb("profile_snapshot").notNull(),
  outcomeSnapshot: jsonb("outcome_snapshot").notNull(),
});

export const categorizationRules = pgTable("categorization_rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  searchText: text("search_text").notNull(),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id),
  accountId: text("account_id").references(() => accounts.id),
  fixedCost: boolean("fixed_cost"),
  internalTransfer: boolean("internal_transfer"),
  priority: integer("priority").notNull(),
  enabled: boolean("enabled").notNull().default(true),
});

export const incomePlans = pgTable("income_plans", {
  id: text("id").primaryKey(),
  ownerContext: text("owner_context").notNull(),
  name: text("name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  startMonth: text("start_month").notNull(),
  endMonth: text("end_month"),
  active: boolean("active").notNull().default(true),
});

export const monthlyIncomeOverrides = pgTable("monthly_income_overrides", {
  id: text("id").primaryKey(),
  incomePlanId: text("income_plan_id")
    .notNull()
    .references(() => incomePlans.id),
  month: text("month").notNull(),
  amountCents: integer("amount_cents").notNull(),
  note: text("note"),
});

export const scenarios = pgTable("scenarios", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startMonth: text("start_month").notNull(),
  endMonth: text("end_month").notNull(),
  startingBufferCents: integer("starting_buffer_cents").notNull(),
  baseIncomeCents: integer("base_income_cents").notNull(),
  baselineMode: text("baseline_mode").notNull().$type<"manual" | "historical">(),
  baselineWindowLength: integer("baseline_window_length"),
  baselineExpenseCents: integer("baseline_expense_cents").notNull(),
});

export const scenarioAdjustments = pgTable(
  "scenario_adjustments",
  {
    id: text("id").primaryKey(),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull().$type<"income" | "expense">(),
    deltaCents: integer("delta_cents").notNull(),
    startMonth: text("start_month").notNull(),
    endMonth: text("end_month").notNull(),
  },
  (table) => [index("scenario_adjustments_scenario_idx").on(table.scenarioId, table.id)],
);
