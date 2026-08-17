import { resolve } from "node:path";

import fastifyView from "@fastify/view";
import type { FastifyInstance, FastifyReply } from "fastify";
import nunjucks from "nunjucks";

import type { Account } from "../../core/accounts/account.js";
import type { Category } from "../../core/categories/category.js";
import type { CategorizationRule } from "../../core/categorization/categorization-rule.js";
import type { IncomePlan } from "../../core/income/income-plan.js";
import type { OwnerContextLabel } from "../../core/shared/owner-context.js";
import type { Transaction } from "../../core/transactions/transaction.js";
import type { UserContext } from "../../ports/auth/user-context.js";
import type { Localization } from "../../ports/localization/localization.js";
import type { TransactionFilters } from "../../ports/repositories/transaction-repository.js";
import {
  prepareAuthErrorViewModel,
  prepareDashboardViewModel,
  prepareLoginViewModel,
} from "./auth-view-model.js";
import {
  prepareCategorizationRuleEditViewModel,
  prepareCategorizationRulesViewModel,
} from "./categorization-rules-view-model.js";
import { type CsvImportViewInput, prepareCsvImportViewModel } from "./csv-import-view-model.js";
import {
  type IncomeViewInput,
  prepareIncomeEditViewModel,
  prepareIncomeViewModel,
} from "./income-view-model.js";
import {
  prepareAccountEditViewModel,
  prepareCategoryEditViewModel,
  prepareMasterDataViewModel,
} from "./master-data-view-model.js";
import {
  type MissingResource,
  prepareBadRequestViewModel,
  prepareMissingResourceViewModel,
  prepareNotFoundViewModel,
  prepareUnexpectedErrorViewModel,
} from "./resource-error-view-model.js";
import {
  prepareTransactionFormViewModel,
  prepareTransactionListViewModel,
  prepareTransactionsViewModel,
} from "./transaction-view-model.js";

type ViewRenderer = Pick<FastifyReply, "viewAsync"> & {
  server?: { localization?: Localization };
};

type TransactionsInput = {
  accounts: Account[];
  categories: Category[];
  ownerContexts: OwnerContextLabel[];
  transactions: Transaction[];
  filters: TransactionFilters;
  formError?: string;
};

type RulesInput = {
  accounts: Account[];
  categories: Category[];
  rules: CategorizationRule[];
  formError?: string;
};

function mainNavigation(localization: Localization) {
  return [
    { href: "/", label: localization.text("nav.dashboard") },
    { href: "/admin/master-data", label: localization.text("nav.masterData") },
    { href: "/transactions", label: localization.text("nav.transactions") },
    { href: "/income", label: localization.text("nav.income") },
    { href: "/imports/csv", label: localization.text("nav.csvImport") },
    { href: "/categorization-rules", label: localization.text("nav.rules") },
  ];
}

function page(model: object, navigation: { href: string; label: string }[], htmxEnabled = false) {
  return { ...model, navigation, htmxEnabled };
}

