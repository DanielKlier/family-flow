import type {
  IncomePlan,
  MonthlyIncomeOverride,
  MonthlyIncomeResult,
} from "../../../core/income/income-plan.js";
import {
  type OwnerContext,
  type OwnerContextLabel,
  ownerContextLabelMap,
} from "../../../core/shared/owner-context.js";
import type { IncomePageFilters } from "../income-request.js";
import { escapeHtml, renderNavigation, renderPage } from "./html.js";

type IncomePanelInput = {
  plans: IncomePlan[];
  allPlans: IncomePlan[];
  overrides: MonthlyIncomeOverride[];
  ownerContexts: OwnerContextLabel[];
  filters: IncomePageFilters;
  monthlyIncome: MonthlyIncomeResult;
  formError?: string;
};

export function renderIncomePage(input: IncomePanelInput): string {
  return renderPage({
    title: "FamilyFlow Income",
    heading: "Income Planning",
    navigation: renderNavigation([
      { href: "/", label: "Dashboard" },
      { href: "/transactions", label: "Transactions" },
      { href: "/imports/csv", label: "CSV Import" },
      { href: "/categorization-rules", label: "Rules" },
      { href: "/admin/master-data", label: "Master Data" },
    ]),
    scripts: '<script src="/assets/htmx.min.js" defer></script>\n    ',
    body: renderIncomePanel(input),
  });
}

export function renderIncomePanel(input: IncomePanelInput): string {
  return `<section id="income-panel">
    ${renderIncomeForm(input.ownerContexts, input.formError)}
    ${renderOverrideForm(input.allPlans)}
    ${renderIncomeFilters(input.filters, input.ownerContexts)}
    ${renderIncomeSummary(input.monthlyIncome)}
    ${renderIncomeList(input.plans, input.ownerContexts)}
    ${renderOverrideList(input.overrides, input.allPlans)}
  </section>`;
}

export function renderIncomeEditPage(input: {
  plan: IncomePlan;
  ownerContexts: OwnerContextLabel[];
}): string {
  return renderPage({
    title: "Edit Income",
    heading: "Edit Income",
    navigation: renderNavigation([{ href: "/income", label: "Income" }]),
    body: renderIncomeForm(input.ownerContexts, undefined, input.plan),
  });
}

function renderIncomeForm(
  ownerContexts: OwnerContextLabel[],
  formError?: string,
  plan?: IncomePlan,
): string {
  const action = plan === undefined ? "/income" : `/income/${encodeURIComponent(plan.id)}`;
  const button = plan === undefined ? "Add income" : "Save income";

  return `<section class="panel" aria-labelledby="income-form-heading">
    <h2 id="income-form-heading">${plan === undefined ? "Add income" : "Edit income"}</h2>
    ${formError === undefined ? "" : `<p class="form-error">${escapeHtml(formError)}</p>`}
    <form id="income-form" class="grid-form" method="post" action="${action}" hx-post="${action}" hx-target="#income-panel" hx-swap="outerHTML">
      <label class="field">Income name <input name="name" value="${escapeHtml(plan?.name ?? "")}" required></label>
      <label class="field">Owner context
        <select name="ownerContext">
          ${ownerContexts.map((label) => renderOption(label.ownerContext, label.label, plan?.ownerContext)).join("")}
        </select>
      </label>
      <label class="field">Amount <input name="amount" inputmode="decimal" value="${escapeHtml(plan === undefined ? "" : formatAmount(plan.amountCents))}" required></label>
      <label class="field">Start month <input name="startMonth" type="month" placeholder="YYYY-MM" value="${escapeHtml(plan?.startMonth ?? "")}" required></label>
      <label class="field">End month <input name="endMonth" type="month" placeholder="YYYY-MM" value="${escapeHtml(plan?.endMonth ?? "")}"></label>
      <input type="hidden" name="active" value="on">
      <button type="submit">${button}</button>
    </form>
  </section>`;
}

