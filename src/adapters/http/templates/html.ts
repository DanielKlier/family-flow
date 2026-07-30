export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderPage(input: {
  title: string;
  heading: string;
  navigation?: string;
  scripts?: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="/assets/app.css">
    ${input.scripts ?? ""}<title>${escapeHtml(input.title)}</title>
  </head>
  <body>
    <main class="app-shell">
      <header class="app-header">
        <h1 class="app-title">${escapeHtml(input.heading)}</h1>
        ${input.navigation ?? ""}
      </header>
      ${input.body}
    </main>
  </body>
</html>`;
}

export function renderNavigation(links: { href: string; label: string }[]): string {
  return `<nav class="app-nav">${links
    .map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`)
    .join("")}</nav>`;
}
