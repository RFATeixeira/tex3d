"use client";
import { useState, type FormEvent } from "react";
import {
  AdjustmentsHorizontalIcon,
  BookmarkSquareIcon,
  CubeTransparentIcon,
  ArrowUpRightIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { useWorkspace } from "./provider";
import { Field, PageTitle } from "./ui";
import { SaveQuoteButton, SavedQuotes } from "./saved-quotes";
import { calculate, money } from "@/lib/calculator";
import type { Settings } from "@/lib/types";
export function Calculator() {
  const { data } = useWorkspace();
  const [tab, setTab] = useState("estimate");
  const tabs = [{ id: "estimate", label: "Orçamento" }, { id: "saved", label: "Orçamentos salvos" }];
  return (
    <>
      <PageTitle
        eyebrow="MENOS ACHISMO. MAIS POSSIBILIDADES."
        title="Orçamento 🧮"
        description="Descubra o custo de cada camada e valorize sua criação."
      />
      <div className="tabs calculator-tabs" role="tablist" aria-label="Orçamentos">
        {tabs.map(item => (
          <button key={item.id} id={`tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls={`panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} className={tab === item.id ? "selected" : ""} onClick={() => setTab(item.id)} onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const index = tabs.findIndex(entry => entry.id === tab);
            const next = tabs[event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length].id;
            setTab(next);
            document.getElementById(`tab-${next}`)?.focus();
          }}>{item.label}</button>
        ))}
      </div>
      <div id="panel-estimate" role="tabpanel" aria-labelledby="tab-estimate" hidden={tab !== "estimate"}>
        <CalculatorForm
      key={JSON.stringify(data.settings)}
      initial={data.settings}
    />
      </div>
      <div id="panel-saved" role="tabpanel" aria-labelledby="tab-saved" hidden={tab !== "saved"}>{tab === "saved" && <SavedQuotes />}</div>
    </>
  );
}
function CalculatorForm({ initial }: { initial: Settings }) {
  const { data, mutate, setNotice } = useWorkspace();
  const [settings, setSettings] = useState(initial);
  const [filamentId, setFilamentId] = useState("");
  const availableFilaments = (data.filaments ?? []).filter(f => !f.depleted);
  const selectedFilament = availableFilaments.find(f => f.id === filamentId);
  const selectionUnavailable = Boolean(filamentId && !selectedFilament);
  const calculationSettings = {
    ...settings,
    filamentPrice: selectedFilament?.price ?? settings.filamentPrice,
    spoolWeight: 1000,
  };
  const [grams, setGrams] = useState(180);
  const [hours, setHours] = useState(6.5);
  const [labor, setLabor] = useState(15);
  const [extras, setExtras] = useState(3);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  let result: ReturnType<typeof calculate> | null = null;
  let error = "";
  const complete = [...Object.values(calculationSettings), grams, hours, labor, extras, quantity].every(Number.isFinite);
  try {
    if (selectionUnavailable) throw new Error("O rolo selecionado foi zerado ou excluído. Selecione outro filamento.");
    if (complete) result = calculate(calculationSettings, grams, hours, labor, extras, quantity);
  } catch (e) {
    error = (e as Error).message;
  }
  const dirty = JSON.stringify(calculationSettings) !== JSON.stringify(data.settings);
  const settingsFields: {
    key: keyof Settings;
    label: string;
    unit: string;
    max?: number;
    min?: number;
  }[] = [
    { key: "power", label: "Potência da impressora", unit: "W" },
    { key: "energyRate", label: "Tarifa de energia", unit: "R$ / kWh" },
    { key: "machineRate", label: "Custo da máquina", unit: "R$ / h" },
    { key: "laborRate", label: "Sua mão de obra", unit: "R$ / h" },
    { key: "failureRate", label: "Taxa de falhas", unit: "%", max: 99 },
    { key: "margin", label: "Margem de lucro", unit: "%", max: 99 },
  ];
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!result) return;
    setBusy(true);
    try {
      await mutate((old) => ({ ...old, settings: calculationSettings }));
      setNotice("Configurações salvas para as próximas impressões. 🎉");
    } catch {
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="calculator-layout">
        <div className="calculator-inputs">
          <section className="island calc-panel">
            <div className="panel-heading">
              <span className="stat-icon cyan">
                <CubeTransparentIcon />
              </span>
              <div>
                <h2>Sua impressão</h2>
                <p>Os detalhes que dão forma ao orçamento.</p>
              </div>
              <span className="step-number">01</span>
            </div>
            <div className="form-grid">
              <Field label="Filamento por peça (g)">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={Number.isFinite(grams) ? grams : ""}
                  onChange={(e) => setGrams(e.target.valueAsNumber)}
                />
              </Field>
              <Field label="Tempo por peça (horas)">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={Number.isFinite(hours) ? hours : ""}
                  onChange={(e) => setHours(e.target.valueAsNumber)}
                />
              </Field>
              <Field label="Trabalho manual por peça (min)">
                <input
                  type="number"
                  min="0"
                  value={Number.isFinite(labor) ? labor : ""}
                  onChange={(e) => setLabor(e.target.valueAsNumber)}
                />
              </Field>
              <Field
                label="Extras por peça (R$)"
                hint="Embalagem, acabamento e outros materiais."
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={Number.isFinite(extras) ? extras : ""}
                  onChange={(e) => setExtras(e.target.valueAsNumber)}
                />
              </Field>
              <Field label="Quantidade de peças">
                <input
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  value={Number.isFinite(quantity) ? quantity : ""}
                  onChange={(e) => setQuantity(e.target.valueAsNumber)}
                />
              </Field>
            </div>
          </section>
          <form className="island calc-panel" onSubmit={save}>
            <div className="panel-heading">
              <span className="stat-icon cyan">
                <AdjustmentsHorizontalIcon />
              </span>
              <div>
                <h2>Seu jeito de imprimir</h2>
                <p>Configure uma vez. Use em cada nova ideia.</p>
              </div>
              <span className="step-number">02</span>
            </div>
            <div className="form-grid">
              <Field label="Rolo de filamento" hint={selectionUnavailable ? "O filamento salvo não está mais cadastrado. Selecione outro." : undefined}>
                <select value={filamentId} onChange={e => setFilamentId(e.target.value)}>
                  <option value="">Selecione um filamento...</option>
                  {availableFilaments.map(f => <option key={f.id} value={f.id}>{f.name} · {f.brand} · {f.material} · {f.colorName} · {money(f.price)} / kg · {f.id.slice(0, 8)}</option>)}
                </select>
              </Field>
              {settingsFields.map((f) => (
                <Field key={f.key} label={f.label}>
                  <div className="unit-input">
                    <input
                      type="number"
                      required
                      min={f.min ?? 0}
                      max={f.max ?? 1000000}
                      step="0.01"
                      value={Number.isFinite(calculationSettings[f.key]) ? calculationSettings[f.key] : ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          [f.key]: e.target.valueAsNumber,
                        })
                      }
                    />
                    <span>{f.unit}</span>
                  </div>
                </Field>
              ))}
            </div>
            <div className="settings-footer">
              <span>
                {dirty ? (
                  "Alterações ainda não salvas"
                ) : (
                  <>
                    <CheckIcon className="size-4" />
                    Configurações atuais
                  </>
                )}
              </span>
              <button className="button primary" disabled={busy || !result}>
                <BookmarkSquareIcon />
                {busy ? "Salvando..." : "Salvar configurações"}
              </button>
            </div>
          </form>
        </div>
        <aside className="quote-column">
          <section className="island quote-panel">
            <div className="eyebrow">DA IDEIA AO VALOR</div>
            <h2>Sua criação vale mais ✨</h2>
            <p>Preço sugerido por peça</p>
            <div className="quote-price">
              {result ? money(result.price) : "—"}
            </div>
            <span className="margin-pill">
              Margem de lucro de{" "}
              {Number.isFinite(settings.margin) ? settings.margin : 0}%
            </span>
            <div className="cost-lines">
              {result &&
                [
                  { label: "Filamento", value: result.material },
                  { label: "Energia elétrica", value: result.energy },
                  { label: "Uso da máquina", value: result.machine },
                  { label: "Reserva para falhas", value: result.risk },
                  { label: "Mão de obra", value: result.labor },
                  { label: "Custos extras", value: extras },
                ].map((line) => (
                  <div key={line.label}>
                    <span>{line.label}</span>
                    <strong>{money(line.value)}</strong>
                  </div>
                ))}
              <div className="cost-total">
                <span>Custo por peça</span>
                <strong>{result ? money(result.cost) : "—"}</strong>
              </div>
              <div className="text-emerald-300">
                <span>Lucro por peça</span>
                <strong>{result ? money(result.profit) : "—"}</strong>
              </div>
            </div>
            <div className="quote-total">
              <span>
                Total · {Number.isFinite(quantity) ? quantity : 0} peça(s)
              </span>
              <strong>{result ? money(result.total) : "—"}</strong>
            </div>
            {error && (
              <p role="alert" className="text-rose-300">
                {error}
              </p>
            )}
            <SaveQuoteButton calculation={result ? {
              grams, hours, laborMinutes: labor, extras, quantity,
              settings: calculationSettings,
              filament: selectedFilament ? { id: selectedFilament.id, name: selectedFilament.name, brand: selectedFilament.brand, material: selectedFilament.material, colorName: selectedFilament.colorName } : null,
              result,
            } : null} />
            <button
              className="button secondary w-full justify-center"
              disabled={!result}
              onClick={async () => {
                if (!result) return;
                try {
                  await navigator.clipboard.writeText(
                    `Orçamento TEX3D\nQuantidade: ${quantity}\nValor unitário: ${money(result.price)}\nTotal: ${money(result.total)}`,
                  );
                  setNotice("Orçamento copiado!");
                } catch {
                  setNotice(
                    "Não foi possível copiar. Selecione os valores e copie manualmente.",
                  );
                }
              }}
            >
              Copiar orçamento <ArrowUpRightIcon />
            </button>
          </section>
          <div className="calc-tip">
            <span>💡</span>
            <div>
              <strong>Preço com propósito</strong>
              <p>
                A margem é calculada sobre o preço de venda. A reserva de falhas
                cobre novas tentativas de impressão. O orçamento não cria uma
                venda automaticamente.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
