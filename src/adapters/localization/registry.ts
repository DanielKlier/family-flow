import type { Localization } from "../../ports/localization/localization.js";
import { createEnglishLocalization } from "./english.js";
import { createGermanLocalization } from "./german.js";

export const supportedLocales = ["de-DE", "en"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
export type LocalizationRegistry = Readonly<Record<SupportedLocale, Localization>>;

export function createLocalizationRegistry(): LocalizationRegistry {
  return Object.freeze({
    "de-DE": createGermanLocalization(),
    en: createEnglishLocalization(),
  });
}

export function matchLanguageRange(range: string): SupportedLocale | null {
  const language = range.toLowerCase().split("-", 1)[0];
  return (
    supportedLocales.find((locale) => locale.toLowerCase().split("-", 1)[0] === language) ?? null
  );
}

export function readDefaultLocale(value: string | undefined): SupportedLocale {
  if (value === undefined || value.trim() === "") return supportedLocales[0];
  if (isSupportedLocale(value)) return value;
  throw new Error(`DEFAULT_LOCALE must be one of: ${supportedLocales.join(", ")}`);
}

function isSupportedLocale(value: string): value is SupportedLocale {
  return supportedLocales.some((locale) => locale === value);
}
