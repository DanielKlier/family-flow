import type { ImportProfile } from "../../core/imports/import-profile.js";
import type { NormalizedCsvTransactionRow } from "../../core/imports/csv-import.js";

export type ParsedCsvTransactionRow = NormalizedCsvTransactionRow & {
  categoryName: string | null;
};

export type CsvParserInput = {
  accountId: string;
  profile: ImportProfile;
};

export type CsvParser = {
  parse(file: Buffer, input: CsvParserInput): Promise<ParsedCsvTransactionRow[]>;
};
