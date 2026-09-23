import test from "node:test";
import assert from "node:assert/strict";
import { syncProjectSales } from "../src/lib/project-sales.ts";
import type { Transaction } from "../src/lib/types.ts";
import type { Project } from "../src/lib/types.ts";
import type { ProjectQuote } from "../src/lib/project-details.ts";
import { allocation, allocationSummary, wholeProjectAllocation } from "../src/lib/project-allocation.ts";
import { syncFilamentPurchases, filamentReturn, linkLegacyFilamentSales } from "../src/lib/filament-finance.ts";
import type { Filament, Workspace } from "../src/lib/types.ts";

const project = { id: "project-a", name: "Kit" };
const sales = [{ id: "quote-a", name: "Base", revenue: 60, cost: 40, date: "2026-09-17" }];
const investment: Transaction = { id: "printer", kind: "investment", description: "Impressora", type: "Compra", category: "Equipamento", amount: 1000, date: "2026-09-16", projectId: "" };

test("whole project counters multiply all quote quantities and preserve personal/gift counts", () => {
  const draft = { ...project, allocationMode: "project", soldQuantity: 2, personalQuantity: 1, giftQuantity: 3 } as Project;
  const quotes = [{ id: "a", name: "Base", quantity: 2, result: { cost: 20, total: 60 } }, { id: "b", name: "Tampa", quantity: 3, result: { cost: 10, total: 45 } }] as ProjectQuote[];
  const summary = allocationSummary(draft, quotes, "2026-09-17");
  assert.deepEqual(summary.sales.map(item => [item.revenue, item.cost]), [[120, 80], [90, 60]]);
  assert.equal(summary.project.soldRevenue, 210);
  assert.equal(summary.project.soldQuantity, 2);
  assert.equal(summary.project.personalQuantity, 1);
  assert.equal(summary.project.giftQuantity, 3);
  assert.equal(wholeProjectAllocation({ ...draft, allocationMode: undefined, saleStatus: "sold", soldQuantity: 5 }).soldQuantity, 1);
});

test("roll purchases are idempotent, editable, preserved after deletion, with no double material expense", () => {
  const filament = { id: "roll-a", name: "PLA", price: 100, createdAt: "2026-09-17T12:00:00Z" } as Filament;
  const workspace = { transactions: [investment], filaments: [filament], projects: [], settings: {} } as Workspace;
  const once = syncFilamentPurchases(workspace);
  assert.deepEqual(syncFilamentPurchases(once), once);
  const sales = [{ id: "a", name: "Base", revenue: 210, cost: 140, materialCost: 70, filamentId: filament.id, date: "2026-09-17" }];
  const transactions = syncProjectSales(once.transactions, project, sales);
  assert.deepEqual(filamentReturn(filament, transactions), { revenue: 210, net: 40 });
  assert.equal(transactions.find(item => item.kind === "project-sale" && item.type === "Compra")?.amount, 70);
  const edited = syncFilamentPurchases({ ...once, transactions, filaments: [{ ...filament, price: 90 }] });
  assert.equal(edited.transactions.filter(item => item.kind === "investment").length, 2);
  assert.equal(edited.transactions.find(item => item.sourceFilamentId === filament.id && item.kind === "investment")?.amount, 90);
  assert.deepEqual(syncFilamentPurchases({ ...edited, filaments: [] }).transactions, edited.transactions);
  assert.deepEqual(filamentReturn(filament, syncProjectSales(transactions, project, [])), { revenue: 0, net: -100 });
  assert.equal(filamentReturn({ ...filament, id: "different-roll" }, transactions).revenue, 0);
});

