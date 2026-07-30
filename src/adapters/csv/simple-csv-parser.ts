import { normalizeCsvTransactionRow } from "../../core/imports/csv-import.js";
import type {
  CsvParser,
  CsvParserInput,
  ParsedCsvTransactionRow,
} from "../../ports/csv/csv-parser.js";

export class SimpleCsvParser implements CsvParser {
  async parse(file: Buffer, input: CsvParserInput) {
    const content = decodeCsvFile(file, input.profile.encoding);
    const records = parseDelimitedRecords(content, input.profile.delimiter);
    const [headers, ...rows] = records.filter((record) =>
      record.some((cell) => cell.trim() !== ""),
    );

    if (headers === undefined) {
      throw new Error("CSV file is empty");
    }

    const mapping = createColumnMapping(headers, input);

    const normalizedRows: ParsedCsvTransactionRow[] = [];

    for (const row of rows) {
      const normalizedRow = normalizeImportRow(row, mapping, input);
      if (normalizedRow !== null) {
        normalizedRows.push(normalizedRow);
      }
    }

    return normalizedRows;
  }
}

type ColumnMapping = {
  dateColumn: number;
  amountColumn: number;
  descriptionColumn: number;
  payeeColumn: number | null;
  categoryColumn: number | null;
};

function decodeCsvFile(file: Buffer, encoding: CsvParserInput["profile"]["encoding"]): string {
  return file.toString(encoding);
}

function createColumnMapping(headers: string[], input: CsvParserInput): ColumnMapping {
  return {
    dateColumn: findColumn(headers, input.profile.dateColumn),
    amountColumn: findColumn(headers, input.profile.amountColumn),
    descriptionColumn: findColumn(headers, input.profile.descriptionColumn),
    payeeColumn:
      input.profile.payeeColumn === null ? null : findColumn(headers, input.profile.payeeColumn),
    categoryColumn:
      input.profile.categoryColumn === null
        ? null
        : findColumn(headers, input.profile.categoryColumn),
  };
}

function findColumn(headers: string[], columnName: string): number {
  const index = headers.findIndex((header) => header.trim() === columnName);

  if (index === -1) {
    throw new Error(`CSV column is missing: ${columnName}`);
  }

  return index;
}

function readCell(row: string[], index: number): string {
  return row[index] ?? "";
}

function normalizeImportRow(
  row: string[],
  mapping: ColumnMapping,
  input: CsvParserInput,
): ParsedCsvTransactionRow | null {
  try {
    const normalizedRow = normalizeCsvTransactionRow({
      accountId: input.accountId,
      date: readCell(row, mapping.dateColumn),
      amount: readCell(row, mapping.amountColumn),
      description: readCell(row, mapping.descriptionColumn),
      payee: mapping.payeeColumn === null ? null : readCell(row, mapping.payeeColumn),
    });

    if (normalizedRow.amountCents > 0) {
      return null;
    }

    return {
      ...normalizedRow,
      categoryName:
        mapping.categoryColumn === null ? null : readOptionalCell(row, mapping.categoryColumn),
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CSV amount must not be zero") {
      return null;
    }

    throw error;
  }
}

function readOptionalCell(row: string[], index: number): string | null {
  const value = readCell(row, index).trim();
  return value === "" ? null : value;
}

function parseDelimitedRecords(content: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && character === delimiter) {
      record.push(cell);
      cell = "";
      continue;
    }

    if (!quoted && (character === "\n" || character === "\r")) {
      record.push(cell);
      records.push(record);
      record = [];
      cell = "";

      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      continue;
    }

    cell += character;
  }

  if (quoted) {
    throw new Error("CSV quoted field is not closed");
  }

  if (cell !== "" || record.length > 0) {
    record.push(cell);
    records.push(record);
  }

  return records;
}
