import { describe, expect, it } from "vitest";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";

const localization = createGermanLocalization();

describe("auth view-model preparation", () => {
  it("prepares escaped-template-safe dashboard and login primitives including an encoded return URL", async () => {
    const { prepareDashboardViewModel, prepareLoginViewModel } = await import(
      "../../src/adapters/http/auth-view-model.js"
    );

    expect(prepareLoginViewModel("/transactions?next=<script>", localization)).toEqual({
      title: "FamilyFlow Anmeldung",
      heading: "Anmeldung",
      testLoginUrl: "/auth/test-login?returnTo=%2Ftransactions%3Fnext%3D%3Cscript%3E",
      signInLabel: "Als Testbenutzer anmelden",
    });
    expect(
      prepareDashboardViewModel(
        {
          id: "user-1",
          displayName: "<img onerror=alert(1)>",
          email: null,
        },
        localization,
      ),
    ).toMatchObject({
      title: "FamilyFlow Übersicht",
      heading: "Übersicht",
      signedInLabel: "Angemeldet als",
      userDisplayName: "<img onerror=alert(1)>",
      logoutAction: "/auth/logout",
      logoutLabel: "Abmelden",
    });
  });
});
