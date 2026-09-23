import type { SavedQuote } from "./quotes";
import type { Project, Settings } from "./types";

export type ProjectQuote = Omit<SavedQuote, "image"> & { sold?: boolean; soldAt?: string; soldQuantity?: number; personalQuantity?: number; giftQuantity?: number };
export type ProjectComponent = Pick<Project, "id" | "name" | "grams" | "hours" | "material" | "total" | "cost" | "materialCost" | "energyCost">;
export type ProjectDetails = { image: string; quotes: ProjectQuote[]; components?: ProjectComponent[] };
export type ProjectDetailsChange = { projectId: string; details: ProjectDetails | null };

export function projectQuote(quote: SavedQuote): ProjectQuote {
  const { image: _image, ...snapshot } = quote;
  void _image;
  return structuredClone(snapshot);
}

export function estimateMaterialEnergy(grams: number, hours: number, settings: Settings) {
  return {
    materialCost: grams / settings.spoolWeight * settings.filamentPrice,
    energyCost: hours * settings.power / 1000 * settings.energyRate,
  };
}

export function projectPersonalMaterialEnergyCost(project: Project, settings: Settings, details?: ProjectDetails) {
  const quantity = (project.personalQuantity ?? 0) + (project.giftQuantity ?? 0);
  if (!quantity) return 0;
  if (project.materialCost !== undefined || project.energyCost !== undefined) {
    return ((project.materialCost ?? 0) + (project.energyCost ?? 0)) * quantity;
  }
  if (details?.quotes.length && project.allocationMode !== "project") {
    return details.quotes.reduce((sum, quote) => sum + (quote.result.material + quote.result.energy) * ((quote.personalQuantity ?? 0) + (quote.giftQuantity ?? 0)), 0);
  }
  if (details && project.allocationMode === "project") {
    const quotesCost = details.quotes.reduce((sum, quote) => sum + (quote.result.material + quote.result.energy) * quote.quantity, 0);
    const componentsCost = (details.components ?? []).reduce((sum, component) => {
      const estimate = estimateMaterialEnergy(component.grams, component.hours, settings);
      return sum + (component.materialCost ?? estimate.materialCost) + (component.energyCost ?? estimate.energyCost);
    }, 0);
    return (quotesCost + componentsCost) * quantity;
  }
  if (project.quoteCount || project.projectCount) return 0;
  const estimate = estimateMaterialEnergy(project.grams, project.hours, settings);
  return (estimate.materialCost + estimate.energyCost) * quantity;
}

export function projectTotals(quotes: ProjectQuote[], components: ProjectComponent[] = [], settings?: Settings) {
  const componentCosts = components.map(project => {
    const estimate = settings ? estimateMaterialEnergy(project.grams, project.hours, settings) : { materialCost: 0, energyCost: 0 };
    return {
      materialCost: project.materialCost ?? estimate.materialCost,
      energyCost: project.energyCost ?? estimate.energyCost,
    };
  });
  return {
    grams: quotes.reduce((sum, quote) => sum + quote.grams * quote.quantity, 0) + components.reduce((sum, project) => sum + project.grams, 0),
    hours: quotes.reduce((sum, quote) => sum + quote.hours * quote.quantity, 0) + components.reduce((sum, project) => sum + project.hours, 0),
    cost: quotes.reduce((sum, quote) => sum + quote.result.cost * quote.quantity, 0) + components.reduce((sum, project) => sum + (project.cost ?? 0), 0),
    materialCost: quotes.reduce((sum, quote) => sum + quote.result.material * quote.quantity, 0) + componentCosts.reduce((sum, project) => sum + project.materialCost, 0),
    energyCost: quotes.reduce((sum, quote) => sum + quote.result.energy * quote.quantity, 0) + componentCosts.reduce((sum, project) => sum + project.energyCost, 0),
    total: quotes.reduce((sum, quote) => sum + quote.result.total, 0) + components.reduce((sum, project) => sum + (project.total ?? 0), 0),
    quantity: quotes.reduce((sum, quote) => sum + quote.quantity, 0),
    material: [...new Set([...quotes.map(quote => quote.filament?.material || (quote.printType === "FDM" ? "Material não informado" : quote.printType)), ...components.map(project => project.material)]
      .flatMap(material => material.split("/").map(item => item.trim()))
      .filter(Boolean))].join(" / "),
  };
}
