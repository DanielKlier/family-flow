export type LocalizationValues = Readonly<Record<string, string | number>>;

export type MasterDataSeedType = "ownerContext" | "account" | "category";

export interface MasterDataNameProvider {
  seedName(type: MasterDataSeedType, id: string): string;
}

export interface Localization extends MasterDataNameProvider {
  readonly locale: string;
  text(key: string, values?: LocalizationValues): string;
  formatAmount(cents: number): string;
  formatDate(value: string): string;
  formatMonth(value: string): string;
  parseAmountCents(value: string, allowZero: boolean): number;
  parseExpenseCents(value: string): number;
  parseDate(value: string): string;
  parseMonth(value: string): string;
  errorMessage(error: unknown, fallbackKey: string): string;
  isInputError(error: unknown): boolean;
  requiredField(field: "account" | "category" | "date" | "description" | "amount"): Error;
  caseFold(value: string): string;
}
