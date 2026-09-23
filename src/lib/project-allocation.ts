import type { Project } from "./types";
import type { ProjectComponent, ProjectQuote } from "./project-details";
import type { ProjectSale } from "./project-sales";

export type Allocation = { soldQuantity: number; personalQuantity: number; giftQuantity: number };
export function wholeProjectAllocation(project: Project, quotes: ProjectQuote[] = []): Allocation {
  if (project.allocationMode !== "project") {
    if (quotes.length) {
      const complete = (key: keyof Allocation) => Math.min(...quotes.map(quote => Math.floor(allocation(quote, quote.quantity)[key] / quote.quantity)));
      const personal = Math.min(...quotes.map(quote => {
        const counts = allocation(quote, quote.quantity);
        return Math.floor((counts.personalQuantity + counts.giftQuantity) / quote.quantity);
      }));
      return { soldQuantity: complete("soldQuantity"), personalQuantity: personal, giftQuantity: 0 };
    }
    return { soldQuantity: project.saleStatus === "sold" ? 1 : 0, personalQuantity: project.quoteCount ? 0 : (project.personalQuantity ?? 0) + (project.giftQuantity ?? 0), giftQuantity: 0 };
  }
  const count = (value = 0) => Math.min(1000000, Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0)));
  return { soldQuantity: count(project.soldQuantity), personalQuantity: count(project.personalQuantity) + count(project.giftQuantity), giftQuantity: 0 };
}

function materialCost(quote: ProjectQuote, quantity: number) {
  return (quote.result.material ?? 0) / (1 - (quote.settings?.failureRate ?? 0) / 100) * quantity;
}
export function allocation(item: Partial<Allocation> & { sold?: boolean; saleStatus?: string }, quantity: number): Allocation {
  const bounded = (value: number, max: number) => Math.max(0, Math.min(max, Math.trunc(Number.isFinite(value) ? value : 0)));
  const soldQuantity = bounded(item.soldQuantity ?? (item.sold || item.saleStatus === "sold" ? quantity : 0), quantity);
  const personalQuantity = bounded((item.personalQuantity ?? 0) + ((item as Partial<Allocation>).giftQuantity ?? 0), quantity - soldQuantity);
  return { soldQuantity, personalQuantity, giftQuantity: 0 };
}

export function allocationSummary(project: Project, quotes: ProjectQuote[], date: string, components: ProjectComponent[] = []) {
  if (project.allocationMode === "project") {
    const counts = wholeProjectAllocation(project);
    const sales: ProjectSale[] = counts.soldQuantity === 0 ? [] : quotes.length || components.length ? [
      ...quotes.map(quote => ({ id: quote.id, name: quote.name, date: project.soldAt || date, revenue: quote.result.total * counts.soldQuantity, cost: quote.result.cost * quote.quantity * counts.soldQuantity, ...(quote.filament ? { filamentId: quote.filament.id, materialCost: materialCost(quote, quote.quantity * counts.soldQuantity) } : {}) })),
      ...components.map(component => ({ id: `project:${component.id}`, name: component.name, date: project.soldAt || date, revenue: (component.total ?? 0) * counts.soldQuantity, cost: (component.cost ?? 0) * counts.soldQuantity })),
    ] : [{ id: "manual", name: project.name, date: project.soldAt || date, revenue: (project.total ?? 0) * counts.soldQuantity, cost: (project.cost ?? 0) * counts.soldQuantity }];
    const filamentEnergyCost = project.materialCost !== undefined || project.energyCost !== undefined
      ? (project.materialCost ?? 0) + (project.energyCost ?? 0)
      : quotes.reduce((sum, quote) => sum + (quote.result.material + quote.result.energy) * quote.quantity, 0)
        + components.reduce((sum, component) => sum + (component.materialCost ?? 0) + (component.energyCost ?? 0), 0);
    return { sales, project: { ...project, ...counts, personalCost: filamentEnergyCost * counts.personalQuantity, saleStatus: counts.soldQuantity ? "sold" as const : "unsold" as const, soldRevenue: sales.reduce((sum, item) => sum + item.revenue, 0), soldCost: sales.reduce((sum, item) => sum + item.cost, 0) } };
  }
  const items = quotes.length ? quotes : [{ ...project, quantity: 1, result: { total: project.total ?? 0, cost: project.cost ?? 0, material: project.materialCost ?? 0, energy: project.energyCost ?? 0 }, id: "manual" }];
  const sales: ProjectSale[] = [];
  const counts: Allocation = { soldQuantity: 0, personalQuantity: 0, giftQuantity: 0 };
  let quantity = 0;
  let personalCost = 0;
  for (const item of items) {
    const current = allocation(item, item.quantity);
    quantity += item.quantity;
    personalCost += ((item.result.material ?? 0) + (item.result.energy ?? 0)) * current.personalQuantity;
    for (const key of Object.keys(counts) as (keyof Allocation)[]) counts[key] += current[key];
    if (current.soldQuantity) {
      const quote = quotes.find(quote => quote.id === item.id);
      sales.push({ id: item.id, name: item.name, date: item.soldAt || date, revenue: item.result.total / item.quantity * current.soldQuantity, cost: item.result.cost * current.soldQuantity, ...(quote?.filament ? { filamentId: quote.filament.id, materialCost: materialCost(quote, current.soldQuantity) } : {}) });
    }
  }
  return {
    sales,
    project: { ...project, ...counts, personalCost, saleStatus: counts.soldQuantity === 0 ? "unsold" as const : counts.soldQuantity === quantity ? "sold" as const : "partial" as const, soldRevenue: sales.reduce((sum, item) => sum + item.revenue, 0), soldCost: sales.reduce((sum, item) => sum + item.cost, 0) },
  };
}
