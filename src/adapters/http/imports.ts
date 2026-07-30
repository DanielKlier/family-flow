import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { detectDuplicateImportRows } from "../../core/imports/csv-import.js";
import type { CsvTransactionImportRow } from "../../core/imports/csv-import.js";
import { createImportProfile } from "../../core/imports/import-profile.js";
import { createTransaction } from "../../core/transactions/transaction.js";
import type { ImportProfileEncoding } from "../../core/imports/import-profile.js";
import type { CsvParser } from "../../ports/csv/csv-parser.js";
import type { ParsedCsvTransactionRow } from "../../ports/csv/csv-parser.js";
import type { AccountRepository } from "../../ports/repositories/account-repository.js";
import type { CategoryRepository } from "../../ports/repositories/category-repository.js";
import type { ImportProfileRepository } from "../../ports/repositories/import-profile-repository.js";
import type { TransactionRepository } from "../../ports/repositories/transaction-repository.js";
import { readForm, readOptionalQueryValue } from "./request-values.js";
import { renderCsvImportPage } from "./templates/imports.js";
import type { CsvImportPreviewRow } from "./templates/imports.js";

type CsvImportRouteRepositories = {
  accounts: AccountRepository;
  categories: CategoryRepository;
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
      renderCsvImportPage({
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
    const profile = createImportProfile({
      id: randomUUID(),
      name: readRequiredFormText(form, "profileName", "Profile name is required"),
      kind: "custom",
      delimiter: ";",
      encoding: readFormEncoding(form),
      dateColumn: readRequiredFormText(form, "dateColumn", "Date column is required"),
      amountColumn: readRequiredFormText(form, "amountColumn", "Amount column is required"),
      descriptionColumn: readRequiredFormText(
        form,
        "descriptionColumn",
        "Description column is required",
      ),
      payeeColumn: readOptionalFormText(form, "payeeColumn"),
      categoryColumn: readOptionalFormText(form, "categoryColumn"),
    });

    await repositories.importProfiles.save(profile);

    return reply.redirect(`/imports/csv?profileId=${encodeURIComponent(profile.id)}&saved=1`);
  } catch (error: unknown) {
    return reply
      .status(400)
      .type("text/html; charset=utf-8")
      .send(
        renderCsvImportPage({
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
    const profile = createImportProfile({
      id: "preview-profile",
      name: "Preview profile",
      kind: "custom",
      delimiter: ";",
      encoding: readEncoding(form),
      dateColumn: readRequiredText(form, "dateColumn", "Date column is required"),
      amountColumn: readRequiredText(form, "amountColumn", "Amount column is required"),
      descriptionColumn: readRequiredText(
        form,
        "descriptionColumn",
        "Description column is required",
      ),
      payeeColumn: readOptionalText(form, "payeeColumn"),
      categoryColumn: readOptionalText(form, "categoryColumn"),
    });
    const rows = await csvParser.parse(readRequiredFile(form, "csvFile"), {
      accountId: readRequiredText(form, "accountId", "Import account is required"),
      profile,
    });
    const previewRows = createPreviewRows(
      rows,
      detectDuplicateImportRows(rows, await readExistingImportHashes(repositories)),
      categories,
    );

    return reply
      .type("text/html; charset=utf-8")
      .send(renderCsvImportPage({ accounts, categories, importProfiles, previewRows }));
  } catch (error: unknown) {
    return reply
      .status(400)
      .type("text/html; charset=utf-8")
      .send(
        renderCsvImportPage({
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
        fixedCost: false,
        note: null,
        importHash: row.importHash,
      }),
    );
    existingImportHashes.add(row.importHash);
  }

  return reply.redirect("/transactions");
}

type PreviewRowPayload = CsvTransactionImportRow & {
  categoryId: string;
};

function createPreviewRows(
  parsedRows: ParsedCsvTransactionRow[],
  importRows: CsvTransactionImportRow[],
  categories: { id: string; name: string }[],
): CsvImportPreviewRow[] {
  return importRows.map((row, index) => {
    const matchedCategory = matchCategory(categories, parsedRows[index]?.categoryName ?? null);

    return {
      ...row,
      categoryId: matchedCategory.id,
      categoryName: matchedCategory.name,
    };
  });
}

function matchCategory(
  categories: { id: string; name: string }[],
  csvCategoryName: string | null,
): { id: string; name: string } {
  const normalizedCsvCategoryName = normalizeMatchText(csvCategoryName ?? "");
  const matchedCategory = categories.find(
    (category) => normalizeMatchText(category.name) === normalizedCsvCategoryName,
  );

  return (
    matchedCategory ??
    categories.find((category) => category.id === "category-other") ??
    categories[0]
  );
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

function parsePreviewRows(value: string | undefined): PreviewRowPayload[] {
  if (value === undefined || value.trim() === "") {
    throw new Error("Import preview rows are required");
  }

  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Import preview rows are invalid");
  }

  return parsed.map(readPreviewRowPayload);
}

function readPreviewRowPayload(value: unknown): PreviewRowPayload {
  if (typeof value !== "object" || value === null) {
    throw new Error("Import preview row is invalid");
  }

  const row = value as Record<string, unknown>;
  return {
    accountId: readString(row, "accountId"),
    categoryId: readString(row, "categoryId"),
    date: readString(row, "date"),
    amountCents: readNumber(row, "amountCents"),
    description: readString(row, "description"),
    payee: readNullableString(row, "payee"),
    importHash: readString(row, "importHash"),
    duplicate: readBoolean(row, "duplicate"),
  };
}

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Import preview row is invalid");
  }

  return value;
}

function readNullableString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("Import preview row is invalid");
  }

  return value;
}

function readNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("Import preview row is invalid");
  }

  return value;
}

function readBoolean(row: Record<string, unknown>, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") {
    throw new Error("Import preview row is invalid");
  }

  return value;
}

type MultipartForm = Record<string, string | Buffer | undefined>;

function readMultipartForm(body: unknown): MultipartForm {
  if (typeof body !== "object" || body === null) {
    return {};
  }

  return body as MultipartForm;
}

function readRequiredText(form: MultipartForm, key: string, message: string): string {
  const value = form[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(message);
  }

  return value.trim();
}

function readOptionalText(form: MultipartForm, key: string): string | null {
  const value = form[key];
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return value.trim();
}

function readEncoding(form: MultipartForm): ImportProfileEncoding {
  const encoding = readRequiredText(form, "encoding", "CSV encoding is required");
  if (encoding !== "utf8" && encoding !== "latin1") {
    throw new Error("CSV encoding is invalid");
  }

  return encoding;
}

function readFormEncoding(form: Record<string, string | undefined>): ImportProfileEncoding {
  const encoding = readRequiredFormText(form, "encoding", "CSV encoding is required");
  if (encoding !== "utf8" && encoding !== "latin1") {
    throw new Error("CSV encoding is invalid");
  }

  return encoding;
}

function readRequiredFormText(
  form: Record<string, string | undefined>,
  key: string,
  message: string,
): string {
  const value = form[key];
  if (value === undefined || value.trim() === "") {
    throw new Error(message);
  }

  return value.trim();
}

function readOptionalFormText(
  form: Record<string, string | undefined>,
  key: string,
): string | null {
  const value = form[key];
  if (value === undefined || value.trim() === "") {
    return null;
  }

  return value.trim();
}

function readRequiredFile(form: MultipartForm, key: string): Buffer {
  const value = form[key];
  if (!Buffer.isBuffer(value) || value.length === 0) {
    throw new Error("CSV file is required");
  }

  return value;
}
