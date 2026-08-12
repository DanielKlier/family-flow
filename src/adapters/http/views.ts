import { resolve } from "node:path";

import fastifyView from "@fastify/view";
import type { FastifyInstance, FastifyReply } from "fastify";
import nunjucks from "nunjucks";

import type { Account } from "../../core/accounts/account.js";
import type { Category } from "../../core/categories/category.js";
import type { OwnerContextLabel } from "../../core/shared/owner-context.js";
import type { Transaction } from "../../core/transactions/transaction.js";
import type { TransactionFilters } from "../../ports/repositories/transaction-repository.js";
import { renderLoginPage } from "./templates/auth.js";
import { renderCategorizationRulesPage } from "./templates/categorization-rules.js";
import { renderCsvImportPage } from "./templates/imports.js";
import { renderIncomePage } from "./templates/income.js";
import { renderMasterDataPage } from "./templates/master-data.js";
import {
  prepareTransactionFormViewModel,
  prepareTransactionListViewModel,
  prepareTransactionsViewModel,
} from "./transaction-view-model.js";

type ViewRenderer = Pick<FastifyReply, "viewAsync">;

type TransactionsInput = {
  accounts: Account[];
  categories: Category[];
  ownerContexts: OwnerContextLabel[];
  transactions: Transaction[];
  filters: TransactionFilters;
  formError?: string;
};

export function createFamilyFlowViews(renderer: ViewRenderer) {
  const navigation = [
    { href: "/", label: "Dashboard" },
    { href: "/admin/master-data", label: "Master Data" },
    { href: "/income", label: "Income" },
    { href: "/imports/csv", label: "CSV Import" },
    { href: "/categorization-rules", label: "Rules" },
  ];

  return {
    transactionsPage(input: TransactionsInput): Promise<string> {
      const model = prepareTransactionsViewModel(input);
      return renderer.viewAsync("transactions.njk", {
        ...model,
        fullPage: true,
        panel: true,
        title: "FamilyFlow Transactions",
        heading: "Transactions",
        navigation,
      });
    },
    transactionsPanel(input: TransactionsInput): Promise<string> {
      return renderer.viewAsync("transactions.njk", {
        ...prepareTransactionsViewModel(input),
        panel: true,
      });
    },
    transactionsList(
      input: Pick<TransactionsInput, "categories" | "transactions">,
    ): Promise<string> {
      return renderer.viewAsync("transactions.njk", {
        list: prepareTransactionListViewModel(input),
      });
    },
    transactionEditPage(
      input: Pick<TransactionsInput, "accounts" | "categories"> & { transaction: Transaction },
    ): Promise<string> {
      return renderer.viewAsync("transactions.njk", {
        fullPage: true,
        panel: true,
        form: prepareTransactionFormViewModel(input),
        title: "Edit Transaction",
        heading: "Edit Transaction",
        navigation: [{ href: "/transactions", label: "Transactions" }],
      });
    },
    authLoginPage(returnTo: string): string {
      return renderLoginPage(returnTo);
    },
    masterDataPage(input: Parameters<typeof renderMasterDataPage>[0]): string {
      return renderMasterDataPage(input);
    },
    categorizationRulesPage(input: Parameters<typeof renderCategorizationRulesPage>[0]): string {
      return renderCategorizationRulesPage(input);
    },
    csvImportPage(input: Parameters<typeof renderCsvImportPage>[0]): string {
      return renderCsvImportPage(input);
    },
    incomePage(input: Parameters<typeof renderIncomePage>[0]): string {
      return renderIncomePage(input);
    },
  };
}

export function registerTemplateRenderer(
  server: FastifyInstance,
  templateDirectory = resolveTemplateDirectory(),
): void {
  server.register(fastifyView, {
    engine: { nunjucks },
    root: templateDirectory,
    options: { autoescape: true },
  });
}

export function resolveTemplateDirectory(): string {
  return resolve(import.meta.dirname, "../../views");
}
