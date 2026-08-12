import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  findCategorizationMatch,
  type CategorizationRule,
} from "../../core/categorization/categorization-rule.js";
import { detectDuplicateImportRows } from "../../core/imports/csv-import.js";
import type { CsvTransactionImportRow } from "../../core/imports/csv-import.js";
import { createTransaction } from "../../core/transactions/transaction.js";
import type { CsvParser } from "../../ports/csv/csv-parser.js";
import type { ParsedCsvTransactionRow } from "../../ports/csv/csv-parser.js";
import type { AccountRepository } from "../../ports/repositories/account-repository.js";
import type { CategoryRepository } from "../../ports/repositories/category-repository.js";
import type { CategorizationRuleRepository } from "../../ports/repositories/categorization-rule-repository.js";
import type { ImportProfileRepository } from "../../ports/repositories/import-profile-repository.js";
import type { TransactionRepository } from "../../ports/repositories/transaction-repository.js";
import {
  createImportProfileFromForm,
  createPreviewImportProfile,
  parsePreviewRows,
  readImportAccountId,
  readMultipartForm,
  readRequiredFile,
} from "./import-request.js";
import { readForm, readOptionalQueryValue } from "./request-values.js";
import type { CsvImportPreviewRow } from "./csv-import-view-model.js";
import { createFamilyFlowViews } from "./views.js";

type CsvImportRouteRepositories = {
  accounts: AccountRepository;
  categories: CategoryRepository;
  categorizationRules: CategorizationRuleRepository;
  importProfiles: ImportProfileRepository;
  transactions: TransactionRepository;
};

export function registerCsvImportRoutes(
  server: FastifyInstance,
  repositories: CsvImportRouteRepositories,
  csvParser: CsvParser,
): void {
  server.get("/imports/csv", async (request, reply) => {
    const [accounts, categories, importProfiles] = await Promise.all([
      repositories.accounts.list(),
      repositories.categories.list(),
      repositories.importProfiles.list(),
    ]);
    const query = typeof request.query === "object" && request.query !== null ? request.query : {};
    const selectedProfileId = readOptionalQueryValue(query, "profileId");
    const profileSaved = readOptionalQueryValue(query, "saved") === "1";
    const selectedProfile =
      selectedProfileId === undefined
        ? undefined
        : await repositories.importProfiles.get(selectedProfileId);

    return reply.type("text/html; charset=utf-8").send(
      await createFamilyFlowViews(reply).csvImportPage({
        accounts,
        categories,
        importProfiles,
        selectedProfile: selectedProfile ?? undefined,
        profileSaved,
      }),
    );
  });

  server.post("/imports/csv/profiles", async (request, reply) => {
    return handleSaveImportProfile(repositories, request, reply);
  });

  server.post("/imports/csv/preview", async (request, reply) => {
    return handleCsvImportPreview(repositories, csvParser, request, reply);
  });

  server.post("/imports/csv/confirm", async (request, reply) => {
    return handleCsvImportConfirm(repositories, request, reply);
  });
}

async function handleSaveImportProfile(
  repositories: CsvImportRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const [accounts, categories, importProfiles] = await Promise.all([
    repositories.accounts.list(),
    repositories.categories.list(),
    repositories.importProfiles.list(),
  ]);

  try {
    const form = readForm(request.body);
    const profile = createImportProfileFromForm(form, randomUUID());

    await repositories.importProfiles.save(profile);

    return reply.redirect(`/imports/csv?profileId=${encodeURIComponent(profile.id)}&saved=1`);
  } catch (error: unknown) {
    return reply
      .status(400)
      .type("text/html; charset=utf-8")
      .send(
        await createFamilyFlowViews(reply).csvImportPage({
          accounts,
          categories,
          importProfiles,
          formError: error instanceof Error ? error.message : "Import profile could not be saved",
        }),
      );
  }
}

