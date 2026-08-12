import { describe, expect, it } from "vitest";

describe("auth view-model preparation", () => {
  it("prepares escaped-template-safe dashboard and login primitives including an encoded return URL", async () => {
    const { prepareDashboardViewModel, prepareLoginViewModel } = await import(
      "../../src/adapters/http/auth-view-model.js"
    );

    expect(prepareLoginViewModel("/transactions?next=<script>")).toEqual({
      title: "FamilyFlow Login",
      heading: "Login",
      testLoginUrl: "/auth/test-login?returnTo=%2Ftransactions%3Fnext%3D%3Cscript%3E",
      signInLabel: "Sign in as Test User",
    });
    expect(
      prepareDashboardViewModel({
        id: "user-1",
        displayName: "<img onerror=alert(1)>",
        email: null,
      }),
    ).toMatchObject({
      title: "FamilyFlow Dashboard",
      heading: "Dashboard",
      signedInLabel: "Signed in as",
      userDisplayName: "<img onerror=alert(1)>",
      logoutAction: "/auth/logout",
      logoutLabel: "Logout",
    });
  });
});
