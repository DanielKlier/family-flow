export type MissingResource =
  | "account"
  | "category"
  | "categorizationRule"
  | "incomePlan"
  | "transaction";

const missingResourceText: Record<MissingResource, { heading: string; message: string }> = {
  account: { heading: "Account not found", message: "The requested account could not be found." },
  category: {
    heading: "Category not found",
    message: "The requested category could not be found.",
  },
  categorizationRule: {
    heading: "Categorization rule not found",
    message: "The requested categorization rule could not be found.",
  },
  incomePlan: {
    heading: "Income plan not found",
    message: "The requested income plan could not be found.",
  },
  transaction: {
    heading: "Transaction not found",
    message: "The requested transaction could not be found.",
  },
};

export function prepareMissingResourceViewModel(resource: MissingResource) {
  const text = missingResourceText[resource];
  return { title: text.heading, heading: text.heading, message: text.message };
}

export function prepareBadRequestViewModel(message: string, requestId: string) {
  return {
    title: "Invalid request",
    heading: "Invalid request",
    message,
    requestIdLabel: "Request ID:",
    requestId,
  };
}
