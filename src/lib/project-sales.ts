import type { Transaction } from "./types";

export type ProjectSale = { id: string; name: string; revenue: number; cost: number; date: string; filamentId?: string; materialCost?: number };
export function syncProjectSales(transactions: Transaction[], project: { id: string; name: string }, sales: ProjectSale[]): Transaction[] {
  const others = transactions.filter(entry => !(entry.kind === "project-sale" && entry.sourceProjectId === project.id));
  const generated: Transaction[] = [];
  const ids = new Set<string>();
  for (const sale of sales) {
    if (ids.has(sale.id)) throw new Error("Item de venda duplicado.");
    ids.add(sale.id);
    if (![sale.revenue, sale.cost].every(value => Number.isFinite(value) && value >= 0 && value <= 999999999)) throw new Error("Confira o custo e o valor de venda.");
    const parsed = new Date(`${sale.date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sale.date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== sale.date) throw new Error("Informe uma data de venda válida.");
    const common = { kind: "project-sale" as const, projectId: project.id, sourceProjectId: project.id, sourceQuoteId: sale.id, date: sale.date, ...(sale.filamentId ? { sourceFilamentId: sale.filamentId } : {}) };
    generated.push({ ...common, id: `sale:${project.id}:${sale.id}:revenue`, type: "Venda", category: "Peça impressa", description: `${project.name} · ${sale.name}`, amount: Math.round(sale.revenue * 100) / 100 });
    const materialCost = Math.min(sale.cost, Math.max(0, sale.materialCost ?? 0));
    const purchased = sale.filamentId && transactions.some(entry => entry.kind === "investment" && entry.sourceFilamentId === sale.filamentId);
    generated.push({ ...common, id: `sale:${project.id}:${sale.id}:cost`, type: "Compra", category: "Custo de impressão", description: `Custo · ${project.name} · ${sale.name}`, productionCost: sale.cost, materialCost, amount: Math.round((sale.cost - (purchased ? materialCost : 0)) * 100) / 100 });
  }
  if (others.length + generated.length > 2000) throw new Error("Limite de 2.000 lançamentos atingido.");
  return [...generated, ...others];
}
