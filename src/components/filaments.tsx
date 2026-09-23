"use client";
import { useState, type FormEvent } from "react";
import { PlusIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useWorkspace } from "./provider";
import { Field, Modal } from "./ui";
import { money } from "@/lib/calculator";
import { createRecordId } from "@/lib/record-id";
import type { Filament } from "@/lib/types";
import { filamentReturn, syncFilamentPurchases } from "@/lib/filament-finance";

const materials: Filament["material"][] = ["PLA", "PETG", "ABS", "ASA", "TPU", "Outro"];

export function Filaments() {
  const { data, mutate, setNotice } = useWorkspace();
  const [editor, setEditor] = useState<Filament | "new" | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filaments = data.filaments ?? [];
  const editing = editor && editor !== "new" ? editor : null;
  const visible = filaments.filter(f =>
    (filter === "all" || (filter === "depleted" ? f.depleted : !f.depleted)) &&
    `${f.name} ${f.brand} ${f.material} ${f.colorName}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")),
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    let id: string;
    try {
      id = editing?.id ?? createRecordId();
    } catch {
      setError("Não foi possível gerar o código do rolo. Atualize o navegador ou acesse por localhost.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const filament: Filament = {
      id,
      name: String(form.get("name")).trim(),
      brand: String(form.get("brand")).trim(),
      material: String(form.get("material")) as Filament["material"],
      color: String(form.get("color")),
      colorName: String(form.get("colorName")).trim(),
      price: Number(form.get("price")),
      weight: Number(form.get("weight")),
      depleted: form.get("depleted") === "on",
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    if (!filament.name || !filament.brand || !filament.colorName || !materials.includes(filament.material) ||
      !/^#[0-9a-f]{6}$/i.test(filament.color) || !Number.isFinite(filament.price) || filament.price < 0 ||
      filament.price > 1000000 || !Number.isFinite(filament.weight) || filament.weight <= 0 || filament.weight > 1000000) {
      setError("Confira os campos. O peso deve ser maior que zero e o preço não pode ser negativo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await mutate(old => {
        const rolls = old.filaments ?? [];
        if (!editing && rolls.length >= 500) throw new Error("Limite de filamentos atingido");
        if (editing && !rolls.some(f => f.id === editing.id)) throw new Error("Filamento removido");
        return syncFilamentPurchases({ ...old, filaments: editing ? rolls.map(f => f.id === filament.id ? filament : f) : [...rolls, filament] });
      });
      setEditor(null);
      setNotice("Filamento salvo.");
    } catch { setError("Não foi possível salvar o filamento. Tente novamente."); }
    finally { setBusy(false); }
  }

  async function remove(filament: Filament) {
    if (busy || !window.confirm(`Excluir o rolo "${filament.name}"? A compra e as vendas registradas serão mantidas no histórico.`)) return;
    setBusy(true);
    try {
      await mutate(old => ({ ...old, filaments: (old.filaments ?? []).filter(f => f.id !== filament.id) }));
      setNotice("Filamento excluído.");
    } catch {} finally { setBusy(false); }
  }

  async function toggle(filament: Filament) {
    if (busy) return;
    setBusy(true);
    try {
      await mutate(old => ({ ...old, filaments: (old.filaments ?? []).map(f => f.id === filament.id ? { ...f, depleted: !filament.depleted } : f) }));
    } catch {} finally { setBusy(false); }
  }

  return <section className="filament-section" aria-label="Estoque de filamentos">
    <div className="filament-toolbar">
      <Field label="Buscar filamentos"><input type="search" value={query} onChange={e => setQuery(e.target.value)} /></Field>
      <Field label="Disponibilidade"><select value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="all">Todos ({filaments.length})</option><option value="available">Disponíveis</option><option value="depleted">Zerados</option>
      </select></Field>
      <button className="button primary" disabled={busy || filaments.length >= 500} onClick={() => { setError(""); setEditor("new"); }}><PlusIcon />Novo filamento</button>
    </div>
    {!visible.length ? <div className="empty"><h3>{filaments.length ? "Nenhum filamento encontrado" : "Nenhum filamento cadastrado"}</h3></div> :
      <div className="filament-list">{visible.map(f => { const returns = filamentReturn(f, data.transactions); return <article key={f.id} className={`filament-row ${f.depleted ? "is-depleted" : ""}`}>
        <div className="filament-identity">
          <span className="filament-swatch" style={{ backgroundColor: f.color }} aria-label={`Cor: ${f.colorName}`} />
          <div><h3>{f.name}</h3><p>{f.brand} · {f.material} · {f.colorName}</p><small>Rolo {f.id.slice(0, 8)}</small></div>
        </div>
        <div className="filament-price"><strong>{money(f.price)}</strong><small>{f.weight.toLocaleString("pt-BR")} g · {money(f.price / f.weight * 1000)}/kg</small></div>
        <dl className="filament-return"><div><dt>Faturamento</dt><dd>{money(returns.revenue)}</dd></div><div><dt>Retorno líquido</dt><dd className={returns.net >= 0 ? "text-emerald-300" : "text-rose-300"}>{money(returns.net)}</dd></div></dl>
        <label className="filament-check"><input type="checkbox" checked={f.depleted} disabled={busy} onChange={() => void toggle(f)} />Zerado</label>
        <div className="filament-actions">
          <button className="icon-button" aria-label={`Editar ${f.name}`} title="Editar filamento" disabled={busy} onClick={() => { setError(""); setEditor(f); }}><PencilSquareIcon /></button>
          <button className="icon-button" aria-label={`Excluir ${f.name}`} title="Excluir filamento" disabled={busy} onClick={() => void remove(f)}><TrashIcon /></button>
        </div>
      </article>; })}</div>}
    {editor && <Modal title={editing ? "Editar filamento" : "Novo filamento"} onClose={() => { if (!busy) setEditor(null); }}>
      <form onSubmit={save}>
        <fieldset disabled={busy} className="filament-fieldset">
          <div className="form-grid">
            <Field label="Nome do rolo"><input name="name" required maxLength={80} placeholder="Ex.: PLA branco 01" defaultValue={editing?.name ?? ""} /></Field>
            <Field label="Marca"><input name="brand" required maxLength={80} defaultValue={editing?.brand ?? ""} /></Field>
            <Field label="Tipo"><select name="material" defaultValue={editing?.material ?? "PLA"}>{materials.map(m => <option key={m}>{m}</option>)}</select></Field>
            <Field label="Nome da cor"><input name="colorName" required maxLength={50} defaultValue={editing?.colorName ?? ""} /></Field>
            <Field label="Cor"><input className="filament-color-input" type="color" name="color" defaultValue={editing?.color ?? "#ffffff"} /></Field>
            <Field label="Preço pago pelo rolo (R$)"><input type="number" name="price" required min="0" max="1000000" step="0.01" defaultValue={editing?.price ?? ""} /></Field>
            <Field label="Peso original do filamento (g)"><input type="number" name="weight" required min="1" max="1000000" step="1" defaultValue={editing?.weight ?? 1000} /></Field>
            <label className="filament-check"><input type="checkbox" name="depleted" defaultChecked={editing?.depleted ?? false} />Zerado</label>
          </div>
          {error && <p role="alert" className="text-rose-300">{error}</p>}
          <div className="filament-form-actions"><button type="button" className="button secondary" onClick={() => setEditor(null)}>Cancelar</button><button className="button primary" type="submit">{busy ? "Salvando..." : "Salvar filamento"}</button></div>
        </fieldset>
      </form>
    </Modal>}
  </section>;
}
