import type { UserContext } from "../../../ports/auth/user-context.js";
import { escapeHtml, renderPage } from "./html.js";

export function renderLoginPage(returnTo: string): string {
  return renderPage({
    title: "FamilyFlow Login",
    heading: "Login",
    body: `<section class="panel">
        <a class="button-link" href="/auth/test-login?returnTo=${encodeURIComponent(returnTo)}">Sign in as Test User</a>
      </section>`,
  });
}

export function renderDashboard(user: UserContext): string {
  return renderPage({
    title: "FamilyFlow Dashboard",
    heading: "Dashboard",
    navigation:
      '<nav class="app-nav"><a href="/admin/master-data">Master Data</a><a href="/transactions">Transactions</a><a href="/auth/logout">Logout</a></nav>',
    body: `<section class="panel">
        <p>Signed in as ${escapeHtml(user.displayName)}</p>
      </section>`,
  });
}
