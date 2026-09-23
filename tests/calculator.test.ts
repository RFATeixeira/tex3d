import test from "node:test";
import assert from "node:assert/strict";
import { calculate, defaultSettings } from "../src/lib/calculator.ts";
test("custos, reserva de falhas, margem sobre venda e quantidade", () => {
  const s = {
    ...defaultSettings,
    filamentPrice: 100,
    spoolWeight: 1000,
    power: 1000,
    energyRate: 1,
    machineRate: 2,
    laborRate: 60,
    failureRate: 20,
    margin: 25,
  };
  const r = calculate(s, 100, 2, 10, 5, 3);
  assert.equal(r.material, 10);
  assert.equal(r.energy, 2);
  assert.equal(r.machine, 4);
  assert.equal(r.risk, 4);
  assert.equal(r.cost, 35);
  assert.equal(r.price, 35 / 0.75);
  assert.equal(r.total, 140);
  assert.ok(Math.abs(r.profit / r.price - 0.25) < 1e-10);
});
test("rejeita divisão por zero, números inválidos e quantidades fracionadas", () => {
  for (const override of [
    { spoolWeight: 0 },
    { margin: 100 },
    { failureRate: 100 },
    { power: -1 },
    { energyRate: NaN },
  ])
    assert.throws(() =>
      calculate({ ...defaultSettings, ...override }, 100, 2, 0, 0, 1),
    );
  assert.throws(() => calculate(defaultSettings, 100, 2, 0, 0, 1.5));
  assert.throws(() => calculate(defaultSettings, NaN, 2, 0, 0, 1));
});
