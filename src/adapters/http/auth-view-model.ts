import type { UserContext } from "../../ports/auth/user-context.js";

export function prepareLoginViewModel(returnTo: string) {
  return {
    title: "FamilyFlow Login",
    heading: "Login",
    testLoginUrl: `/auth/test-login?returnTo=${encodeURIComponent(returnTo)}`,
    signInLabel: "Sign in as Test User",
  };
}

export function prepareDashboardViewModel(user: UserContext) {
  return {
    title: "FamilyFlow Dashboard",
    heading: "Dashboard",
    signedInLabel: "Signed in as",
    userDisplayName: user.displayName,
    logoutAction: "/auth/logout",
    logoutLabel: "Logout",
  };
}

export function prepareAuthErrorViewModel(message: string) {
  return {
    title: "FamilyFlow Error",
    heading: "Authentication Error",
    message,
    loginUrl: "/auth/login",
    loginLabel: "Return to login",
  };
}
