import type { UserContext } from "../../ports/auth/user-context.js";
import type { Localization } from "../../ports/localization/localization.js";

export function prepareLoginViewModel(returnTo: string, localization: Localization) {
  return {
    title: localization.text("auth.loginTitle"),
    heading: localization.text("auth.loginHeading"),
    testLoginUrl: `/auth/test-login?returnTo=${encodeURIComponent(returnTo)}`,
    signInLabel: localization.text("auth.signIn"),
  };
}

export function prepareDashboardViewModel(user: UserContext, localization: Localization) {
  return {
    title: localization.text("auth.dashboardTitle"),
    heading: localization.text("nav.dashboard"),
    signedInLabel: localization.text("auth.signedIn"),
    userDisplayName: user.displayName,
    logoutAction: "/auth/logout",
    logoutLabel: localization.text("auth.logout"),
  };
}

export function prepareAuthErrorViewModel(message: string, localization: Localization) {
  return {
    title: localization.text("auth.errorTitle"),
    heading: localization.text("auth.errorHeading"),
    message,
    loginUrl: "/auth/login",
    loginLabel: localization.text("auth.backToLogin"),
  };
}
