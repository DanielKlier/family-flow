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
        accountId: "account-shared-checking",
        date: "2026-07-15",
        amountCents: -4299,
        description: "Card payment",
        payee: "Shop",
        categoryName: null,
      },
    ]);
  });

  it("parses CSV rows with quoted delimiter characters", async () => {
    const parser = new SimpleCsvParser();
    const csv = [
      "Date;Payee;Description;Amount",
      '2026-07-16;Online shop;"Order; home";-123.45',
    ].join("\n");

    await expect(
      parser.parse(Buffer.from(csv, "utf8"), {
        accountId: "account-person-a-checking",
        profile: genericProfile,
      }),
    ).resolves.toEqual([
      {
        accountId: "account-person-a-checking",
        date: "2026-07-16",
        amountCents: -12345,
        description: "Order; home",
        payee: "Online shop",
        categoryName: null,
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
        date: "2026-07-15",
        categoryName: "Lebensmittel",
      }),
    ]);
  });

  it("ignores CSV rows with zero amounts", async () => {
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
      expect.objectContaining({ date: "2026-07-15", amountCents: -4299 }),
      expect.objectContaining({ date: "2026-07-17", amountCents: -1000 }),
    ]);
  });

  it("ignores CSV rows with positive amounts", async () => {
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
      expect.objectContaining({ date: "2026-07-15", amountCents: -4299 }),
      expect.objectContaining({ date: "2026-07-17", amountCents: -1000 }),
    ]);
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
