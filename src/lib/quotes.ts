import { calculate } from "./calculator";
import type { Settings } from "./types";

export type QuoteCalculation = {
  grams: number;
  hours: number;
  laborMinutes: number;
  extras: number;
  quantity: number;
  settings: Settings;
  filament: { id: string; name: string; brand: string; material: string; colorName: string } | null;
  result: ReturnType<typeof calculate>;
};

export type SavedQuote = QuoteCalculation & {
  id: string;
  name: string;
  printType: string;
  image: string;
  createdAt: string;
};

export const MAX_QUOTE_IMAGE_LENGTH = 250000;

export function makeQuote(
  calculation: QuoteCalculation,
  details: Pick<SavedQuote, "id" | "name" | "printType" | "image">,
): SavedQuote {
  const name = details.name.trim();
  const printType = details.printType.trim();
  if (!name || name.length > 100 || !printType || printType.length > 80) {
    throw new Error("Preencha o nome da peça e o tipo de impressão.");
  }
  if (details.image.length > MAX_QUOTE_IMAGE_LENGTH ||
    (details.image && !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(details.image))) {
    throw new Error("Selecione uma imagem válida para o orçamento.");
  }
  const { grams, hours, laborMinutes, extras, quantity } = calculation;
  const settings = { ...calculation.settings };
  return {
    ...details, name, printType, createdAt: new Date().toISOString(),
    grams, hours, laborMinutes, extras, quantity, settings,
    filament: calculation.filament ? { ...calculation.filament } : null,
    result: calculate(settings, grams, hours, laborMinutes, extras, quantity),
  };
}
