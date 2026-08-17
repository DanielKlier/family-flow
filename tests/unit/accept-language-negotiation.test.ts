import { describe, expect, it } from "vitest";

import * as localizationHttp from "../../src/adapters/http/localization.js";

type SupportedLocale = "de-DE" | "en";
type ResolveRequestLocale = (
  acceptLanguage: string | undefined,
  defaultLocale: SupportedLocale,
) => SupportedLocale;

function resolveRequestLocale(
  acceptLanguage: string | undefined,
  defaultLocale: SupportedLocale = "de-DE",
): SupportedLocale {
  const resolver = (localizationHttp as Record<string, unknown>).resolveRequestLocale;
  expect(resolver).toBeTypeOf("function");
  return (resolver as ResolveRequestLocale)(acceptLanguage, defaultLocale);
}

describe("Accept-Language locale negotiation", () => {
  it.each([
    ["de-DE", "de-DE"],
    ["en-GB,en;q=0.9", "en"],
    ["de-AT,de;q=0.8", "de-DE"],
    ["en;q=0.4,de;q=0.9", "de-DE"],
    ["en;q=0.8,de;q=0.8", "en"],
    ["de;q=0,en;q=0.5", "en"],
    ["*", "de-DE"],
    [undefined, "de-DE"],
    ["not a language range", "de-DE"],
    ["fr-CA, es;q=0.8", "de-DE"],
    ["not a language range, en-GB;q=0.8", "en"],
  ] as const)("selects %s as %s", (acceptLanguage, expected) => {
    expect(resolveRequestLocale(acceptLanguage)).toBe(expected);
  });

  it("UNIT-FF-LOC-005-01 ranks each representation by its most specific matching range", () => {
    expect(resolveRequestLocale("de-DE;q=0.4,de;q=0.9,en;q=0.8")).toBe("en");
  });

  it.each([
    ["de;q=0,*;q=1", "en"],
    ["de-DE;q=0,de;q=1", "en"],
    ["en;q=0,*;q=0.5", "de-DE"],
    ["de;q=0,en;q=0", "de-DE"],
  ] as const)(
    "UNIT-FF-LOC-005-02 honors explicit exclusions in %s by selecting %s",
    (acceptLanguage, expected) => {
      expect(resolveRequestLocale(acceptLanguage)).toBe(expected);
    },
  );

  it("rejects pathological malformed input without polynomial backtracking", {
    timeout: 500,
  }, () => {
    expect(resolveRequestLocale(`*${" ".repeat(50_000)}x`)).toBe("de-DE");
  });

  it("uses the configured default when no acceptable supported language is selected", () => {
    expect(resolveRequestLocale("*", "en")).toBe("en");
    expect(resolveRequestLocale(undefined, "en")).toBe("en");
    expect(resolveRequestLocale("fr;q=0.9", "en")).toBe("en");
  });
});