function renderOverrideForm(plans: IncomePlan[]): string {
  return `<section class="panel" aria-labelledby="income-override-heading">
    <h2 id="income-override-heading">Monthly override</h2>
    <form id="income-override-form" class="grid-form" method="post" action="/income/overrides" hx-post="/income/overrides" hx-target="#income-panel" hx-swap="outerHTML">
      <label class="field">Override income
        <select name="incomePlanId">${plans.map((plan) => renderOption(plan.id, plan.name)).join("")}</select>
      </label>
      <label class="field">Override month <input name="month" type="month" placeholder="YYYY-MM" required></label>
      <label class="field">Override amount <input name="amount" inputmode="decimal" required></label>
      <label class="field">Override note <input name="note"></label>
      <button type="submit">Save override</button>
    </form>
  </section>`;
}

function renderIncomeFilters(
  filters: IncomePageFilters,
  ownerContexts: OwnerContextLabel[],
): string {
  return `<section class="panel" aria-labelledby="income-filters-heading">
    <h2 id="income-filters-heading">Income filters</h2>
    <form id="income-filters" class="grid-form" method="get" action="/income" hx-get="/income" hx-target="#income-panel" hx-swap="outerHTML">
      <label class="field">Calculation month <input name="month" type="month" placeholder="YYYY-MM" value="${escapeHtml(filters.month)}"></label>
      <label class="field">Filter owner context
        <select name="ownerContext">
          <option value="">All owners</option>
          ${ownerContexts.map((label) => renderOption(label.ownerContext, label.label, filters.ownerContext)).join("")}
        </select>
      </label>
      <button type="submit">Apply income filters</button>
      <button type="submit">Update calculation</button>
    </form>
  </section>`;
}

function renderIncomeSummary(monthlyIncome: MonthlyIncomeResult): string {
  return `<section class="panel" aria-labelledby="income-summary-heading">
    <h2 id="income-summary-heading">Monthly income summary</h2>
    <p>Monthly planned income: ${formatAmount(monthlyIncome.totalCents)}</p>
  </section>`;
}

function renderIncomeList(plans: IncomePlan[], ownerContexts: OwnerContextLabel[]): string {
  const ownerLabels = ownerContextLabelMap(ownerContexts);

  return `<section class="panel" aria-labelledby="income-list-heading">
    <h2 id="income-list-heading">Income list</h2>
    ${plans.length === 0 ? '<p class="empty-state">No income plans found.</p>' : `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Owner</th><th>Amount</th><th>Start</th><th>End</th><th>Actions</th></tr></thead><tbody>${plans.map((plan) => renderIncomeRow(plan, ownerLabels)).join("")}</tbody></table></div>`}
  </section>`;
}

function renderIncomeRow(plan: IncomePlan, ownerLabels: Record<string, string>): string {
  return `<tr>
    <td>${escapeHtml(plan.name)}</td>
    <td>${escapeHtml(ownerLabels[plan.ownerContext] ?? plan.ownerContext)}</td>
    <td>${formatAmount(plan.amountCents)}</td>
    <td>${escapeHtml(plan.startMonth)}</td>
    <td>${escapeHtml(plan.endMonth ?? "")}</td>
    <td><a class="action-link" href="/income/${encodeURIComponent(plan.id)}/edit">Edit</a></td>
  </tr>`;
}

function renderOverrideList(overrides: MonthlyIncomeOverride[], plans: IncomePlan[]): string {
  return `<section class="panel" aria-labelledby="income-overrides-list-heading">
    <h2 id="income-overrides-list-heading">Monthly overrides</h2>
    ${overrides.length === 0 ? '<p class="empty-state">No income overrides found.</p>' : `<div class="table-wrap"><table><thead><tr><th>Month</th><th>Income</th><th>Amount</th><th>Note</th></tr></thead><tbody>${overrides.map((override) => renderOverrideRow(override, plans)).join("")}</tbody></table></div>`}
  </section>`;
}

function renderOverrideRow(override: MonthlyIncomeOverride, plans: IncomePlan[]): string {
  const planName =
    plans.find((plan) => plan.id === override.incomePlanId)?.name ?? override.incomePlanId;

  return `<tr>
    <td>${escapeHtml(override.month)}</td>
    <td>${escapeHtml(planName)}</td>
    <td>${formatAmount(override.amountCents)}</td>
    <td>${escapeHtml(override.note ?? "")}</td>
  </tr>`;
}

function renderOption(value: string, label: string, selectedValue?: string | OwnerContext): string {
  return `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function formatAmount(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}
