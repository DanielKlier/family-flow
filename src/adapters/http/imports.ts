import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  type CategorizationRule,
  findCategorizationMatch,
} from "../../core/categorization/categorization-rule.js";
import {
  confirmCsvImportBatch,
  type StoredImportOutcome,
} from "../../core/imports/confirm-csv-import.js";
import {
  type CsvTransactionImportRow,
  detectDuplicateImportRows,
} from "../../core/imports/csv-import.js";
import type { UserContext } from "../../ports/auth/user-context.js";
import type { Clock } from "../../ports/clock/clock.js";
import type {
  CsvParser,
  CsvRowOutcome,
  ParsedCsvTransactionRow,
} from "../../ports/csv/csv-parser.js";
import type { Localization } from "../../ports/localization/localization.js";
import type { AccountRepository } from "../../ports/repositories/account-repository.js";
import type { CategorizationRuleRepository } from "../../ports/repositories/categorization-rule-repository.js";
import type { CategoryRepository } from "../../ports/repositories/category-repository.js";
import type { ImportPreviewBatchRepository } from "../../ports/repositories/import-preview-batch-repository.js";
import type { ImportProfileRepository } from "../../ports/repositories/import-profile-repository.js";
import type { TransactionRepository } from "../../ports/repositories/transaction-repository.js";
import type { CsvImportPreviewRow } from "./csv-import-view-model.js";
import {
  createImportProfileFromForm,
  createPreviewImportProfile,
  readImportAccountId,
  readImportBatchId,
  readMultipartForm,
  readRequiredFile,
} from "./import-request.js";
import { readForm, readOptionalQueryValue } from "./request-values.js";
import { createFamilyFlowViews } from "./views.js";

type CsvImportRouteRepositories = {
  accounts: AccountRepository;
  categories: CategoryRepository;
  categorizationRules: CategorizationRuleRepository;
  importProfiles: ImportProfileRepository;
  importPreviewBatches: ImportPreviewBatchRepository;
  transactions: TransactionRepository;
};

export function registerCsvImportRoutes(
  server: FastifyInstance,
  repositories: CsvImportRouteRepositories,
  csvParser: CsvParser,
  clock: Clock,
): void {
  server.get("/imports/csv", async (request, reply) => {
    const [accounts, categories, importProfiles] = await readPageData(repositories);
    const query = typeof request.query === "object" && request.query !== null ? request.query : {};
    const selectedProfileId = readOptionalQueryValue(query, "profileId");
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
        profileSaved: readOptionalQueryValue(query, "saved") === "1",
      }),
    );
  });

  server.post("/imports/csv/profiles", async (request, reply) =>
    handleSaveImportProfile(repositories, request, reply),
  );
  server.post("/imports/csv/preview", async (request, reply) =>
    handleCsvImportPreview(repositories, csvParser, clock, request, reply),
  );
  server.post("/imports/csv/confirm", async (request, reply) => {
    await confirmCsvImportBatch({
      batchId: readImportBatchId(readForm(request.body)),
      userId: requireUserId(request),
      now: clock.now(),
      persistence: repositories.importPreviewBatches,
    });
    return reply.redirect("/transactions");
  });
}

async function handleSaveImportProfile(
  repositories: CsvImportRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const [accounts, categories, importProfiles] = await readPageData(repositories);
  try {
    const form = readForm(request.body);
    const submittedProfileId = readOptionalQueryValue(form, "profileId");
    if (
      submittedProfileId !== undefined &&
      (await repositories.importProfiles.get(submittedProfileId)) === null
    ) {
      throw new Error("Import profile does not exist");
    }
    const profile = createImportProfileFromForm(form, submittedProfileId ?? randomUUID());
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
          formError: reply.request.localization.errorMessage(error, "csv.profileSaveFailed"),
        }),
      );
  }
}

async function handleCsvImportPreview(
  repositories: CsvImportRouteRepositories,
  csvParser: CsvParser,
  clock: Clock,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const [accounts, categories, importProfiles] = await readPageData(repositories);
  try {
    const form = readMultipartForm(request.body);
    const profile = createPreviewImportProfile(form);
    const accountId = readImportAccountId(form);
    const parsedOutcomes = await csvParser.parse(readRequiredFile(form, "csvFile"), {
      accountId,
      profile,
    });
    const { previewRows, storedOutcomes } = await prepareOutcomes(
      parsedOutcomes,
      categories,
      repositories,
      reply.request.localization,
    );
    const createdAt = clock.now();
    const batchId = randomUUID();
    await repositories.importPreviewBatches.save({
      id: batchId,
      userId: requireUserId(request),
      accountId,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 30 * 60 * 1_000),
      profileSnapshot: profile,
      outcomes: storedOutcomes,
    });
    return reply.type("text/html; charset=utf-8").send(
      await createFamilyFlowViews(reply).csvImportPage({
        accounts,
        categories,
        importProfiles,
        previewRows,
        batchId,
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
          formError: reply.request.localization.errorMessage(error, "csv.previewFailed"),
        }),
      );
  }
}