test("legacy sales gain roll attribution without changing revenue and normalize once", () => {
  const quote = { id: "quote-a", filament: { id: "roll-a" }, result: { cost: 20, material: 9 }, settings: { failureRate: 10 } } as ProjectQuote;
  const legacy: Transaction[] = [{ id: "sale", kind: "project-sale", sourceProjectId: project.id, sourceQuoteId: quote.id, amount: 60, type: "Venda", description: "", category: "", date: "2026-09-17", projectId: project.id }, { id: "cost", kind: "project-sale", sourceProjectId: project.id, sourceQuoteId: quote.id, amount: 40, type: "Compra", description: "", category: "", date: "2026-09-17", projectId: project.id }];
  const details = new Map([[project.id, { image: "", quotes: [quote] }]]);
  const linked = linkLegacyFilamentSales(legacy, details);
  assert.equal(linked[0].amount, 60);
  assert.equal(linked[0].sourceFilamentId, "roll-a");
  assert.equal(linked[1].materialCost, 20);
  assert.deepEqual(linkLegacyFilamentSales(linked, details), linked);
});

test("legacy sold flags migrate to quantities and explicit zero reverses sales", () => {
  assert.equal(allocation({ sold: true }, 3).soldQuantity, 3);
  assert.equal(allocation({ saleStatus: "sold" }, 1).soldQuantity, 1);
  assert.equal(allocation({ sold: true, soldQuantity: 0 }, 3).soldQuantity, 0);
  assert.deepEqual(allocation({ soldQuantity: 1, personalQuantity: 1, giftQuantity: 9 }, 3), { soldQuantity: 1, personalQuantity: 1, giftQuantity: 1 });
});
test("partial units create proportional sales; personal and gifts create no revenue or costs", () => {
  const draft = { ...project, total: 90, cost: 60 } as Project;
  const quote = { id: "a", name: "Base", quantity: 3, result: { total: 90, cost: 20 }, soldQuantity: 1, personalQuantity: 1, giftQuantity: 1 } as ProjectQuote;
  const summary = allocationSummary(draft, [quote], "2026-09-17");
  assert.equal(summary.project.saleStatus, "partial");
  assert.equal(summary.project.soldRevenue, 30);
  assert.equal(summary.project.soldCost, 20);
  assert.equal(summary.project.personalQuantity, 1);
  assert.equal(summary.project.giftQuantity, 1);
  const ledger = syncProjectSales([investment], draft, summary.sales);
  const undone = allocationSummary(draft, [{ ...quote, soldQuantity: 0 }], "2026-09-17");
  assert.deepEqual(syncProjectSales(ledger, draft, undone.sales), [investment]);
  assert.equal(allocationSummary({ ...draft, saleStatus: "sold" }, [], "2026-09-17").project.soldRevenue, 90);
});

test("sold items create revenue and cost only once, alongside investments", () => {
  const once = syncProjectSales([investment], project, sales);
  const twice = syncProjectSales(once, project, sales);
  assert.deepEqual(twice, once);
  assert.equal(twice.length, 3);
  assert.equal(twice.filter(t => t.type === "Venda").reduce((s, t) => s + t.amount, 0), 60);
  assert.equal(twice.filter(t => t.type === "Compra").reduce((s, t) => s + t.amount, 0), 1040);
});
test("unmarking a sale removes its pair and preserves other projects and manual entries", () => {
  const other = syncProjectSales([investment], { id: "project-b", name: "Outro" }, sales);
  const sold = syncProjectSales(other, project, sales);
  assert.deepEqual(syncProjectSales(sold, project, []), other);
});
test("partial sales and edits replace values without accumulating old costs", () => {
  const second = { id: "quote-b", name: "Tampa", revenue: 45, cost: 30, date: "2026-09-18" };
  const all = syncProjectSales([], project, [...sales, second]);
  const partial = syncProjectSales(all, project, [{ ...second, revenue: 50 }]);
  assert.equal(partial.length, 2);
  assert.deepEqual(partial.map(t => t.amount), [50, 30]);
});
test("rejects invalid amounts, dates and duplicate item sales", () => {
  for (const changes of [{ cost: NaN }, { revenue: -1 }, { date: "2026-02-30" }, { date: "" }]) {
    assert.throws(() => syncProjectSales([], project, [{ ...sales[0], ...changes }]));
  }
  assert.throws(() => syncProjectSales([], project, [sales[0], sales[0]]));
});
