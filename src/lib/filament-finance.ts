import type { Filament, Transaction, Workspace } from "./types";
import type { ProjectDetails } from "./project-details";

export function linkLegacyFilamentSales(transactions: Transaction[], details: Map<string, ProjectDetails>): Transaction[] {
  return transactions.map(item => {
    if (item.kind !== "project-sale") return item;
    const quote = details.get(item.sourceProjectId ?? "")?.quotes.find(quote => quote.id === item.sourceQuoteId);
    if (item.type === "Venda") return !item.sourceFilamentId && quote?.filament ? { ...item, sourceFilamentId: quote.filament.id } : item;
    if (item.productionCost !== undefined) return item;
    const units = quote && quote.result.cost > 0 ? item.amount / quote.result.cost : 0;
    const materialCost = quote?.filament ? Math.min(item.amount, (quote.result.material ?? 0) / (1 - quote.settings.failureRate / 100) * units) : 0;
    return { ...item, productionCost: item.amount, materialCost, ...(quote?.filament ? { sourceFilamentId: quote.filament.id } : {}) };
  });
}

export function syncFilamentPurchases(workspace: Workspace): Workspace {
  const transactions = [...workspace.transactions];
  for (const filament of workspace.filaments ?? []) {
    const id = `filament:${filament.id}:purchase`;
    const entry: Transaction = { id, kind: "investment", sourceFilamentId: filament.id, description: `Filamento · ${filament.name}`, type: "Compra", category: "Filamento", amount: Math.round(filament.price * 100) / 100, date: filament.createdAt.slice(0, 10), projectId: "" };
    const index = transactions.findIndex(item => item.id === id);
    if (index < 0) transactions.push(entry);
    else transactions[index] = entry;
  }
  const purchased = new Set(transactions.filter(item => item.kind === "investment" && item.sourceFilamentId).map(item => item.sourceFilamentId));
  // Material paid with the roll is not charged again in the cash ledger.
  const normalized = transactions.map(item => item.kind === "project-sale" && item.type === "Compra" && item.productionCost !== undefined && purchased.has(item.sourceFilamentId) ? { ...item, amount: Math.round(Math.max(0, item.productionCost - (item.materialCost ?? 0)) * 100) / 100 } : item);
  if (normalized.length > 2000) throw new Error("Limite de 2.000 lançamentos atingido.");
  return { ...workspace, transactions: normalized };
}

export function filamentReturn(filament: Filament, transactions: Transaction[]) {
  const linked = transactions.filter(item => item.kind === "project-sale" && item.sourceFilamentId === filament.id);
  const revenue = linked.filter(item => item.type === "Venda").reduce((sum, item) => sum + item.amount, 0);
  const operatingCosts = linked.filter(item => item.type === "Compra").reduce((sum, item) => sum + (item.productionCost === undefined ? item.amount : Math.max(0, item.productionCost - (item.materialCost ?? 0))), 0);
  return { revenue, net: revenue - operatingCosts - filament.price };
}
