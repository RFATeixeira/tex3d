export const defaultSettings = {
  filamentPrice: 95,
  spoolWeight: 1000,
  power: 150,
  energyRate: 0.92,
  machineRate: 1.5,
  laborRate: 20,
  failureRate: 10,
  margin: 40,
};
export function calculate(
  s: typeof defaultSettings,
  grams: number,
  hours: number,
  laborMinutes: number,
  extras: number,
  quantity: number,
) {
  if (
    [...Object.values(s), grams, hours, laborMinutes, extras, quantity].some(
      (n) => !Number.isFinite(n) || n < 0,
    ) ||
    s.spoolWeight <= 0 ||
    quantity < 1 ||
    !Number.isInteger(quantity) ||
    s.margin >= 100 ||
    s.failureRate >= 100
  )
    throw new Error(
      "Confira os valores. Margem e falhas devem ser menores que 100%.",
    );
  const material = (grams / s.spoolWeight) * s.filamentPrice;
  const energy = ((hours * s.power) / 1000) * s.energyRate;
  const machine = hours * s.machineRate;
  const labor = (laborMinutes / 60) * s.laborRate;
  const production = (material + energy + machine) / (1 - s.failureRate / 100);
  const cost = production + labor + extras;
  const price = cost / (1 - s.margin / 100);
  return {
    material,
    energy,
    machine,
    labor,
    risk: production - material - energy - machine,
    cost,
    price,
    profit: price - cost,
    total: price * quantity,
  };
}
export const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
