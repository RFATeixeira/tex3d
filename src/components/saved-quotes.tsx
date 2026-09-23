"use client";
/* eslint-disable @next/next/no-img-element -- Images are size-limited inline JPEG data URLs. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BookmarkSquareIcon, PhotoIcon, TrashIcon, XMarkIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { useWorkspace } from "./provider";
import { Field, Modal } from "./ui";
import { calculate, money } from "@/lib/calculator";
import { createRecordId } from "@/lib/record-id";
import { makeQuote, type QuoteCalculation, type SavedQuote } from "@/lib/quotes";
import { encodeQuoteImage } from "@/lib/quote-image";
import { removeQuote, saveQuote, watchQuotes } from "@/lib/quotes-store";

export function SaveQuoteButton({ calculation }: { calculation: QuoteCalculation | null }) {
  const [draft, setDraft] = useState<QuoteCalculation | null>(null);
  return <>
    <button className="button primary w-full justify-center save-quote-button" disabled={!calculation} onClick={() => setDraft(calculation ? structuredClone(calculation) : null)}><BookmarkSquareIcon />Salvar orçamento</button>
    {draft && <QuoteEditor calculation={draft} onClose={() => setDraft(null)} />}
  </>;
}

function QuoteEditor({ calculation, quote, onClose }: { calculation: QuoteCalculation; quote?: SavedQuote; onClose: () => void }) {
  const { user, data, authorized, setNotice } = useWorkspace();
  const id = useRef(quote?.id ?? "");
  const [draft, setDraft] = useState(calculation);
  const [filamentId, setFilamentId] = useState(quote?.filament?.id ?? calculation.filament?.id ?? "");
  const [image, setImage] = useState(quote?.image ?? "");
  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  let preview = draft.result;
  let calculationError = "";
  try { preview = calculate(draft.settings, draft.grams, draft.hours, draft.laborMinutes, draft.extras, draft.quantity); }
  catch (failure) { calculationError = failure instanceof Error ? failure.message : "Confira os valores de produção."; }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || processing) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (!user || !authorized) throw new Error("Entre novamente para salvar o orçamento.");
      id.current ||= createRecordId();
      const nextCalculation = {
        ...draft,
        grams: Number(form.get("grams")),
        hours: Number(form.get("hours")),
        laborMinutes: Number(form.get("laborMinutes")),
        extras: Number(form.get("extras")),
        quantity: Number(form.get("quantity")),
      };
      const saved = makeQuote(nextCalculation, { id: id.current, name: String(form.get("name")), printType: quote?.printType ?? "FDM", image });
      await saveQuote(user.uid, quote ? { ...saved, createdAt: quote.createdAt } : saved);
      setNotice(quote ? "Orçamento atualizado." : "Orçamento salvo.");
      onClose();
    } catch (failure) {
      setError(failure instanceof Error && !("code" in failure) ? failure.message : "Não foi possível salvar o orçamento. Verifique sua conexão e permissão de acesso.");
    } finally { setBusy(false); }
  }
  return <Modal title={quote ? "Editar orçamento" : "Salvar orçamento"} onClose={() => { if (!busy && !processing) onClose(); }}>
    <form className="form-stack" onSubmit={submit}>
      <fieldset className="quote-fieldset" disabled={busy || processing}>
        <div className="form-grid">
          <Field label="Nome da peça"><input name="name" required maxLength={100} placeholder="Ex.: Suporte de celular" defaultValue={quote?.name ?? ""} /></Field>
          <Field label="Filamento usado"><select value={filamentId} onChange={event => {
            const nextId = event.target.value;
            const filament = data.filaments?.find(item => item.id === nextId);
            setFilamentId(nextId);
            setDraft(old => ({
              ...old,
              filament: filament ? { id: filament.id, name: filament.name, brand: filament.brand, material: filament.material, colorName: filament.colorName } : null,
              settings: { ...old.settings, filamentPrice: filament?.price ?? data.settings.filamentPrice, spoolWeight: filament ? 1000 : data.settings.spoolWeight },
            }));
          }}>
            <option value="">Sem filamento cadastrado (usar preço padrão)</option>
            {filamentId && !data.filaments?.some(item => item.id === filamentId) && <option value={filamentId} disabled>{quote?.filament?.name ?? calculation.filament?.name ?? "Filamento salvo"} (não cadastrado)</option>}
            {(data.filaments ?? []).map(filament => <option key={filament.id} value={filament.id}>{filament.name} · {filament.material} · {filament.colorName}{filament.depleted ? " · esgotado" : ""}</option>)}
          </select></Field>
        </div>
        <div className="form-grid">
          <Field label="Peso por peça (g)"><input name="grams" type="number" required min="0" max="1000000" step="0.1" value={draft.grams} onChange={event => setDraft(old => ({ ...old, grams: Number(event.target.value) }))} /></Field>
          <Field label="Tempo por peça (h)"><input name="hours" type="number" required min="0" max="100000" step="0.1" value={draft.hours} onChange={event => setDraft(old => ({ ...old, hours: Number(event.target.value) }))} /></Field>
          <Field label="Mão de obra por peça (min)"><input name="laborMinutes" type="number" required min="0" max="100000" step="0.1" value={draft.laborMinutes} onChange={event => setDraft(old => ({ ...old, laborMinutes: Number(event.target.value) }))} /></Field>
          <Field label="Custos extras (R$)"><input name="extras" type="number" required min="0" max="999999999" step="0.01" value={draft.extras} onChange={event => setDraft(old => ({ ...old, extras: Number(event.target.value) }))} /></Field>
          <Field label="Quantidade"><input name="quantity" type="number" required min="1" max="100000" step="1" value={draft.quantity} onChange={event => setDraft(old => ({ ...old, quantity: Number(event.target.value) }))} /></Field>
        </div>
        <Field label="Imagem da peça"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={async event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setProcessing(true);
          setError("");
          try { setImage(await encodeQuoteImage(file)); }
          catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível carregar a imagem."); }
          finally { setProcessing(false); }
        }} /></Field>
        {image && <div className="quote-image-preview"><img src={image} alt="Prévia da peça" /><button type="button" className="icon-button" title="Remover imagem" aria-label="Remover imagem" onClick={() => setImage("")}><XMarkIcon /></button></div>}
        <div className="saved-quote-summary"><span>{draft.grams} g · {draft.hours} h · {draft.quantity} peça(s){calculationError && <small role="alert">{calculationError}</small>}</span><strong>{money(preview.total)}</strong></div>
        <div className="filament-form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button primary" disabled={Boolean(calculationError)}><BookmarkSquareIcon />{busy ? "Salvando..." : processing ? "Preparando imagem..." : quote ? "Salvar alterações" : "Confirmar orçamento"}</button></div>
      </fieldset>
      {error && <p role="alert" className="text-rose-300">{error}</p>}
    </form>
  </Modal>;
}

export function SavedQuotes() {
  const { user } = useWorkspace();
  return user ? <QuoteList key={user.uid} uid={user.uid} /> : null;
}

function QuoteList({ uid }: { uid: string }) {
  const { setNotice } = useWorkspace();
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [count, setCount] = useState(25);
  const [selected, setSelected] = useState<SavedQuote | null>(null);
  const [editing, setEditing] = useState<SavedQuote | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => watchQuotes(uid, count + 1, items => {
    setQuotes(items); setLoading(false); setError("");
  }, () => { setError("Não foi possível carregar os orçamentos."); setLoading(false); }), [uid, count]);
  async function remove(quote: SavedQuote) {
    if (busy || !window.confirm(`Excluir o orçamento "${quote.name}"?`)) return;
    setBusy(true);
    try { await removeQuote(uid, quote.id); setSelected(null); setNotice("Orçamento excluído."); }
    catch { setError("Não foi possível excluir o orçamento. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Orçamentos salvos">
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    {loading ? <p role="status">Carregando orçamentos...</p> : !quotes.length && !error ? <div className="empty"><h3>Nenhum orçamento salvo</h3></div> : null}
    <div className="saved-quotes-list">{quotes.slice(0, count).map(quote => <article className="saved-quote-row" key={quote.id}>
      <button className="saved-quote-open" onClick={() => setSelected(quote)} aria-label={`Abrir orçamento ${quote.name}`}>
        <span className="saved-quote-thumb">{quote.image ? <img src={quote.image} alt={quote.name} loading="lazy" /> : <PhotoIcon />}</span>
        <span className="saved-quote-name"><strong>{quote.name}</strong><small>{quote.filament ? `${quote.filament.name} · ${quote.filament.material}` : "Filamento não associado"} · {new Date(quote.createdAt).toLocaleDateString("pt-BR")}</small><small>{quote.grams} g · {quote.hours} h · {quote.quantity} peça(s)</small></span>
        <span className="saved-quote-amount"><strong>{money(quote.result.total)}</strong><small>{money(quote.result.price)} / peça</small></span>
      </button>
      <button className="icon-button" disabled={busy} title="Editar orçamento" aria-label={`Editar orçamento ${quote.name}`} onClick={() => setEditing(quote)}><PencilSquareIcon /></button>
      <button className="icon-button" disabled={busy} title="Excluir orçamento" aria-label={`Excluir orçamento ${quote.name}`} onClick={() => void remove(quote)}><TrashIcon /></button>
    </article>)}</div>
    {quotes.length > count && <button className="button secondary" onClick={() => setCount(count + 25)}>Carregar mais</button>}
    {selected && <Modal title={selected.name} onClose={() => setSelected(null)}><QuoteDetails quote={selected} /></Modal>}
    {editing && <QuoteEditor calculation={quoteCalculation(editing)} quote={editing} onClose={() => setEditing(null)} />}
  </section>;
}

function quoteCalculation(quote: SavedQuote): QuoteCalculation {
  return {
    grams: quote.grams,
    hours: quote.hours,
    laborMinutes: quote.laborMinutes,
    extras: quote.extras,
    quantity: quote.quantity,
    settings: quote.settings,
    filament: quote.filament,
    result: quote.result,
  };
}

function QuoteDetails({ quote }: { quote: SavedQuote }) {
  const { result, settings } = quote;
  const lines = [
    ["Filamento", result.material], ["Energia elétrica", result.energy], ["Uso da máquina", result.machine],
    ["Reserva para falhas", result.risk], ["Mão de obra", result.labor], ["Custos extras", quote.extras],
    ["Custo por peça", result.cost], ["Lucro por peça", result.profit], ["Preço por peça", result.price],
  ] as const;
  return <div className="saved-quote-details">
    {quote.image && <img className="saved-quote-detail-image" src={quote.image} alt={quote.name} />}
    <dl className="saved-quote-facts">
      <div><dt>Filamento usado</dt><dd>{quote.filament ? `${quote.filament.name} · ${quote.filament.brand} · ${quote.filament.material} · ${quote.filament.colorName}` : "Nenhum filamento cadastrado"}</dd></div>
      <div><dt>Data</dt><dd>{new Date(quote.createdAt).toLocaleString("pt-BR")}</dd></div>
      <div><dt>Peso por peça</dt><dd>{quote.grams} g</dd></div>
      <div><dt>Tempo por peça</dt><dd>{quote.hours} h</dd></div>
      <div><dt>Trabalho manual por peça</dt><dd>{quote.laborMinutes} min</dd></div>
      <div><dt>Quantidade</dt><dd>{quote.quantity}</dd></div>
      <div><dt>Filamento</dt><dd>{quote.filament ? `${quote.filament.name} · ${quote.filament.brand} · ${quote.filament.material} · ${quote.filament.colorName}` : "Nenhum filamento associado"}</dd></div>
      <div><dt>Preço do rolo / peso</dt><dd>{money(settings.filamentPrice)} / {settings.spoolWeight} g</dd></div>
      <div><dt>Potência / energia</dt><dd>{settings.power} W / {money(settings.energyRate)} por kWh</dd></div>
      <div><dt>Máquina / mão de obra</dt><dd>{money(settings.machineRate)} / {money(settings.laborRate)} por hora</dd></div>
      <div><dt>Falhas / margem</dt><dd>{settings.failureRate}% / {settings.margin}%</dd></div>
    </dl>
    <h3>Detalhamento por peça</h3>
    <div className="cost-lines">{lines.map(([label, amount]) => <div key={label}><span>{label}</span><strong>{money(amount)}</strong></div>)}</div>
    <div className="quote-total"><span>Total do orçamento</span><strong>{money(result.total)}</strong></div>
  </div>;
}
