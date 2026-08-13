import { normalizeCsvTransactionRow } from "../../core/imports/csv-import.js";
import type {
  CsvParser,
  CsvParserInput,
  CsvRowOutcome,
  ParsedCsvTransactionRow,
} from "../../ports/csv/csv-parser.js";

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_DATA_ROWS = 10_000;

export class SimpleCsvParser implements CsvParser {
  async parse(file: Buffer, input: CsvParserInput): Promise<CsvRowOutcome[]> {
    if (file.length > MAX_CSV_BYTES) throw new Error("CSV file exceeds 5 MiB limit");
    const content = decodeCsvFile(file, input.profile.encoding);
    if (containsBinaryControl(content)) {
      throw new Error("CSV file contains binary data");
    }
    const records = parseDelimitedRecords(content, input.profile.delimiter);
    const [headers, ...rows] = records;
    if (headers === undefined || !headers.some((cell) => cell.trim() !== "")) {
      throw new Error("CSV file is empty");
    }
    if (rows.length > MAX_DATA_ROWS) throw new Error("CSV file exceeds 10,000 data-row limit");
    validateStructure(headers.length, rows);
    const mapping = createColumnMapping(headers, input);

    return rows.map((row, index) => normalizeImportRow(row, index + 2, mapping, input));
  }
}

type ColumnMapping = {
  dateColumn: number;
  amountColumn: number;
  descriptionColumn: number;
  payeeColumn: number | null;
  purposeColumn: number | null;
  categoryColumn: number | null;
};

function containsBinaryControl(content: string): boolean {
  return [...content].some((character) => {
    const code = character.charCodeAt(0);
    return (code < 32 && code !== 9 && code !== 10 && code !== 13) || (code >= 127 && code <= 159);
  });
}

function decodeCsvFile(file: Buffer, encoding: CsvParserInput["profile"]["encoding"]): string {
  if (encoding === "latin1") return file.toString("latin1");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(file);
  } catch {
    throw new Error("CSV file is not valid UTF-8");
  }
}

function createColumnMapping(headers: string[], input: CsvParserInput): ColumnMapping {
  const optional = (column: string | null) =>
    column === null ? null : findColumn(headers, column);
  return {
    dateColumn: findColumn(headers, input.profile.dateColumn),
    amountColumn: findColumn(headers, input.profile.amountColumn),
    descriptionColumn: findColumn(headers, input.profile.descriptionColumn),
    payeeColumn: optional(input.profile.payeeColumn),
    purposeColumn: optional(input.profile.purposeColumn),
    categoryColumn: optional(input.profile.categoryColumn),
  };
}

function findColumn(headers: string[], columnName: string): number {
  const index = headers.findIndex((header) => header.trim() === columnName);
  if (index === -1) throw new Error(`CSV column is missing: ${columnName}`);
  return index;
}

function normalizeImportRow(
  row: string[],
  line: number,
  mapping: ColumnMapping,
  input: CsvParserInput,
): CsvRowOutcome {
  try {
    const normalizedRow = normalizeCsvTransactionRow({
      accountId: input.accountId,
      date: normalizeDateCell(readCell(row, mapping.dateColumn), input),
      amount: normalizeAmountCell(readCell(row, mapping.amountColumn), input),
      description: readCell(row, mapping.descriptionColumn),
      payee: readOptionalMappedCell(row, mapping.payeeColumn),
      purpose: readOptionalMappedCell(row, mapping.purposeColumn),
    });
    if (normalizedRow.amountCents > 0) {
      return { line, outcome: "ignored", reason: "amount-not-negative" };
    }
    const parsedRow: ParsedCsvTransactionRow = {
      ...normalizedRow,
      categoryName: readOptionalMappedCell(row, mapping.categoryColumn),
    };
    return { line, outcome: "importable", row: parsedRow };
  } catch (error: unknown) {
    if (!(error instanceof Error)) throw error;
    if (error.message === "CSV amount must not be zero") {
      return { line, outcome: "ignored", reason: "amount-not-negative" };
    }
    if (error.message.startsWith("CSV date"))
      return { line, outcome: "invalid", reason: "invalid-date" };
    if (error.message === "CSV description is required") {
      return { line, outcome: "invalid", reason: "missing-description" };
    }
    if (error.message.startsWith("CSV amount"))
      return { line, outcome: "invalid", reason: "invalid-amount" };
    throw error;
  }
}

function normalizeDateCell(value: string, input: CsvParserInput): string {
  const trimmed = value.trim();
  if (input.profile.dateFormat === "YYYY-MM-DD") return trimmed;
  const match = /^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/.exec(trimmed);
  if (match === null) throw new Error("CSV date does not match profile format");
  const [, day, month, rawYear] = match;
  if ((input.profile.dateFormat === "DD.MM.YY") !== (rawYear?.length === 2)) {
    throw new Error("CSV date does not match profile format");
  }
  return `${rawYear?.length === 2 ? `20${rawYear}` : rawYear}-${month}-${day}`;
}

function normalizeAmountCell(value: string, input: CsvParserInput): string {
  const compact = value.trim();
  if (input.profile.decimalFormat === "dot-decimal") {
    if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(compact)) {
      throw new Error("CSV amount does not match profile format");
    }
    return compact.replaceAll(",", "");
  }
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(compact)) {
    throw new Error("CSV amount does not match profile format");
  }
  return compact.replaceAll(".", "").replace(",", ".");
}

function readCell(row: string[], index: number): string {
  return row[index] ?? "";
}

function readOptionalMappedCell(row: string[], index: number | null): string | null {
  if (index === null) return null;
  const value = readCell(row, index).trim();
  return value === "" ? null : value;
}

function validateStructure(width: number, rows: string[][]): void {
  rows.forEach((row, index) => {
    if (row.length !== width)
      throw new Error(`CSV record has inconsistent column count at line ${index + 2}`);
  });
}

function parseDelimitedRecords(content: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let state: "plain" | "quoted" | "after-quote" = "plain";
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];
    if (state === "quoted") {
      if (character === '"' && nextCharacter === '"') {
        cell += '"';
        index += 1;
        continue;
      }
      if (character === '"') {
        state = "after-quote";
        continue;
      }
      cell += character;
      continue;
    }
    if (state === "plain" && character === '"') {
      if (cell !== "") throw new Error("CSV quote is malformed");
      state = "quoted";
      continue;
    }
    const atDelimiter = character === delimiter;
    const atLineEnd = character === "\n" || character === "\r";
    if (state === "after-quote" && !atDelimiter && !atLineEnd) {
      throw new Error("CSV quote is malformed");
    }
    if (atDelimiter) {
      record.push(cell);
      cell = "";
      state = "plain";
      continue;
    }
    if (atLineEnd) {
      record.push(cell);
      records.push(record);
      record = [];
      cell = "";
      state = "plain";
      if (character === "\r" && nextCharacter === "\n") index += 1;
      continue;
    }
    cell += character;
  }
  if (state === "quoted") throw new Error("CSV quoted field is not closed");
  if (cell !== "" || record.length > 0 || state === "after-quote") {
    record.push(cell);
    records.push(record);
  }
  return records;
}