async function prepareOutcomes(
  outcomes: CsvRowOutcome[],
  categories: { id: string; name: string }[],
  repositories: CsvImportRouteRepositories,
  localization: Localization,
): Promise<{ previewRows: CsvImportPreviewRow[]; storedOutcomes: StoredImportOutcome[] }> {
  const parsedRows = outcomes.flatMap((outcome) =>
    outcome.outcome === "importable" ? [outcome.row] : [],
  );
  const importRows = detectDuplicateImportRows(
    parsedRows,
    await readExistingImportIdentities(repositories),
  );
  const rules = await repositories.categorizationRules.list();
  let importableIndex = 0;
  const previewRows: CsvImportPreviewRow[] = [];
  const storedOutcomes: StoredImportOutcome[] = [];

  for (const outcome of outcomes) {
    if (outcome.outcome !== "importable") {
      previewRows.push(outcome);
      storedOutcomes.push(outcome);
      continue;
    }
    const row = importRows[importableIndex++];
    if (row === undefined) throw new Error("CSV preview outcome is inconsistent");
    const category = matchCategory(categories, rules, row, outcome.row, localization);
    const preview = {
      ...row,
      line: outcome.line,
      categoryId: category.id,
      categoryName: category.name,
      fixedCost: category.fixedCost,
    };
    previewRows.push({
      ...preview,
      outcome: row.duplicate ? "duplicate" : "importable",
      reason: row.duplicate ? "already-imported" : null,
    });
    storedOutcomes.push(
      row.duplicate
        ? { line: outcome.line, outcome: "duplicate", reason: "already-imported" }
        : {
            line: outcome.line,
            outcome: "importable",
            reason: null,
            transaction: {
              id: randomUUID(),
              ...row,
              categoryId: category.id,
              fixedCost: category.fixedCost,
              internalTransfer: category.internalTransfer,
            },
          },
    );
  }
  return { previewRows, storedOutcomes };
}

function matchCategory(
  categories: { id: string; name: string }[],
  rules: CategorizationRule[],
  row: CsvTransactionImportRow,
  parsedRow: ParsedCsvTransactionRow,
  localization: Localization,
): { id: string; name: string; fixedCost: boolean; internalTransfer: boolean } {
  const matchedRule = findCategorizationMatch(rules, row);
  const actions = {
    fixedCost: matchedRule?.fixedCost ?? false,
    internalTransfer: matchedRule?.internalTransfer ?? false,
  };
  const csvName = normalizeMatchText(parsedRow.categoryName ?? "", localization);
  const csvCategory = categories.find(
    (category) => normalizeMatchText(category.name, localization) === csvName,
  );
  if (csvCategory !== undefined) return { ...csvCategory, ...actions };
  const ruleCategory = categories.find((category) => category.id === matchedRule?.categoryId);
  if (ruleCategory !== undefined) return { ...ruleCategory, ...actions };
  const fallback = categories.find((category) => category.id === "category-other") ??
    categories[0] ?? {
      id: "category-other",
      name: localization.seedName("category", "category-other"),
    };
  return { ...fallback, fixedCost: false, internalTransfer: false };
}

function normalizeMatchText(value: string, localization: Localization): string {
  return localization.caseFold(value.trim().replace(/\s+/g, " "));
}

function requireUserId(request: FastifyRequest): string {
  const user = (request as FastifyRequest & { userContext?: UserContext }).userContext;
  if (user === undefined) throw new Error("Authenticated user is required");
  return user.id;
}

async function readExistingImportIdentities(repositories: CsvImportRouteRepositories) {
  const all = await repositories.transactions.list({});
  return all.map(({ importHash, purpose }) => ({ importHash, purpose }));
}

async function readPageData(repositories: CsvImportRouteRepositories) {
  return Promise.all([
    repositories.accounts.list(),
    repositories.categories.list(),
    repositories.importProfiles.list(),
  ]);
}
