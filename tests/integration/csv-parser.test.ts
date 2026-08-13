import { describe, expect, it } from "vitest";

import { SimpleCsvParser } from "../../src/adapters/csv/simple-csv-parser.js";
import { createImportProfile } from "../../src/core/imports/import-profile.js";

const genericProfile = createImportProfile({
  id: "profile-generic-bank",
  name: "Generic bank",
  kind: "custom",
  delimiter: ";",
  encoding: "utf8",
  dateColumn: "Date",
  amountColumn: "Amount",
  descriptionColumn: "Description",
  payeeColumn: "Payee",
});

describe("CSV parser", () => {
  it("parses CSV rows through an import profile", async () => {
    const parser = new SimpleCsvParser();
    const csv = ["Date;Payee;Description;Amount", "15.07.2026;Shop;Card payment;-42,99"].join("\n");

    await expect(
      parser.parse(Buffer.from(csv, "utf8"), {
        accountId: "account-shared-checking",
        profile: genericProfile,
      }),
    ).resolves.toEqual([
      {
        line: 2,
        outcome: "importable",
        row: {
          accountId: "account-shared-checking",
          date: "2026-07-15",
          amountCents: -4299,
          description: "Card payment",
          payee: "Shop",
          purpose: null,
          categoryName: null,
        },
      },
    ]);
  });

  it("parses CSV rows with quoted delimiter characters", async () => {
    const parser = new SimpleCsvParser();
    const profile = createImportProfile({
      ...genericProfile,
      dateFormat: "YYYY-MM-DD",
      decimalFormat: "dot-decimal",
    });
    const csv = [
      "Date;Payee;Description;Amount",
      '2026-07-16;Online shop;"Order; home";-123.45',
    ].join("\n");

    await expect(
      parser.parse(Buffer.from(csv, "utf8"), {
        accountId: "account-person-a-checking",
        profile,
      }),
    ).resolves.toEqual([
      {
        line: 2,
        outcome: "importable",
        row: {
          accountId: "account-person-a-checking",
          date: "2026-07-16",
          amountCents: -12345,
          description: "Order; home",
          payee: "Online shop",
          purpose: null,
          categoryName: null,
        },
      },
    ]);
  });

  it("parses optional CSV category columns", async () => {
    const parser = new SimpleCsvParser();
    const profile = createImportProfile({
      ...genericProfile,
      categoryColumn: "Category",
    });
    const csv = [
      "Date;Payee;Description;Amount;Category",
      "15.07.2026;Shop;Card payment;-42,99;Lebensmittel",
    ].join("\n");

    await expect(
      parser.parse(Buffer.from(csv, "utf8"), {
        accountId: "account-shared-checking",
        profile,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        outcome: "importable",
        row: expect.objectContaining({
          date: "2026-07-15",
          categoryName: "Lebensmittel",
        }),
      }),
    ]);
  });

  it("INT-FF-CSV-007-01: retains ignored and invalid cells as line-aware row outcomes", async () => {
    const parser = new SimpleCsvParser();
    const csv = [
      "Date;Payee;Description;Amount",
      "15.07.2026;Shop;Card payment;-42,99",
      "16.07.2026;Bank;Balance notice;0,00",
      "31.02.2026;Shop;Impossible date;-10,00",
    ].join("\n");

    await expect(
      parser.parse(Buffer.from(csv, "utf8"), {
        accountId: "account-shared-checking",
        profile: genericProfile,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        line: 2,
        outcome: "importable",
        row: expect.objectContaining({ amountCents: -4299 }),
      }),
      expect.objectContaining({
        line: 3,
        outcome: "ignored",
        reason: "amount-not-negative",
      }),
      expect.objectContaining({
        line: 4,
        outcome: "invalid",
        reason: "invalid-date",
      }),
    ]);
  });

  it("reports CSV rows with zero amounts as ignored", async () => {
    const parser = new SimpleCsvParser();
    const csv = [
      "Date;Payee;Description;Amount",
      "15.07.2026;Shop;Card payment;-42,99",
      "16.07.2026;Bank;Neutral booking;0,00",
      "17.07.2026;Online shop;Order;-10,00",
    ].join("\n");

    await expect(
      parser.parse(Buffer.from(csv, "utf8"), {
        accountId: "account-shared-checking",
        profile: genericProfile,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        outcome: "importable",
        row: expect.objectContaining({ date: "2026-07-15", amountCents: -4299 }),
      }),
      { line: 3, outcome: "ignored", reason: "amount-not-negative" },
      expect.objectContaining({
        outcome: "importable",
        row: expect.objectContaining({ date: "2026-07-17", amountCents: -1000 }),
      }),
    ]);
  });

  it("rejects malformed grouping and amounts outside the safe minor-unit range", async () => {
    const parser = new SimpleCsvParser();
    const csv = [
      "Date;Payee;Description;Amount",
      "15.07.2026;Shop;Malformed;-1.2.3,45",
      "16.07.2026;Shop;Largest safe;-90.071.992.547.409,91",
      "17.07.2026;Shop;Unsafe;-90.071.992.547.409,92",
      `18.07.2026;Shop;Huge;-${"9".repeat(400)},00`,
      "19.07.2026;Shop;Unsupported spacing;-1 234,56",
    ].join("\n");

    await expect(
      parser.parse(Buffer.from(csv, "utf8"), {
        accountId: "account-shared-checking",
        profile: genericProfile,
      }),
    ).resolves.toEqual([
      { line: 2, outcome: "invalid", reason: "invalid-amount" },
      expect.objectContaining({
        line: 3,
        outcome: "importable",
        row: expect.objectContaining({ amountCents: Number.MIN_SAFE_INTEGER }),
      }),
      { line: 4, outcome: "invalid", reason: "invalid-amount" },
      { line: 5, outcome: "invalid", reason: "invalid-amount" },
      { line: 6, outcome: "invalid", reason: "invalid-amount" },
    ]);
  });

  it("enforces the selected dot-decimal grammar", async () => {
    const parser = new SimpleCsvParser();
    const profile = createImportProfile({
      ...genericProfile,
      decimalFormat: "dot-decimal",
    });
    const csv = [
      "Date;Payee;Description;Amount",
      "15.07.2026;Shop;Valid;-1234.56",
      '16.07.2026;Shop;Comma grouping;"-1,234.56"',
      '17.07.2026;Shop;Repeated separator;"-1,2,3.45"',
    ].join("\n");

    await expect(
      parser.parse(Buffer.from(csv, "utf8"), {
        accountId: "account-shared-checking",
        profile,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        line: 2,
        outcome: "importable",
        row: expect.objectContaining({ amountCents: -123456 }),
      }),
      expect.objectContaining({
        line: 3,
        outcome: "importable",
        row: expect.objectContaining({ amountCents: -123456 }),
      }),
      { line: 4, outcome: "invalid", reason: "invalid-amount" },
    ]);
  });

  it("reports CSV rows with positive amounts as ignored", async () => {
    const parser = new SimpleCsvParser();
    const csv = [
      "Date;Payee;Description;Amount",
      "15.07.2026;Shop;Card payment;-42,99",
      "16.07.2026;Employer;Salary;2500,00",
      "17.07.2026;Online shop;Order;-10,00",
    ].join("\n");

    await expect(
      parser.parse(Buffer.from(csv, "utf8"), {
        accountId: "account-shared-checking",
        profile: genericProfile,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        outcome: "importable",
        row: expect.objectContaining({ date: "2026-07-15", amountCents: -4299 }),
      }),
      { line: 3, outcome: "ignored", reason: "amount-not-negative" },
      expect.objectContaining({
        outcome: "importable",
        row: expect.objectContaining({ date: "2026-07-17", amountCents: -1000 }),
      }),
    ]);
  });

  it("INT-FF-CSV-006-01: accepts exactly 5 MiB and 10,000 data rows but rejects either limit plus one", async () => {
    const parser = new SimpleCsvParser();
    const csvFileWithExactSize = (size: number) => {
      const header = "Date;Payee;Description;Amount\n";
      const prefix = "15.07.2026;Shop;";
      const suffix = ";-1,00";
      const descriptionLength = size - Buffer.byteLength(header + prefix + suffix, "utf8");
      return Buffer.from(`${header}${prefix}${"x".repeat(descriptionLength)}${suffix}`, "utf8");
    };
    const csvFileWithDataRows = (rowCount: number) =>
      Buffer.from(
        [
          "Date;Payee;Description;Amount",
          ...Array.from(
            { length: rowCount },
            (_, index) => `15.07.2026;Shop;Expense ${index};-1,00`,
          ),
        ].join("\n"),
        "utf8",
      );

    await expect(
      parser.parse(csvFileWithExactSize(5 * 1024 * 1024), {
        accountId: "account-shared-checking",
        profile: genericProfile,
      }),
    ).resolves.toHaveLength(1);
    await expect(
      parser.parse(csvFileWithExactSize(5 * 1024 * 1024 + 1), {
        accountId: "account-shared-checking",
        profile: genericProfile,
      }),
    ).rejects.toThrow("CSV file exceeds 5 MiB limit");

    await expect(
      parser.parse(csvFileWithDataRows(10_000), {
        accountId: "account-shared-checking",
        profile: genericProfile,
      }),
    ).resolves.toHaveLength(10_000);
    await expect(
      parser.parse(csvFileWithDataRows(10_001), {
        accountId: "account-shared-checking",
        profile: genericProfile,
      }),
    ).rejects.toThrow("CSV file exceeds 10,000 data-row limit");
  });

  it("INT-FF-CSV-006-01: rejects the 10,001st data row before preview", async () => {
    const parser = new SimpleCsvParser();
    const csvFileWithDataRows = (rowCount: number) =>
      Buffer.from(
        [
          "Date;Payee;Description;Amount",
          ...Array.from(
            { length: rowCount },
            (_, index) => `15.07.2026;Shop;Expense ${index};-1,00`,
          ),
        ].join("\n"),
        "utf8",
      );

    await expect(
      parser.parse(csvFileWithDataRows(10_000), {
        accountId: "account-shared-checking",
        profile: genericProfile,
      }),
    ).resolves.toHaveLength(10_000);
    await expect(
      parser.parse(csvFileWithDataRows(10_001), {
        accountId: "account-shared-checking",
        profile: genericProfile,
      }),
    ).rejects.toThrow("CSV file exceeds 10,000 data-row limit");
  });

  it("INT-FF-CSV-007-01: rejects inconsistent CSV record structure before producing row outcomes", async () => {
    const parser = new SimpleCsvParser();
    const csv = [
      "Date;Payee;Description;Amount",
      "15.07.2026;Shop;Card payment;-42,99",
      "16.07.2026;Bank;Missing amount",
    ].join("\n");

    await expect(
      parser.parse(Buffer.from(csv, "utf8"), {
        accountId: "account-shared-checking",
        profile: genericProfile,
      }),
    ).rejects.toThrow("CSV record has inconsistent column count at line 3");
  });

  it("INT-FF-CSV-007-01: rejects binary, malformed UTF-8, and malformed quotes for the whole file", async () => {
    const parser = new SimpleCsvParser();
    const parse = (file: Buffer) =>
      parser.parse(file, { accountId: "account-shared-checking", profile: genericProfile });
    await expect(parse(Buffer.from("Date;Payee;Description;Amount\0\n"))).rejects.toThrow(
      "binary data",
    );
    await expect(parse(Buffer.from([0xff, 0xfe]))).rejects.toThrow("not valid UTF-8");
    await expect(
      parse(Buffer.from("Date;Payee;Description;Amount\n15.07.2026;Shop;control\x01byte;-1,00")),
    ).rejects.toThrow("binary data");
    await expect(
      parse(Buffer.from('Date;Payee;Description;Amount\n15.07.2026;Shop;bad"quote;-1,00')),
    ).rejects.toThrow("quote is malformed");
  });

  it("reports missing mapped columns with a human-readable error", async () => {
    const parser = new SimpleCsvParser();
    const csv = ["Date;Description", "15.07.2026;Card payment"].join("\n");

    await expect(
      parser.parse(Buffer.from(csv, "utf8"), {
        accountId: "account-shared-checking",
        profile: genericProfile,
      }),
    ).rejects.toThrow("CSV column is missing: Amount");
  });
});
