export async function readJsonObject(
  response: Response,
  errorMessage: string,
): Promise<Record<string, unknown>> {
  const payload = await response.json();
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error(errorMessage);
  }

  return payload;
}
