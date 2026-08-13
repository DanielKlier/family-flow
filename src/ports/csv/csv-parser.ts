import type { NormalizedCsvTransactionRow } from "../../core/imports/csv-import.js";
import type { ImportProfile } from "../../core/imports/import-profile.js";

export type ParsedCsvTransactionRow = NormalizedCsvTransactionRow & {
  categoryName: string | null;
};

export type CsvRowOutcome =
  | { line: number; outcome: "importable"; row: ParsedCsvTransactionRow }
  | { line: number; outcome: "ignored"; reason: "amount-not-negative" }
  | {
      line: number;
      outcome: "invalid";
      reason: "invalid-date" | "invalid-amount" | "missing-description";
    };

export type CsvParserInput = {
  accountId: string;
  profile: ImportProfile;
};

export type CsvParser = {
  parse(file: Buffer, input: CsvParserInput): Promise<CsvRowOutcome[]>;
};
