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
} from "./resource-error-view-model.js";
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

type RulesInput = {
  accounts: Account[];
  categories: Category[];
  rules: CategorizationRule[];
  formError?: string;
};

const mainNavigation = [
  { href: "/", label: "Dashboard" },
  { href: "/admin/master-data", label: "Master Data" },
  { href: "/transactions", label: "Transactions" },
  { href: "/income", label: "Income" },
  { href: "/imports/csv", label: "CSV Import" },
  { href: "/categorization-rules", label: "Rules" },
];

function page(model: object, navigation = mainNavigation, htmxEnabled = false) {
  return { ...model, navigation, htmxEnabled };
}

export function createFamilyFlowViews(renderer: ViewRenderer) {
  return {
    dashboardPage(user: UserContext): Promise<string> {
      return renderer.viewAsync("pages/dashboard.njk", page(prepareDashboardViewModel(user)));
    },
    authLoginPage(returnTo: string): Promise<string> {
      return renderer.viewAsync("pages/login.njk", page(prepareLoginViewModel(returnTo), []));
    },
    authErrorPage(message: string): Promise<string> {
      return renderer.viewAsync(
        "pages/auth-error.njk",
        page(prepareAuthErrorViewModel(message), []),
      );
    },
    missingResourcePage(resource: MissingResource): Promise<string> {
      return renderer.viewAsync(
        "pages/resource-error.njk",
        page(prepareMissingResourceViewModel(resource)),
      );
    },
    badRequestPage(message: string, requestId: string): Promise<string> {
      return renderer.viewAsync(
        "pages/resource-error.njk",
        page(prepareBadRequestViewModel(message, requestId)),
      );
    },
    masterDataPage(input: Parameters<typeof prepareMasterDataViewModel>[0]): Promise<string> {
      return renderer.viewAsync("pages/master-data.njk", page(prepareMasterDataViewModel(input)));
    },
    accountEditPage(input: {
      account: Account;
      ownerContexts: OwnerContextLabel[];
      formError?: string;
    }): Promise<string> {
      return renderer.viewAsync(
        "pages/account-edit.njk",
        page(prepareAccountEditViewModel(input), [
          { href: "/admin/master-data", label: "Master Data" },
        ]),
      );
    },
    categoryEditPage(input: { category: Category; formError?: string }): Promise<string> {
      return renderer.viewAsync(
        "pages/category-edit.njk",
        page(prepareCategoryEditViewModel(input), [
          { href: "/admin/master-data", label: "Master Data" },
        ]),
      );
    },
    categorizationRulesPage(input: RulesInput): Promise<string> {
      return renderer.viewAsync(
        "pages/categorization-rules.njk",
        page(prepareCategorizationRulesViewModel(input)),
      );
    },
    categorizationRuleEditPage(input: RulesInput & { rule: CategorizationRule }): Promise<string> {
      return renderer.viewAsync(
        "pages/categorization-rule-edit.njk",
        page(prepareCategorizationRuleEditViewModel(input), [
          { href: "/categorization-rules", label: "Rules" },
        ]),
      );
    },
    csvImportPage(input: CsvImportViewInput): Promise<string> {
      return renderer.viewAsync("pages/csv-import.njk", page(prepareCsvImportViewModel(input)));
    },
    incomePage(input: IncomeViewInput): Promise<string> {
      return renderer.viewAsync(
        "pages/income.njk",
        page(prepareIncomeViewModel(input), mainNavigation, true),
      );
    },
    incomePanel(input: IncomeViewInput): Promise<string> {
      return renderer.viewAsync("partials/income-panel.njk", prepareIncomeViewModel(input));
    },
    incomeEditPage(input: {
      plan: IncomePlan;
      ownerContexts: OwnerContextLabel[];
      formError?: string;
    }): Promise<string> {
      return renderer.viewAsync(
        "pages/income-edit.njk",
        page(prepareIncomeEditViewModel(input), [{ href: "/income", label: "Income" }], true),
      );
    },
    incomeEditPanel(input: {
      plan: IncomePlan;
      ownerContexts: OwnerContextLabel[];
      formError?: string;
    }): Promise<string> {
      return renderer.viewAsync(
        "partials/income-edit-panel.njk",
        prepareIncomeEditViewModel(input),
      );
    },
    transactionsPage(input: TransactionsInput): Promise<string> {
      return renderer.viewAsync(
        "pages/transactions.njk",
        page(
          {
            ...prepareTransactionsViewModel(input),
            title: "FamilyFlow Transactions",
            heading: "Transactions",
          },
          mainNavigation,
          true,
        ),
      );
    },
    transactionsPanel(input: TransactionsInput): Promise<string> {
      return renderer.viewAsync(
        "partials/transactions-panel.njk",
        prepareTransactionsViewModel(input),
      );
    },
    transactionsList(
      input: Pick<TransactionsInput, "categories" | "transactions"> & {
        filters?: TransactionFilters;
      },
    ): Promise<string> {
      return renderer.viewAsync("partials/transactions-list.njk", {
        list: prepareTransactionListViewModel(input),
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
            title: "Edit Transaction",
            heading: "Edit Transaction",
            form: prepareTransactionFormViewModel(input),
          },
          [{ href: "/transactions", label: "Transactions" }],
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
        form: prepareTransactionFormViewModel(input),
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
