import type { Localization } from "../../ports/localization/localization.js";

export type MissingResource =
  | "account"
  | "category"
  | "categorizationRule"
  | "incomePlan"
  | "transaction";

export function prepareMissingResourceViewModel(
  resource: MissingResource,
  localization: Localization,
) {
  const heading = localization.text(`missing.${resource}.heading`);
  return {
    title: heading,
    heading,
    message: localization.text(`missing.${resource}.message`),
  };
}

export function prepareBadRequestViewModel(
  message: string,
  requestId: string,
  localization: Localization,
) {
  return requestErrorViewModel(
    localization.text("error.badRequest"),
    message,
    requestId,
    localization,
  );
}

export function prepareNotFoundViewModel(requestId: string, localization: Localization) {
  return requestErrorViewModel(
    localization.text("error.notFoundHeading"),
    localization.text("error.notFoundMessage"),
    requestId,
    localization,
  );
}

export function prepareUnexpectedErrorViewModel(requestId: string, localization: Localization) {
  return requestErrorViewModel(
    localization.text("error.unexpectedHeading"),
    localization.text("error.unexpectedMessage"),
    requestId,
    localization,
  );
}

function requestErrorViewModel(
  heading: string,
  message: string,
  requestId: string,
  localization: Localization,
) {
  return {
    title: heading,
    heading,
    message,
    requestIdLabel: localization.text("error.requestId"),
    requestId,
  };
}