async function handleCsvImportPreview(
  repositories: CsvImportRouteRepositories,
  csvParser: CsvParser,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const [accounts, categories, importProfiles] = await Promise.all([
    repositories.accounts.list(),
    repositories.categories.list(),
    repositories.importProfiles.list(),
  ]);

  try {
    const form = readMultipartForm(request.body);
    const profile = createPreviewImportProfile(form);
    const rows = await csvParser.parse(readRequiredFile(form, "csvFile"), {
      accountId: readImportAccountId(form),
      profile,
    });
    const previewRows = createPreviewRows({
      parsedRows: rows,
      importRows: detectDuplicateImportRows(rows, await readExistingImportHashes(repositories)),
      categories,
      rules: await repositories.categorizationRules.list(),
    });

    return reply.type("text/html; charset=utf-8").send(
      await createFamilyFlowViews(reply).csvImportPage({
        accounts,
        categories,
        importProfiles,
        previewRows,
      }),
    );
  } catch (error: unknown) {
    return reply
      .status(400)
      .type("text/html; charset=utf-8")
      .send(
        await createFamilyFlowViews(reply).csvImportPage({
          accounts,
          categories,
          importProfiles,
          formError: error instanceof Error ? error.message : "CSV import preview failed",
        }),
      );
  }
}

async function handleCsvImportConfirm(
  repositories: CsvImportRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const form = readForm(request.body);
  const rows = parsePreviewRows(form.rowsJson);
  const existingImportHashes = await readExistingImportHashes(repositories);

  for (const row of rows) {
    if (row.duplicate || existingImportHashes.has(row.importHash)) {
      continue;
    }

    await repositories.transactions.save(
      createTransaction({
        id: randomUUID(),
        accountId: row.accountId,
        categoryId: row.categoryId,
        date: row.date,
        amountCents: row.amountCents,
        description: row.description,
        payee: row.payee,
        source: "csv",
        status: "booked",
        fixedCost: row.fixedCost,
        note: null,
        importHash: row.importHash,
      }),
    );
    existingImportHashes.add(row.importHash);
  }

  return reply.redirect("/transactions");
}

function createPreviewRows(input: {
  parsedRows: ParsedCsvTransactionRow[];
  importRows: CsvTransactionImportRow[];
  categories: { id: string; name: string }[];
  rules: CategorizationRule[];
}): CsvImportPreviewRow[] {
  return input.importRows.map((row, index) => {
    const parsedRow = input.parsedRows[index];
    const matchedCategory = matchCategory(
      input.categories,
      input.rules,
      row,
      parsedRow?.categoryName ?? null,
    );

    return {
      ...row,
      categoryId: matchedCategory.id,
      categoryName: matchedCategory.name,
      fixedCost: matchedCategory.fixedCost,
    };
  });
}

function matchCategory(
  categories: { id: string; name: string }[],
  rules: CategorizationRule[],
  row: CsvTransactionImportRow,
  csvCategoryName: string | null,
): { id: string; name: string; fixedCost: boolean } {
  const matchedRule = findCategorizationMatch(rules, {
    accountId: row.accountId,
    description: row.description,
    payee: row.payee,
  });
  const normalizedCsvCategoryName = normalizeMatchText(csvCategoryName ?? "");
  const matchedCategory = categories.find(
    (category) => normalizeMatchText(category.name) === normalizedCsvCategoryName,
  );
  if (matchedCategory !== undefined) {
    return { ...matchedCategory, fixedCost: matchedRule?.fixedCost ?? false };
  }

  const ruleCategory = categories.find((category) => category.id === matchedRule?.categoryId);
  if (ruleCategory !== undefined) {
    return { ...ruleCategory, fixedCost: matchedRule?.fixedCost ?? false };
  }

  const fallbackCategory = categories.find((category) => category.id === "category-other") ??
    categories[0] ?? { id: "category-other", name: "Other" };

  return { ...fallbackCategory, fixedCost: false };
}

function normalizeMatchText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

async function readExistingImportHashes(
  repositories: CsvImportRouteRepositories,
): Promise<Set<string>> {
  const transactions = await repositories.transactions.list({});
  return new Set(
    transactions
      .map((transaction) => transaction.importHash)
      .filter((importHash): importHash is string => importHash !== null),
  );
}
