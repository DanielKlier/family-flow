import { describe, expect, it } from "vitest";

import { createEnglishLocalization } from "../../src/adapters/localization/english.js";
import { messages as englishMessages } from "../../src/adapters/localization/english-catalog.js";
import { messages as germanMessages } from "../../src/adapters/localization/german-catalog.js";

describe("English localization adapter", () => {
  it("keeps the English and German catalogs structurally aligned", () => {
    expect(Object.keys(englishMessages).sort()).toEqual(Object.keys(germanMessages).sort());
  });

  it("formats canonical amounts, dates, and months", () => {
    const localization = createEnglishLocalization();

    expect(localization.formatAmount(123456)).toBe("1,234.56");
    expect(localization.formatAmount(-5)).toBe("0.05");
    expect(localization.formatDate("2026-12-31")).toBe("12/31/2026");
    expect(localization.formatMonth("2026-02")).toBe("02/2026");
  });

  it("parses valid amount, date, month, leap-date, expense, and zero boundaries", () => {
    const localization = createEnglishLocalization();

    for (const [input, expected] of [
      ["1234", 123400],
      ["1234.5", 123450],
      ["1,234.56", 123456],
      ["1,234,567.89", 123456789],
    ] as const) {
      expect(localization.parseAmountCents(input, false)).toBe(expected);
    }

    expect(localization.parseAmountCents("0", true)).toBe(0);
    expect(() => localization.parseAmountCents("0", false)).toThrow("invalid_amount");
    expect(localization.parseExpenseCents("1,234.56")).toBe(-123456);
    expect(localization.parseDate("12/31/2026")).toBe("2026-12-31");
    expect(localization.parseDate("02/29/2024")).toBe("2024-02-29");
    expect(localization.parseMonth("02/2026")).toBe("2026-02");
  });

  it.each([
    ["signed amount", "amount", "-1"],
    ["spaced amount", "amount", " 1"],
    ["currency amount", "amount", "$1"],
    ["exponent amount", "amount", "1e3"],
    ["comma-decimal amount", "amount", "1,23"],
    ["malformed grouping", "amount", "12,34.56"],
    ["excess precision", "amount", "1.234"],
    ["unsafe amount", "amount", "90,071,992,547,409.99"],
    ["invalid leap date", "date", "02/29/2023"],
    ["invalid calendar date", "date", "04/31/2026"],
    ["malformed date", "date", "2/01/2026"],
    ["month below range", "month", "00/2026"],
    ["month above range", "month", "13/2026"],
    ["malformed month", "month", "2/2026"],
  ])("rejects the %s class", (_className, grammar, input) => {
    const localization = createEnglishLocalization();
    const parse =
      grammar === "amount"
        ? () => localization.parseAmountCents(input, false)
        : grammar === "date"
          ? () => localization.parseDate(input)
          : () => localization.parseMonth(input);

    expect(parse).toThrow();
  });
});
