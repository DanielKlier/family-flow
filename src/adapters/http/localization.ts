import type { FastifyInstance } from "fastify";

import type { Localization } from "../../ports/localization/localization.js";
import {
  type LocalizationRegistry,
  type SupportedLocale,
  supportedLocales,
} from "../localization/registry.js";

declare module "fastify" {
  interface FastifyRequest {
    localization: Localization;
    locale: SupportedLocale;
  }
}

export function registerRequestLocalization(
  server: FastifyInstance,
  localizations: LocalizationRegistry,
  defaultLocale: SupportedLocale,
): void {
  server.decorateRequest("localization");
  server.decorateRequest("locale");
  server.addHook("onRequest", async (request) => {
    request.locale = resolveRequestLocale(request.headers["accept-language"], defaultLocale);
    request.localization = localizations[request.locale];
  });
  server.addHook("onSend", async (request, reply, payload) => {
    const contentType = reply.getHeader("content-type");
    if (typeof contentType !== "string" || !contentType.startsWith("text/html")) return payload;

    reply.header("Content-Language", request.locale);
    reply.header("Vary", appendVary(reply.getHeader("vary"), "Accept-Language"));
    return payload;
  });
}

export function resolveRequestLocale(
  acceptLanguage: string | string[] | undefined,
  defaultLocale: SupportedLocale,
): SupportedLocale {
  if (acceptLanguage === undefined) return defaultLocale;
  const value = Array.isArray(acceptLanguage) ? acceptLanguage.join(",") : acceptLanguage;
  const candidates = value
    .split(",")
    .map(parseLanguageRange)
    .filter((candidate): candidate is LanguageCandidate => candidate !== null);
  const representations = supportedLocales.map((locale, order) => ({
    locale,
    order,
    preference: findRepresentationPreference(locale, candidates),
  }));
  const acceptable = representations
    .filter(
      (representation): representation is RepresentationPreference =>
        representation.preference !== undefined && representation.preference.quality > 0,
    )
    .sort(
      (left, right) =>
        right.preference.quality - left.preference.quality ||
        left.preference.order - right.preference.order ||
        Number(right.locale === defaultLocale) - Number(left.locale === defaultLocale) ||
        left.order - right.order,
    );
  if (acceptable[0] !== undefined) return acceptable[0].locale;

  return (
    representations.find(
      ({ locale, preference }) => locale === defaultLocale && preference?.quality !== 0,
    )?.locale ??
    representations.find(({ preference }) => preference?.quality !== 0)?.locale ??
    defaultLocale
  );
}

type LanguageCandidate = { range: string; quality: number; order: number };
type RepresentationPreference = {
  locale: SupportedLocale;
  order: number;
  preference: LanguageCandidate;
};

function findRepresentationPreference(
  locale: SupportedLocale,
  candidates: LanguageCandidate[],
): LanguageCandidate | undefined {
  return candidates
    .map((candidate) => ({ candidate, specificity: rangeSpecificity(candidate.range, locale) }))
    .filter(
      (match): match is { candidate: LanguageCandidate; specificity: number } =>
        match.specificity !== null,
    )
    .sort(
      (left, right) =>
        right.specificity - left.specificity || left.candidate.order - right.candidate.order,
    )[0]?.candidate;
}

function rangeSpecificity(range: string, locale: SupportedLocale): number | null {
  if (range === "*") return 0;
  const normalizedLocale = locale.toLowerCase();
  if (range === normalizedLocale) return range.split("-").length;
  return range.split("-", 1)[0] === normalizedLocale.split("-", 1)[0] ? 1 : null;
}

function parseLanguageRange(value: string, order: number): LanguageCandidate | null {
  const candidate = value.trim();
  const separator = candidate.indexOf(";");
  const range = (separator === -1 ? candidate : candidate.slice(0, separator)).trimEnd();
  if (!isLanguageRange(range)) return null;
  if (separator === -1) return { range: range.toLowerCase(), quality: 1, order };
  if (candidate.indexOf(";", separator + 1) !== -1) return null;

  const quality = parseQuality(candidate.slice(separator + 1).trim());
  return quality === null ? null : { range: range.toLowerCase(), quality, order };
}

function isLanguageRange(value: string): boolean {
  if (value === "*") return true;
  const subtags = value.split("-");
  return subtags.every(
    (subtag, index) =>
      subtag.length >= 1 &&
      subtag.length <= 8 &&
      [...subtag].every(index === 0 ? isAsciiLetter : isAsciiAlphanumeric),
  );
}

function parseQuality(value: string): number | null {
  if (!value.startsWith("q=")) return null;
  const quality = value.slice(2);
  if (quality === "0") return 0;
  if (quality === "1") return 1;
  if (quality.length < 3 || quality.length > 5 || quality[1] !== ".") return null;
  const fraction = quality.slice(2);
  if (quality[0] === "0" && [...fraction].every(isAsciiDigit)) return Number(quality);
  if (quality[0] === "1" && [...fraction].every((character) => character === "0")) return 1;
  return null;
}

function isAsciiLetter(character: string): boolean {
  const code = character.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isAsciiDigit(character: string): boolean {
  const code = character.charCodeAt(0);
  return code >= 48 && code <= 57;
}

function isAsciiAlphanumeric(character: string): boolean {
  return isAsciiLetter(character) || isAsciiDigit(character);
}

function appendVary(current: string | string[] | number | undefined, value: string): string {
  const values = (Array.isArray(current) ? current : [current])
    .flatMap((entry) => String(entry ?? "").split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!values.some((entry) => entry.toLowerCase() === value.toLowerCase())) values.push(value);
  return values.join(", ");
}
