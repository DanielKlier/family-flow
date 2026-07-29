import { readFile } from "node:fs/promises";

import type { FastifyInstance } from "fastify";

const htmxScriptUrl = new URL("../../../node_modules/htmx.org/dist/htmx.min.js", import.meta.url);

const appStylesheet = `:root {
  color-scheme: light;
  --color-bg: #f7f3eb;
  --color-panel: #fffaf0;
  --color-text: #241d16;
  --color-muted: #6f6256;
  --color-border: #dfd1bd;
  --color-accent: #2f6f6d;
  --color-accent-dark: #214f4d;
  --shadow-panel: 0 18px 45px rgb(73 55 34 / 14%);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: linear-gradient(135deg, #f7f3eb 0%, #ecf4f3 100%);
  color: var(--color-text);
}

a {
  color: var(--color-accent-dark);
}

.app-shell {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 32px 0;
}

.app-header,
.panel {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: 24px;
  box-shadow: var(--shadow-panel);
}

.app-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  padding: 20px 24px;
  margin-bottom: 20px;
}

.app-title {
  margin: 0;
  font-size: clamp(1.75rem, 4vw, 2.7rem);
  letter-spacing: -0.04em;
}

.app-nav,
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.panel {
  padding: 24px;
  margin-bottom: 20px;
}

.grid-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  align-items: end;
}

.field {
  display: grid;
  gap: 6px;
  color: var(--color-muted);
  font-weight: 700;
}

input,
select,
textarea,
button {
  font: inherit;
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 10px 12px;
  background: #fffdf8;
  color: var(--color-text);
}

textarea {
  min-height: 44px;
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 10px;
}

.checkbox-field input {
  width: auto;
}

button,
.button-link {
  border: 0;
  border-radius: 999px;
  padding: 10px 16px;
  background: var(--color-accent);
  color: #fff;
  cursor: pointer;
  text-decoration: none;
  font-weight: 800;
}

button:hover,
.button-link:hover {
  background: var(--color-accent-dark);
}

.button-secondary {
  background: #e9ddd0;
  color: var(--color-text);
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
}

th {
  color: var(--color-muted);
  font-size: 0.86rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.inline-form {
  display: inline;
}

.empty-state,
.form-error {
  color: var(--color-muted);
  background: #fff4df;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 12px 14px;
}

.form-error {
  color: #8b1e1e;
  background: #fff0f0;
}

@media (max-width: 680px) {
  .app-shell {
    width: min(100% - 20px, 1120px);
    padding: 16px 0;
  }

  .app-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .panel {
    padding: 16px;
  }
}`;

let htmxScript: Promise<string> | null = null;

export function registerStaticAssets(server: FastifyInstance): void {
  server.get("/assets/app.css", async (_request, reply) => {
    return reply.type("text/css; charset=utf-8").send(appStylesheet);
  });

  server.get("/assets/htmx.min.js", async (_request, reply) => {
    return reply.type("application/javascript; charset=utf-8").send(await readHtmxScript());
  });
}

function readHtmxScript(): Promise<string> {
  htmxScript ??= readFile(htmxScriptUrl, "utf8");

  return htmxScript;
}
