import type { UserContext } from "../../../ports/auth/user-context.js";
import { escapeHtml, renderNavigation, renderPage } from "./html.js";

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
    navigation: renderNavigation([
      { href: "/admin/master-data", label: "Master Data" },
      { href: "/transactions", label: "Transactions" },
      { href: "/income", label: "Income" },
      { href: "/imports/csv", label: "CSV Import" },
      { href: "/categorization-rules", label: "Rules" },
    ]),
    body: `<section class="panel">
        <p>Signed in as ${escapeHtml(user.displayName)}</p>
        <form method="post" action="/auth/logout"><button type="submit">Logout</button></form>
      </section>`,
  });
}
