"use client";
import { useEffect, useState } from "react";
import { PlusIcon, MagnifyingGlassIcon, ArrowUpRightIcon, CubeIcon, ClockIcon } from "@heroicons/react/24/outline";
import { useWorkspace } from "./provider";
import { ProjectEditor, ProjectPhoto } from "./project-editor";
import { ProjectAllocation } from "./project-allocation";
import { money } from "@/lib/calculator";
import type { Project } from "@/lib/types";
import type { ProjectDetails } from "@/lib/project-details";
import type { SavedQuote } from "@/lib/quotes";
import { watchProjectDetails } from "@/lib/project-details-store";
import { watchQuotes } from "@/lib/quotes-store";

function materialLabel(value: string) {
  const materials = value.split("/").map(item => item.trim()).filter(Boolean)
    .map(item => item.toUpperCase() === "FDM" ? "Material não informado" : item);
  return [...new Set(materials)].join(" / ") || "Material não informado";
}

function ProjectMaterialTag({ project, projects, quotes }: { project: Project; projects: Project[]; quotes: SavedQuote[] }) {
  const { user } = useWorkspace();
  const [details, setDetails] = useState<ProjectDetails | null>(null);
  useEffect(() => {
    if (!user || (!project.quoteCount && !project.projectCount)) return;
    return watchProjectDetails(user.uid, project.id, setDetails, () => setDetails(null));
  }, [user, project.id, project.quoteCount, project.projectCount]);
  if (!details) return <span className="material-tag">{materialLabel(project.material)}</span>;
  const savedQuotes = new Map(quotes.map(quote => [quote.id, quote]));
  const materials = [
    ...details.quotes.map(snapshot => savedQuotes.get(snapshot.id)?.filament?.material ?? snapshot.filament?.material ?? (snapshot.printType === "FDM" ? "Material não informado" : snapshot.printType)),
    ...(details.components ?? []).map(component => projects.find(item => item.id === component.id)?.material ?? component.material),
  ];
  const currentMaterial = materials.length ? materialLabel(materials.join(" / ")) : materialLabel(project.material);
  return <span className="material-tag">{currentMaterial}</span>;
}

export function Projects() {
  const { data, user } = useWorkspace();
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Project | "new" | null>(null);
  useEffect(() => {
    if (!user) return;
    return watchQuotes(user.uid, 500, setQuotes, () => setQuotes([]));
  }, [user]);
  const projects = data.projects.filter(p => `${p.name} ${p.material}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  return <>
    <div className="page-title"><h1>Meus projetos</h1><button className="button primary" onClick={() => setEditor("new")}><PlusIcon />Novo projeto</button></div>
    <section className="project-section">
      <div className="section-heading"><span>{projects.length} projeto(s)</span><label className="search"><MagnifyingGlassIcon /><input aria-label="Buscar projetos" placeholder="Buscar projeto..." value={query} onChange={event => setQuery(event.target.value)} /></label></div>
      <div className="projects-grid">{projects.map((p, index) => <article key={p.id} className="project-card island">
        <button className={`project-art art-${index % 4}`} aria-label={`Editar ${p.name}`} onClick={() => setEditor(p)}>
          {p.hasImage ? <ProjectPhoto project={p} /> : <span className="project-emoji">{p.emoji}</span>}<ProjectMaterialTag project={p} projects={data.projects} quotes={quotes} />
        </button>
        <div className="project-body">
          <button className="project-name" onClick={() => setEditor(p)}>{p.name}</button>
          {p.description && <p>{p.description}</p>}
          <div className="project-budget-total"><span>Orçamento</span><strong>{money(p.total ?? 0)}</strong></div>
          <div className="project-budget-total"><span>Custo</span><strong>{money(p.cost ?? 0)}</strong></div>
          <div className="project-budget-total"><span>Lucro</span><strong>{money((p.total ?? 0) - (p.cost ?? 0))}</strong></div>
          <ProjectAllocation project={p} />
          <div className="project-meta"><span><CubeIcon />{p.grams} g</span><span><ClockIcon />{p.hours.toLocaleString("pt-BR")} h</span><button title={`Abrir ${p.name}`} aria-label={`Abrir ${p.name}`} onClick={() => setEditor(p)}><ArrowUpRightIcon /></button></div>
        </div>
      </article>)}</div>
      {!projects.length && <p className="empty">Nenhum projeto encontrado.</p>}
    </section>
    {editor && <ProjectEditor key={editor === "new" ? "new" : editor.id} project={editor === "new" ? null : editor} onClose={() => setEditor(null)} />}
  </>;
}
