import type { Account } from "../../../core/accounts/account.js";
import type { Category } from "../../../core/categories/category.js";

export function renderMasterDataPage(accounts: Account[], categories: Category[]): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="/assets/app.css">
    <title>FamilyFlow Master Data</title>
  </head>
  <body>
    <main class="app-shell">
      <header class="app-header">
        <h1 class="app-title">Master Data</h1>
        <nav class="app-nav"><a href="/">Dashboard</a><a href="/transactions">Transactions</a></nav>
      </header>
      <section class="panel" aria-labelledby="accounts-heading">
        <h2 id="accounts-heading">Accounts</h2>
        <ul>${accounts.map((account) => `<li>${escapeHtml(account.name)} (${escapeHtml(account.ownerContext)})</li>`).join("")}</ul>
      </section>
      <section class="panel" aria-labelledby="categories-heading">
        <h2 id="categories-heading">Categories</h2>
        <ul>${categories.map((category) => `<li>${escapeHtml(category.name)}</li>`).join("")}</ul>
      </section>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
