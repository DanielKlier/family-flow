import type { Account } from "../../../core/accounts/account.js";
import type { Category } from "../../../core/categories/category.js";
import { escapeHtml, renderNavigation, renderPage } from "./html.js";

export function renderMasterDataPage(accounts: Account[], categories: Category[]): string {
  return renderPage({
    title: "FamilyFlow Master Data",
    heading: "Master Data",
    navigation: renderNavigation([
      { href: "/", label: "Dashboard" },
      { href: "/transactions", label: "Transactions" },
      { href: "/imports/csv", label: "CSV Import" },
    ]),
    body: `<section class="panel" aria-labelledby="accounts-heading">
        <h2 id="accounts-heading">Accounts</h2>
        <ul>${accounts.map((account) => `<li>${escapeHtml(account.name)} (${escapeHtml(account.ownerContext)})</li>`).join("")}</ul>
      </section>
      <section class="panel" aria-labelledby="categories-heading">
        <h2 id="categories-heading">Categories</h2>
        <ul>${categories.map((category) => `<li>${escapeHtml(category.name)}</li>`).join("")}</ul>
      </section>`,
  });
}
