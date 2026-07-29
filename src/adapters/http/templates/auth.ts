import type { UserContext } from "../../../ports/auth/user-context.js";
import { escapeHtml } from "./html.js";

export function renderLoginPage(returnTo: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="/assets/app.css">
    <title>FamilyFlow Login</title>
  </head>
  <body>
    <main class="app-shell">
      <header class="app-header"><h1 class="app-title">Login</h1></header>
      <section class="panel">
        <a class="button-link" href="/auth/test-login?returnTo=${encodeURIComponent(returnTo)}">Sign in as Test User</a>
      </section>
    </main>
  </body>
</html>`;
}

export function renderDashboard(user: UserContext): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="/assets/app.css">
    <title>FamilyFlow Dashboard</title>
  </head>
  <body>
    <main class="app-shell">
      <header class="app-header">
        <h1 class="app-title">Dashboard</h1>
        <nav class="app-nav"><a href="/admin/master-data">Master Data</a><a href="/transactions">Transactions</a><a href="/auth/logout">Logout</a></nav>
      </header>
      <section class="panel">
        <p>Signed in as ${escapeHtml(user.displayName)}</p>
      </section>
    </main>
  </body>
</html>`;
}
