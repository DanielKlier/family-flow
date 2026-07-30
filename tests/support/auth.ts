import type { APIRequestContext, Page } from "@playwright/test";

export async function loginAsTestUserPage(
  page: Page,
  baseUrl: string,
  returnTo?: string,
): Promise<void> {
  await page.goto(testLoginUrl(baseUrl, returnTo));
}

export async function loginAsTestUserRequest(
  request: APIRequestContext,
  baseUrl: string,
  returnTo?: string,
): Promise<void> {
  await request.get(testLoginUrl(baseUrl, returnTo));
}

function testLoginUrl(baseUrl: string, returnTo: string | undefined): string {
  if (returnTo === undefined) {
    return `${baseUrl}/auth/test-login`;
  }

  return `${baseUrl}/auth/test-login?returnTo=${encodeURIComponent(returnTo)}`;
}
