"use client";
import { useEffect, useRef, useState } from "react";
import { MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import { wholeProjectAllocation, allocationSummary, type Allocation } from "@/lib/project-allocation";
import { watchProjectDetails } from "@/lib/project-details-store";
import { syncProjectSales } from "@/lib/project-sales";
import type { ProjectDetails } from "@/lib/project-details";
import type { Project } from "@/lib/types";
import { useWorkspace } from "./provider";

export function AllocationControls({ name, quantity, value, disabled, onChange }: { name: string; quantity?: number; value: Allocation; disabled?: boolean; onChange: (value: Allocation) => void }) {
  const remaining = quantity === undefined ? null : quantity - value.soldQuantity - value.personalQuantity - value.giftQuantity;
  const counter = (key: keyof Allocation, label: string) => <div className="allocation-counter">
    <button type="button" className="icon-button" title={`Diminuir ${label}: ${name}`} aria-label={`Diminuir ${label}: ${name}`} disabled={disabled || value[key] === 0} onClick={() => onChange({ ...value, [key]: value[key] - 1 })}><MinusIcon /></button>
    <output aria-label={`${label}: ${name}`}>{value[key]}</output>
    <button type="button" className="icon-button" title={`Adicionar ${label}: ${name}`} aria-label={`Adicionar ${label}: ${name}`} disabled={disabled || (remaining !== null && remaining <= 0) || value[key] >= 1000000} onClick={() => onChange({ ...value, [key]: value[key] + 1 })}><PlusIcon /></button>
  </div>;
  return <div className="allocation-controls">
    <div className="allocation-row"><span>Vendidos</span>{counter("soldQuantity", "vendidos")}</div>
    <div className="allocation-row"><span>Pessoal</span>{counter("personalQuantity", "pessoal")}</div>
    <small>{remaining !== null ? `${remaining} disponível(is) · ` : ""}{value.personalQuantity + value.giftQuantity} pessoal</small>
  </div>;
}

export function ProjectAllocation({ project }: { project: Project }) {
  const { user, mutate } = useWorkspace();
  const [details, setDetails] = useState<ProjectDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  useEffect(() => {
    if (!user || !project.quoteCount) return;
    return watchProjectDetails(user.uid, project.id, next => { setDetails(next); setError(""); }, () => setError("Não foi possível carregar as peças."));
  }, [user, project.id, project.quoteCount]);
  const loading = Boolean(project.quoteCount && !details?.quotes.length);
  async function change(value: Allocation) {
    if (pending.current || loading) return;
    if (project.allocationMode !== "project" && project.saleStatus === "partial" && !window.confirm("Este projeto tem vendas antigas de peças avulsas. Substituir esses lançamentos pela contagem de projetos completos?")) return;
    pending.current = true; setBusy(true); setError("");
    const date = new Date().toLocaleDateString("en-CA");
    try {
      await mutate(old => {
        const current = old.projects.find(item => item.id === project.id);
        if (!current) throw new Error("Projeto removido.");
        const personalAt = value.personalQuantity === (current.personalQuantity ?? 0) + (current.giftQuantity ?? 0) ? current.personalAt : value.personalQuantity ? date : "";
        const summary = allocationSummary({ ...current, ...value, personalAt, allocationMode: "project", soldAt: current.soldAt || date }, details?.quotes ?? [], date, details?.components ?? []);
        return { ...old, projects: old.projects.map(item => item.id === current.id ? summary.project : item), transactions: syncProjectSales(old.transactions, summary.project, summary.sales) };
      });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div aria-busy={busy}>
    <AllocationControls name={project.name} value={wholeProjectAllocation(project, details?.quotes)} disabled={busy || loading} onChange={value => void change(value)} />
    {project.allocationMode !== "project" && project.saleStatus === "partial" && <small>Vendas avulsas anteriores: {project.soldQuantity ?? 0} peça(s)</small>}
    {loading && !error && <small role="status">Carregando peças...</small>}
    {error && <p role="alert" className="text-rose-300">{error}</p>}
  </div>;
}
