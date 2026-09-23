"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  PlusIcon,
  ArrowUpRightIcon,
  ArrowDownLeftIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useWorkspace } from "./provider";
import { Empty, Field, Modal, PageTitle } from "./ui";
import { money } from "@/lib/calculator";
import { createRecordId } from "@/lib/record-id";
import type { Transaction } from "@/lib/types";
import { watchProjectDetails } from "@/lib/project-details-store";
import { projectPersonalMaterialEnergyCost } from "@/lib/project-details";
const today = () => new Date().toLocaleDateString("en-CA");
export function History({ investmentsOnly = false }: { investmentsOnly?: boolean }) {
  const { data, user, mutate, setNotice } = useWorkspace();
  const [legacyPersonalCosts, setLegacyPersonalCosts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("Todos");
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");
  const [editor, setEditor] = useState<Transaction | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user || investmentsOnly) return;
    const legacy = data.projects.filter(project => (project.quoteCount || project.projectCount) && (project.materialCost === undefined || project.energyCost === undefined) && ((project.personalQuantity ?? 0) + (project.giftQuantity ?? 0)) > 0);
    const stops = legacy.map(project => watchProjectDetails(user.uid, project.id, details => {
      const cost = projectPersonalMaterialEnergyCost(project, data.settings, details);
      setLegacyPersonalCosts(current => ({ ...current, [project.id]: cost }));
    }, () => {}));
    return () => stops.forEach(stop => stop());
  }, [user, data.projects, data.settings, investmentsOnly]);
  const entries = data.transactions
    .filter(
      (t) =>
        (!investmentsOnly || t.kind === "investment") &&
        (filter === "Todos" || t.type === filter) &&
        t.description.toLowerCase().includes(query.toLowerCase()) &&
        (!month || t.date.startsWith(month)),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const personalOnly = !investmentsOnly && filter === "Pessoal";
  const personalEntries = data.projects.map(project => {
    const quantity = (project.personalQuantity ?? 0) + (project.giftQuantity ?? 0);
    const date = project.personalAt || project.createdAt.slice(0, 10);
    const fallbackCost = projectPersonalMaterialEnergyCost(project, data.settings);
    const cost = project.materialCost !== undefined || project.energyCost !== undefined
      ? ((project.materialCost ?? 0) + (project.energyCost ?? 0)) * quantity
      : legacyPersonalCosts[project.id] ?? fallbackCost;
    return { project, quantity, date, cost };
  }).filter(entry => entry.quantity > 0 && entry.project.name.toLowerCase().includes(query.toLowerCase()) && (!month || entry.date.startsWith(month))).sort((a, b) => b.date.localeCompare(a.date));
  const personalSpent = personalEntries.reduce((sum, item) => sum + item.cost, 0);
  const spent = entries
    .filter((t) => t.type === "Compra")
    .reduce((s, t) => s + t.amount, 0);
  const earned = entries
    .filter((t) => t.type === "Venda")
    .reduce((s, t) => s + t.amount, 0);
  const editing = editor && editor !== "new" ? editor : null;
  const automatic = editing?.kind === "project-sale" || Boolean(editing?.sourceFilamentId);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || automatic) return;
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const entry: Transaction = {
      id: editing?.id || createRecordId(),
      description: String(f.get("description")).trim(),
      type: investmentsOnly || editing?.kind === "investment" ? "Compra" : f.get("type") as Transaction["type"],
      kind: investmentsOnly ? "investment" : editing?.kind ?? "manual",
      category: String(f.get("category")),
      amount: Number(f.get("amount")),
      date: String(f.get("date")),
      projectId: String(f.get("projectId")),
    };
    if (
      !entry.description ||
      !Number.isFinite(entry.amount) ||
      entry.amount <= 0
    ) {
      setBusy(false);
      return;
    }
    try {
      await mutate((old) => ({
        ...old,
        transactions: editing
          ? old.transactions.map((t) => (t.id === entry.id ? entry : t))
          : [entry, ...old.transactions],
      }));
      setEditor(null);
      setNotice("Lançamento salvo com sucesso. 💸");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível salvar o lançamento.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !editing ||
      automatic ||
      !window.confirm("Excluir este lançamento? Os saldos serão atualizados.")
    )
      return;
    setBusy(true);
    try {
      await mutate((old) => ({
        ...old,
        transactions: old.transactions.filter((t) => t.id !== editing.id),
      }));
      setEditor(null);
    } catch {
    } finally {
      setBusy(false);
    }
  }
  function exportCsv() {
    const safe = (v: string) =>
      `"${(/^[=+@\-\t\r]/.test(v) ? "'" : "") + v.replaceAll('"', '""')}"`;
    const rows = personalOnly ? [
      ["Data", "Projeto", "Itens pessoais", "Custo de produção (R$)"],
      ...personalEntries.map(item => [item.date, item.project.name, String(item.quantity), item.cost.toFixed(2).replace(".", ",")]),
    ] : [
      ["Data", "Descrição", "Tipo", "Categoria", "Valor (R$)"],
      ...entries.map((t) => [
        t.date,
        t.description,
        t.type,
        t.category,
        t.amount.toFixed(2).replace(".", ","),
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((row) => row.map(safe).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8;" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = personalOnly ? "tex3d-pessoal.csv" : "tex3d-historico.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageTitle
        eyebrow="CADA MOVIMENTO CONTA"
        title={investmentsOnly ? "Investimentos" : personalOnly ? "Histórico pessoal" : "Histórico financeiro 💸"}
        description={investmentsOnly ? "Equipamentos, ferramentas e materiais do estúdio." : personalOnly ? "Itens separados para uso pessoal e seus custos de produção." : "Compras, vendas e uma visão clara do seu estúdio."}
        action={!personalOnly && (
          <button className="button primary" onClick={() => { setError(""); setEditor("new"); }}>
            <PlusIcon />
            {investmentsOnly ? "Novo investimento" : "Novo lançamento"}
          </button>
        )}
      />
      <div className={`stats-grid finance-stats ${investmentsOnly ? "investment-summary" : ""}`}>
        {(investmentsOnly ? [{ label: "Total investido no filtro", value: spent, style: "text-rose-300", emoji: "📦" }] : personalOnly ? [{ label: "Custo pessoal no filtro", value: personalSpent, style: "text-cyan-300", emoji: "🧵" }] : [
          {
            label: "Compras no filtro",
            value: spent,
            style: "text-rose-300",
            emoji: "📦",
          },
          {
            label: "Vendas no filtro",
            value: earned,
            style: "text-emerald-300",
            emoji: "💰",
          },
          {
            label: "Resultado no filtro",
            value: earned - spent,
            style: "text-cyan-300",
            emoji: "✨",
          },
        ]).map((s) => (
          <div className="island finance-stat" key={s.label}>
            <span>
              {s.label}
              <span>{s.emoji}</span>
            </span>
            <strong className={s.style}>{money(s.value)}</strong>
            <small>{personalOnly ? "Somente custo de produção" : "Considerando os lançamentos exibidos"}</small>
          </div>
        ))}
      </div>
      <section className="island history-panel">
        <div className="section-heading">
          <div>
            <h2>{investmentsOnly ? "Investimentos registrados" : personalOnly ? "Itens de uso pessoal" : "Seus movimentos"}</h2>
            <p>{investmentsOnly ? `${entries.length} compra(s)` : personalOnly ? `${personalEntries.length} projeto(s) com itens pessoais` : "As entradas e saídas da sua jornada criativa."}</p>
          </div>
          <button
            className="button secondary"
            onClick={exportCsv}
            disabled={personalOnly ? !personalEntries.length : !entries.length}
          >
            <ArrowDownTrayIcon />
            Exportar CSV
          </button>
        </div>
        <div className="history-filters">
          <div className="tabs">
            {(investmentsOnly ? ["Todos"] : ["Todos", "Compra", "Venda", "Pessoal"]).map((s) => (
              <button
                key={s}
                className={filter === s ? "selected" : ""}
                onClick={() => setFilter(s)}
              >
                {s === "Compra" ? "Compras" : s === "Venda" ? "Vendas" : s}
              </button>
            ))}
          </div>
          <label className="search">
            <MagnifyingGlassIcon />
            <input
              placeholder="Buscar lançamento..."
              aria-label="Buscar lançamento"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <input
            type="month"
            aria-label="Filtrar por mês"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          {month && (
            <button className="text-button" onClick={() => setMonth("")}>
              Limpar mês
            </button>
          )}
        </div>
        {personalOnly && <div className="table-scroll"><table>
          <thead><tr><th>Projeto</th><th>Data pessoal</th><th>Itens pessoais</th><th className="text-right">Custo de produção</th></tr></thead>
          <tbody>{personalEntries.map(item => <tr key={item.project.id}>
            <td><strong>{item.project.name}</strong></td>
            <td>{new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
            <td>{item.quantity}</td>
            <td className="text-right whitespace-nowrap">{money(item.cost)}</td>
          </tr>)}</tbody>
        </table></div>}
        <div className="table-scroll" hidden={personalOnly}>
          <table>
            <thead>
              <tr>
                <th>Lançamento</th>
                <th>Data</th>
                <th>Projeto</th>
                <th>Tipo</th>
                <th className="text-right">Valor</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="transaction-name">
                      <span
                        className={`transaction-icon ${t.type === "Venda" ? "income" : "expense"}`}
                      >
                        {t.type === "Venda" ? (
                          <ArrowDownLeftIcon />
                        ) : (
                          <ArrowUpRightIcon />
                        )}
                      </span>
                      <div>
                        <strong>{t.description}</strong>
                        <small>{t.category}{t.kind === "investment" ? " · Investimento" : t.kind === "project-sale" ? " · Venda do projeto" : ""}</small>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </td>
                  <td>
                    {data.projects.find((p) => p.id === t.projectId)?.name ||
                      "—"}
                  </td>
                  <td>
                    <span
                      className={`status ${t.type === "Venda" ? "status-done" : "status-planned"}`}
                    >
                      {t.type}
                    </span>
                  </td>
                  <td
                    className={`text-right whitespace-nowrap ${t.type === "Venda" ? "text-emerald-300" : "text-rose-300"}`}
                  >
                    {t.type === "Venda" ? "+" : "−"} {money(t.amount)}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Editar ${t.description}`}
                      title={t.kind === "project-sale" ? "Venda vinculada ao projeto" : "Editar lançamento"}
                      onClick={() => { setError(""); setEditor(t); }}
                    >
                      <PencilSquareIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {personalOnly && !personalEntries.length && <Empty emoji="🧵" title="Nenhum item pessoal" description="Marque itens como pessoal nos seus projetos para vê-los aqui." />}
        {!personalOnly && !entries.length && (
          <Empty
            emoji="🧾"
            title="Nenhum lançamento por aqui"
            description="Adicione uma compra ou venda, ou ajuste os filtros."
          />
        )}
        <div className="table-footer">
          {personalOnly ? `${personalEntries.length} projeto(s)` : `${entries.length} lançamento${entries.length !== 1 ? "s" : ""}`}
          <span>Valores em reais (BRL)</span>
        </div>
      </section>
      {editor && (
        <Modal
          title={editing?.kind === "project-sale" ? "Venda vinculada ao projeto" : editing ? "Editar lançamento" : investmentsOnly ? "Novo investimento" : "Novo lançamento 💸"}
          onClose={() => {
            if (!busy) setEditor(null);
          }}
        >
          <form onSubmit={save} className="form-stack">
            {editing?.kind === "project-sale" && <p>Este lançamento pertence a {data.projects.find(project => project.id === editing.projectId)?.name ?? "um projeto excluído"}. {editing.projectId ? "Altere o estado da venda no projeto." : "O registro financeiro da venda foi preservado."}</p>}
            {editing?.kind === "investment" && editing.sourceFilamentId && <p>Compra vinculada ao rolo de filamento. Altere o preço na aba Filamentos. O registro é preservado quando o rolo é excluído.</p>}
            <fieldset className="quote-fieldset" disabled={busy || automatic}>
            <div className="form-grid">
              <Field label="Tipo">
                <select name="type" disabled={investmentsOnly || editing?.kind === "investment"} defaultValue={investmentsOnly ? "Compra" : editing?.type || "Venda"}>
                  <option>Venda</option>
                  <option>Compra</option>
                </select>
              </Field>
              <Field label="Valor (R$)">
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  max="999999999"
                  step="0.01"
                  required
                  defaultValue={editing?.amount}
                />
              </Field>
            </div>
            <Field label="Descrição">
              <input
                name="description"
                maxLength={120}
                required
                defaultValue={editing?.description}
                placeholder={investmentsOnly ? "Ex.: Impressora 3D, cola ou ferramentas" : "Ex.: Venda de vaso paramétrico"}
              />
            </Field>
            <div className="form-grid">
              <Field label="Data">
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={editing?.date || today()}
                />
              </Field>
              <Field label="Categoria">
                <select
                  name="category"
                  defaultValue={editing?.category || (investmentsOnly ? "Equipamento" : "Peça impressa")}
                >
                  {[
                    "Peça impressa",
                    "Filamento",
                    "Equipamento",
                    "Impressora",
                    "Cola e adesivos",
                    "Ferramentas",
                    "Manutenção",
                    "Serviço",
                    "Outros",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Projeto vinculado">
              <select name="projectId" defaultValue={editing?.projectId || ""}>
                <option value="">Sem projeto vinculado</option>
                {data.projects.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="modal-actions">
              {editing && (
                <button
                  type="button"
                  className="button danger"
                  onClick={remove}
                  disabled={busy}
                >
                  <TrashIcon />
                  Excluir
                </button>
              )}
              <button className="button primary ml-auto" disabled={busy}>
                {busy ? "Salvando..." : investmentsOnly ? "Salvar investimento" : "Salvar lançamento"}
              </button>
            </div>
            </fieldset>
            {error && <p role="alert" className="text-rose-300">{error}</p>}
          </form>
        </Modal>
      )}
    </>
  );
}