export function createFamilyFlowViews(renderer: ViewRenderer, configured?: Localization) {
  const localization = configured ?? renderer.server?.localization;
  if (localization === undefined) throw new Error("Localization must be configured");
  return {
    dashboardPage(user: UserContext): Promise<string> {
      return renderer.viewAsync(
        "pages/dashboard.njk",
        page(prepareDashboardViewModel(user, localization), mainNavigation(localization)),
      );
    },
    authLoginPage(returnTo: string): Promise<string> {
      return renderer.viewAsync(
        "pages/login.njk",
        page(prepareLoginViewModel(returnTo, localization), []),
      );
    },
    authErrorPage(message: string): Promise<string> {
      return renderer.viewAsync(
        "pages/auth-error.njk",
        page(prepareAuthErrorViewModel(message, localization), []),
      );
    },
    missingResourcePage(resource: MissingResource): Promise<string> {
      return renderer.viewAsync(
        "pages/resource-error.njk",
        page(prepareMissingResourceViewModel(resource, localization), mainNavigation(localization)),
      );
    },
    badRequestPage(message: string, requestId: string): Promise<string> {
      return renderer.viewAsync(
        "pages/resource-error.njk",
        page(
          prepareBadRequestViewModel(message, requestId, localization),
          mainNavigation(localization),
        ),
      );
    },
    notFoundPage(requestId: string): Promise<string> {
      return renderer.viewAsync(
        "pages/resource-error.njk",
        page(prepareNotFoundViewModel(requestId, localization), mainNavigation(localization)),
      );
    },
    unexpectedErrorPage(requestId: string): Promise<string> {
      return renderer.viewAsync(
        "pages/resource-error.njk",
        page(
          prepareUnexpectedErrorViewModel(requestId, localization),
          mainNavigation(localization),
        ),
      );
    },
    masterDataPage(input: Parameters<typeof prepareMasterDataViewModel>[0]): Promise<string> {
      return renderer.viewAsync(
        "pages/master-data.njk",
        page(prepareMasterDataViewModel(input, localization), mainNavigation(localization)),
      );
    },
    accountEditPage(input: {
      account: Account;
      ownerContexts: OwnerContextLabel[];
      formError?: string;
    }): Promise<string> {
      return renderer.viewAsync(
        "pages/account-edit.njk",
        page(prepareAccountEditViewModel(input, localization), [
          { href: "/admin/master-data", label: localization.text("nav.masterData") },
        ]),
      );
    },
    categoryEditPage(input: { category: Category; formError?: string }): Promise<string> {
      return renderer.viewAsync(
        "pages/category-edit.njk",
        page(prepareCategoryEditViewModel(input, localization), [
          { href: "/admin/master-data", label: localization.text("nav.masterData") },
        ]),
      );
    },
    categorizationRulesPage(input: RulesInput): Promise<string> {
      return renderer.viewAsync(
        "pages/categorization-rules.njk",
        page(
          prepareCategorizationRulesViewModel(input, localization),
          mainNavigation(localization),
        ),
      );
    },
    categorizationRuleEditPage(input: RulesInput & { rule: CategorizationRule }): Promise<string> {
      return renderer.viewAsync(
        "pages/categorization-rule-edit.njk",
        page(prepareCategorizationRuleEditViewModel(input, localization), [
          { href: "/categorization-rules", label: localization.text("nav.rules") },
        ]),
      );
    },
    csvImportPage(input: CsvImportViewInput): Promise<string> {
      return renderer.viewAsync(
        "pages/csv-import.njk",
        page(prepareCsvImportViewModel(input, localization), mainNavigation(localization)),
      );
    },
    incomePage(input: IncomeViewInput): Promise<string> {
      return renderer.viewAsync(
        "pages/income.njk",
        page(prepareIncomeViewModel(input, localization), mainNavigation(localization), true),
      );
    },
    incomePanel(input: IncomeViewInput): Promise<string> {
      return renderer.viewAsync(
        "partials/income-panel.njk",
        prepareIncomeViewModel(input, localization),
      );
    },
    incomeEditPage(input: {
      plan: IncomePlan;
      ownerContexts: OwnerContextLabel[];
      formError?: string;
    }): Promise<string> {
      return renderer.viewAsync(
        "pages/income-edit.njk",
        page(
          prepareIncomeEditViewModel(input, localization),
          [{ href: "/income", label: localization.text("nav.income") }],
          true,
        ),
      );
    },
    incomeEditPanel(input: {
      plan: IncomePlan;
      ownerContexts: OwnerContextLabel[];
      formError?: string;
    }): Promise<string> {
      return renderer.viewAsync(
        "partials/income-edit-panel.njk",
        prepareIncomeEditViewModel(input, localization),
      );
    },
    transactionsPage(input: TransactionsInput): Promise<string> {
      return renderer.viewAsync(
        "pages/transactions.njk",
        page(
          {
            ...prepareTransactionsViewModel(input, localization),
            title: localization.text("transaction.title"),
            heading: localization.text("transaction.heading"),
          },
          mainNavigation(localization),
          true,
        ),
      );
    },
    transactionsPanel(input: TransactionsInput): Promise<string> {
      return renderer.viewAsync(
        "partials/transactions-panel.njk",
        prepareTransactionsViewModel(input, localization),
      );
    },
    transactionsList(
      input: Pick<TransactionsInput, "categories" | "transactions"> & {
        filters?: TransactionFilters;
      },
    ): Promise<string> {
      return renderer.viewAsync("partials/transactions-list.njk", {
        list: prepareTransactionListViewModel(input, localization),
      });
    },
    transactionEditPage(
      input: Pick<TransactionsInput, "accounts" | "categories" | "formError"> & {
        transaction: Transaction;
      },
    ): Promise<string> {
      return renderer.viewAsync(
        "pages/transactions.njk",
        page(
          {
            title: localization.text("transaction.edit"),
            heading: localization.text("transaction.edit"),
            form: prepareTransactionFormViewModel(input, localization),
          },
          [{ href: "/transactions", label: localization.text("nav.transactions") }],
          true,
        ),
      );
    },
    transactionEditPanel(
      input: Pick<TransactionsInput, "accounts" | "categories" | "formError"> & {
        transaction: Transaction;
      },
    ): Promise<string> {
      return renderer.viewAsync("partials/transactions-panel.njk", {
        form: prepareTransactionFormViewModel(input, localization),
      });
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
