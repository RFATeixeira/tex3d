"use client";
/* eslint-disable @next/next/no-img-element -- User images are bounded inline JPEG data URLs. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useWorkspace } from "./provider";
import { Field, Modal } from "./ui";
import { createRecordId } from "@/lib/record-id";
import { encodeQuoteImage } from "@/lib/quote-image";
import { watchQuotes } from "@/lib/quotes-store";
import { watchProjectDetails } from "@/lib/project-details-store";
import { estimateMaterialEnergy, projectQuote, projectTotals, type ProjectComponent, type ProjectQuote } from "@/lib/project-details";
import { money } from "@/lib/calculator";
import type { SavedQuote } from "@/lib/quotes";
import type { Project } from "@/lib/types";
import { syncProjectSales } from "@/lib/project-sales";
import { allocationSummary, wholeProjectAllocation } from "@/lib/project-allocation";
import { AllocationControls } from "./project-allocation";

const today = () => new Date().toLocaleDateString("en-CA");

function containsProject(candidateId: string, targetId: string | undefined, projects: Project[], visited = new Set<string>()): boolean {
  if (!targetId) return false;
  if (candidateId === targetId) return true;
  if (visited.has(candidateId)) return false;
  visited.add(candidateId);
  const candidate = projects.find(item => item.id === candidateId);
  return Boolean(candidate?.componentIds?.some(id => containsProject(id, targetId, projects, visited)));
}

export function ProjectPhoto({ project }: { project: Project }) {
  const { user } = useWorkspace();
  const [image, setImage] = useState("");
  useEffect(() => {
    if (!user || !project.hasImage) return;
    return watchProjectDetails(user.uid, project.id, details => setImage(details.image), () => setImage(""));
  }, [user, project.id, project.hasImage]);
  return image ? <img className="project-own-photo" src={image} alt={project.name} /> : <span className="project-emoji">{project.emoji}</span>;
}

export function ProjectEditor({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const { user, data, mutate, setNotice } = useWorkspace();
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [selected, setSelected] = useState<ProjectQuote[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<ProjectComponent[]>([]);
  const [sourceTab, setSourceTab] = useState<"quotes" | "projects">("quotes");
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(Boolean(project?.hasImage || project?.quoteCount || project?.projectCount));
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [quotesError, setQuotesError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [count, setCount] = useState(25);
  const [query, setQuery] = useState("");
  const [manualAllocation, setManualAllocation] = useState(() => project ? wholeProjectAllocation(project) : { soldQuantity: 0, personalQuantity: 0, giftQuantity: 0 });
  const [wholeMode, setWholeMode] = useState(!project || project.allocationMode === "project");
  const initialized = useRef(false);
  const id = useRef(project?.id ?? "");
  const totals = projectTotals(selected, selectedProjects, data.settings);
  const hasComposition = selected.length > 0 || selectedProjects.length > 0;
  const soldTotals = wholeMode ? { total: totals.total * manualAllocation.soldQuantity, cost: totals.cost * manualAllocation.soldQuantity } : { total: project?.soldRevenue ?? 0, cost: project?.soldCost ?? 0 };
  const locked = busy || processing || loading || Boolean(loadError);

  useEffect(() => {
    if (!user) return;
    return watchQuotes(user.uid, count + 1, items => { setQuotes(items); setQuotesLoading(false); setQuotesError(""); }, () => { setQuotesError("Não foi possível carregar os orçamentos."); setQuotesLoading(false); });
  }, [user, count]);
  useEffect(() => {
    if (!user || !project || (!project.hasImage && !project.quoteCount && !project.projectCount)) return;
    return watchProjectDetails(user.uid, project.id, details => {
      if (initialized.current) return;
      initialized.current = true;
      setImage(details.image); setSelected(details.quotes); setSelectedProjects(details.components ?? []); setManualAllocation(wholeProjectAllocation(project, details.quotes)); setLoading(false);
    }, () => { setLoadError("Não foi possível carregar os dados do projeto. Feche e tente novamente."); setLoading(false); });
  }, [user, project]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      id.current ||= createRecordId();
      const name = String(form.get("name")).trim();
      if (!name) throw new Error("Informe o nome do projeto.");
      const grams = hasComposition ? totals.grams : Number(form.get("grams"));
      const hours = hasComposition ? totals.hours : Number(form.get("hours"));
      if (![grams, hours].every(value => Number.isFinite(value) && value >= 0)) throw new Error("Confira o peso e o tempo do projeto.");
      const manualTotal = hasComposition ? 0 : Number(form.get("total"));
      const manualCost = hasComposition ? 0 : Number(form.get("cost"));
      if (![manualTotal, manualCost].every(value => Number.isFinite(value) && value >= 0)) throw new Error("Confira o custo e o valor do projeto.");
      const draft: Project = {
        id: id.current, name, description: String(form.get("description")).trim(),
        emoji: String(form.get("emoji")), material: hasComposition ? totals.material : String(form.get("material")),
        status: project?.status ?? "Planejado", grams, hours,
        createdAt: project?.createdAt ?? new Date().toISOString(),
        hasImage: Boolean(image), quoteCount: selected.length, projectCount: selectedProjects.length, componentIds: selectedProjects.map(item => item.id), total: hasComposition ? totals.total : manualTotal, cost: hasComposition ? totals.cost : manualCost,
        materialCost: hasComposition ? totals.materialCost : estimateMaterialEnergy(grams, hours, data.settings).materialCost,
        energyCost: hasComposition ? totals.energyCost : estimateMaterialEnergy(grams, hours, data.settings).energyCost,
        ...(wholeMode ? { ...manualAllocation, allocationMode: "project" as const } : { soldQuantity: project?.soldQuantity ?? (project?.saleStatus === "sold" ? 1 : 0), personalQuantity: (project?.personalQuantity ?? 0) + (project?.giftQuantity ?? 0), giftQuantity: 0, saleStatus: project?.saleStatus ?? "unsold" }),
        personalAt: manualAllocation.personalQuantity ? (project && manualAllocation.personalQuantity === (project.personalQuantity ?? 0) + (project.giftQuantity ?? 0) ? project.personalAt || today() : today()) : "",
        soldAt: manualAllocation.soldQuantity ? String(form.get("soldAt") || project?.soldAt || today()) : "",
      };
      const { project: next, sales } = allocationSummary(draft, selected, today(), selectedProjects);
      await mutate(old => {
        if (project && !old.projects.some(item => item.id === project.id)) throw new Error("Projeto removido");
        if (!project && old.projects.length >= 500) throw new Error("Limite de projetos atingido");
        return { ...old, projects: project ? old.projects.map(item => item.id === next.id ? next : item) : [next, ...old.projects], transactions: syncProjectSales(old.transactions, next, sales) };
      }, { projectId: next.id, details: { image, quotes: selected, components: selectedProjects } });
      setNotice("Projeto salvo."); onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar o projeto."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!project || busy || !window.confirm("Excluir este projeto? Os lançamentos financeiros serão mantidos.")) return;
    setBusy(true);
    try {
      await mutate(old => ({ ...old, projects: old.projects.filter(item => item.id !== project.id), transactions: old.transactions.map(item => item.projectId === project.id ? { ...item, projectId: "" } : item) }), { projectId: project.id, details: null });
      onClose();
    } catch { setError("Não foi possível excluir o projeto."); }
    finally { setBusy(false); }
  }
  const options = quotes.slice(0, count).filter(quote => `${quote.name} ${quote.filament?.name ?? ""} ${quote.filament?.material ?? ""}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  const projectOptions = data.projects.filter(item => item.id !== project?.id && `${item.name} ${item.material}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")) && !containsProject(item.id, project?.id, data.projects));
  return <Modal title={project ? "Editar projeto" : "Uma nova ideia"} onClose={() => { if (!busy && !processing) onClose(); }}>
    {loading && <p role="status">Carregando projeto...</p>}
    {loadError && <p role="alert" className="text-rose-300">{loadError}</p>}
    <form className="form-stack" onSubmit={save}><fieldset className="quote-fieldset" disabled={locked}>
      <Field label="Nome do projeto"><input name="name" required maxLength={80} defaultValue={project?.name ?? ""} placeholder="Ex.: Kit de organização" /></Field>
      <Field label="Descrição"><textarea name="description" maxLength={240} rows={2} defaultValue={project?.description ?? ""} /></Field>
      <Field label="Foto do projeto"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
        setProcessing(true); setError("");
        try { setImage(await encodeQuoteImage(file)); }
        catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível carregar a foto."); }
        finally { setProcessing(false); }
      }} /></Field>
      {image && <div className="quote-image-preview"><img src={image} alt="Foto do projeto" /><button type="button" className="icon-button" title="Remover foto" aria-label="Remover foto" onClick={() => setImage("")}><XMarkIcon /></button></div>}
      <section className="project-quote-picker" aria-label="Composição do projeto">
        <div className="tabs project-source-tabs" role="tablist" aria-label="Origem dos itens">
          <button type="button" role="tab" aria-selected={sourceTab === "quotes"} className={sourceTab === "quotes" ? "selected" : ""} onClick={() => setSourceTab("quotes")}>Orçamentos</button>
          <button type="button" role="tab" aria-selected={sourceTab === "projects"} className={sourceTab === "projects" ? "selected" : ""} onClick={() => setSourceTab("projects")}>Projetos</button>
        </div>
        <Field label={sourceTab === "quotes" ? "Buscar orçamentos" : "Buscar projetos"}><input type="search" value={query} onChange={event => setQuery(event.target.value)} /></Field>
        {sourceTab === "quotes" ? <>
        {quotesLoading && <p role="status">Carregando orçamentos...</p>}
        {quotesError && <p role="alert" className="text-rose-300">{quotesError}</p>}
        {!quotesLoading && !quotesError && !options.length && <p>Nenhum orçamento encontrado.</p>}
        <div className="project-quote-options">{options.map(quote => <label className="project-quote-option" key={quote.id}>
          <input type="checkbox" checked={selected.some(item => item.id === quote.id)} disabled={selected.length >= 100 && !selected.some(item => item.id === quote.id)} onChange={event => setSelected(old => event.target.checked ? [...old, projectQuote(quote)] : old.filter(item => item.id !== quote.id))} />
            <span><strong>{quote.name}</strong><small>{quote.filament ? `${quote.filament.name} · ${quote.filament.material}` : "Filamento não associado"} · {quote.quantity} peça(s) · {quote.grams * quote.quantity} g · {quote.hours * quote.quantity} h</small></span><strong>{money(quote.result.total)}</strong>
        </label>)}</div>
        {quotes.length > count && <button type="button" className="button secondary" onClick={() => setCount(count + 25)}>Carregar mais</button>}
        </> : <>
          {!projectOptions.length && <p>Nenhum projeto disponível para combinar.</p>}
          <div className="project-quote-options">{projectOptions.map(item => <label className="project-quote-option" key={item.id}>
            <input type="checkbox" checked={selectedProjects.some(component => component.id === item.id)} disabled={selectedProjects.length >= 100 && !selectedProjects.some(component => component.id === item.id)} onChange={event => setSelectedProjects(old => event.target.checked ? [...old, { id: item.id, name: item.name, grams: item.grams, hours: item.hours, material: item.material, total: item.total, cost: item.cost }] : old.filter(component => component.id !== item.id))} />
            <span><strong>{item.name}</strong><small>{item.material} · {item.grams} g · {item.hours} h</small></span><strong>{money(item.total ?? 0)}</strong>
          </label>)}</div>
        </>}
      </section>
      {hasComposition && <section className="project-selected-quotes" aria-label="Resumo dos itens selecionados">
        <h3>Selecionados ({selected.length + selectedProjects.length})</h3>
        {selected.map(quote => <div key={quote.id} className="project-sale-item"><div className="project-selected-quote"><div><strong>{quote.name}</strong><small>{quote.quantity} peça(s) · {money(quote.result.total)}</small></div><button type="button" className="icon-button" title="Remover orçamento do projeto" aria-label={`Remover ${quote.name}`} onClick={() => setSelected(old => old.filter(item => item.id !== quote.id))}><XMarkIcon /></button></div>
        </div>)}
        {selectedProjects.map(component => <div key={component.id} className="project-sale-item"><div className="project-selected-quote"><div><strong>{component.name}</strong><small>Projeto · {money(component.total ?? 0)}</small></div><button type="button" className="icon-button" title="Remover projeto da composição" aria-label={`Remover ${component.name}`} onClick={() => setSelectedProjects(old => old.filter(item => item.id !== component.id))}><XMarkIcon /></button></div></div>)}
        <dl className="saved-quote-facts"><div><dt>Peso total</dt><dd>{totals.grams.toLocaleString("pt-BR")} g</dd></div><div><dt>Tempo total</dt><dd>{totals.hours.toLocaleString("pt-BR")} h</dd></div><div><dt>Peças</dt><dd>{totals.quantity}</dd></div><div><dt>Materiais</dt><dd>{totals.material}</dd></div><div><dt>Custo total</dt><dd>{money(totals.cost)}</dd></div><div><dt>Valor do projeto</dt><dd>{money(totals.total)}</dd></div></dl>
        <dl className="saved-quote-facts"><div><dt>Vendas realizadas</dt><dd>{money(soldTotals.total)}</dd></div><div><dt>Custo dos vendidos</dt><dd>{money(soldTotals.cost)}</dd></div><div><dt>Lucro dos vendidos</dt><dd>{money(soldTotals.total - soldTotals.cost)}</dd></div></dl>
      </section>}
      <div className="form-grid">
        <Field label="Emoji"><select name="emoji" defaultValue={project?.emoji ?? "🧊"}>{["🧊", "🌿", "💡", "✏️", "🧑‍🚀", "🐉", "🎮", "⚙️", "🏠", "🚀", "🎨", "🤖"].map(emoji => <option key={emoji}>{emoji}</option>)}</select></Field>
        {!hasComposition && <><Field label="Material"><input name="material" required maxLength={80} defaultValue={project?.material ?? "PLA"} /></Field><Field label="Peso estimado (g)"><input name="grams" type="number" required min="0" max="1000000" step="0.1" defaultValue={project?.grams ?? 0} /></Field><Field label="Tempo estimado (h)"><input name="hours" type="number" required min="0" max="100000" step="0.1" defaultValue={project?.hours ?? 0} /></Field></>}
      </div>
      {!hasComposition && <div className="form-grid"><Field label="Valor de venda do projeto (R$)"><input name="total" type="number" required min="0" max="999999999" step="0.01" defaultValue={project?.total ?? 0} /></Field><Field label="Custo do projeto (R$)"><input name="cost" type="number" required min="0" max="999999999" step="0.01" defaultValue={project?.cost ?? 0} /></Field></div>}
      <AllocationControls name={project?.name ?? "Projeto"} value={manualAllocation} disabled={locked} onChange={value => {
        if (!wholeMode && project?.saleStatus === "partial" && !window.confirm("Substituir as vendas avulsas antigas pela contagem de projetos completos?")) return;
        setWholeMode(true); setManualAllocation(value);
      }} />
      {manualAllocation.soldQuantity > 0 && <Field label="Data da venda"><input name="soldAt" type="date" required defaultValue={project?.soldAt || today()} /></Field>}
      <div className="modal-actions">{project && <button type="button" className="button danger" onClick={() => void remove()}><TrashIcon />Excluir</button>}<button type="submit" className="button primary ml-auto">{busy ? "Salvando..." : processing ? "Preparando foto..." : "Salvar projeto"}</button></div>
    </fieldset>{error && <p role="alert" className="text-rose-300">{error}</p>}</form>
  </Modal>;
}
