"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CubeTransparentIcon,
  Squares2X2Icon,
  ArrowsRightLeftIcon,
  CalculatorIcon,
  CircleStackIcon,
  ArrowRightOnRectangleIcon,
  ArrowUpRightIcon,
  ArrowDownLeftIcon,
  WalletIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
  SparklesIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { useWorkspace } from "./provider";
import { money } from "@/lib/calculator";
import { watchProjectDetails } from "@/lib/project-details-store";
import { projectPersonalMaterialEnergyCost } from "@/lib/project-details";
const navigation = [
  { href: "/", label: "Meus projetos", icon: Squares2X2Icon },
  { href: "/historico", label: "Histórico", icon: ArrowsRightLeftIcon },
  { href: "/investimentos", label: "Investimentos", icon: WrenchScrewdriverIcon },
  { href: "/orcamentos", label: "Orçamento", icon: CalculatorIcon },
  { href: "/filamentos", label: "Filamentos", icon: CircleStackIcon },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const {
    data,
    user,
    loading,
    authorized,
    signingIn,
    notice,
    setNotice,
    login,
    logout,
  } = useWorkspace();
  const [legacyPersonalCosts, setLegacyPersonalCosts] = useState<Record<string, number>>({});
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!user) return;
    const legacy = data.projects.filter(project => (project.quoteCount || project.projectCount) && (project.materialCost === undefined || project.energyCost === undefined) && ((project.personalQuantity ?? 0) + (project.giftQuantity ?? 0)) > 0);
    const stops = legacy.map(project => watchProjectDetails(user.uid, project.id, details => {
      const cost = projectPersonalMaterialEnergyCost(project, data.settings, details);
      setLegacyPersonalCosts(current => ({ ...current, [project.id]: cost }));
    }, () => {}));
    return () => stops.forEach(stop => stop());
  }, [user, data.projects, data.settings]);
  useEffect(() => {
    if (loading) return;
    if (!authorized && pathname !== "/login") router.replace("/login");
    if (authorized && pathname === "/login") router.replace("/");
  }, [loading, authorized, pathname, router]);
  const expenses = data.transactions
    .filter((t) => t.type === "Compra")
    .reduce((sum, t) => sum + t.amount, 0);
  const revenue = data.transactions
    .filter((t) => t.type === "Venda")
    .reduce((sum, t) => sum + t.amount, 0);
  const personalCost = data.projects.reduce((sum, project) => sum + (project.materialCost !== undefined || project.energyCost !== undefined
    ? ((project.materialCost ?? 0) + (project.energyCost ?? 0)) * ((project.personalQuantity ?? 0) + (project.giftQuantity ?? 0))
    : legacyPersonalCosts[project.id] ?? projectPersonalMaterialEnergyCost(project, data.settings)), 0);
  const toast = notice && (
    <div className="toast" role="status">
      {notice}
      <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
        <XMarkIcon className="size-5" />
      </button>
    </div>
  );
  if (loading)
    return (
      <div className="loading">
        <CubeTransparentIcon className="size-12 animate-pulse text-cyan-300" />
        <p>Preparando seu espaço criativo...</p>
        {toast}
      </div>
    );
  if (!authorized)
    return (
      <div className="login-page">
        <div className="login-art">
          <div className="brand">
            <CubeTransparentIcon />
            <span>
              TEX<span className="text-cyan-300">3D</span>
              <small>SEU ESTÚDIO, EM ÓRBITA</small>
            </span>
          </div>
          <div>
            <div className="eyebrow">DA PRIMEIRA CAMADA À PRÓXIMA IDEIA</div>
            <h1>
              Suas ideias.
              <br />
              Uma nova
              <br />
              <em>dimensão.</em>
            </h1>
            <p>
              Um espaço para criar, organizar e transformar
              <br />
              suas impressões em grandes projetos.
            </p>
          </div>
          <div className="login-orbit">
            <CubeTransparentIcon />
          </div>
          <span className="text-sm text-slate-400">
            Feito para quem cria em 3D. ✨
          </span>
        </div>
        <div className="login-panel island">
          <span className="text-4xl">👋</span>
          <h2>Bem-vindo ao seu estúdio</h2>
          <p>
            Seus projetos, números e próximas ideias.
            <br />
            Tudo no mesmo lugar.
          </p>
          <button
            className="button primary w-full justify-center"
            onClick={login}
            disabled={signingIn}
            aria-busy={signingIn}
          >
            <span className="google-g">G</span>{signingIn ? "Aguardando Google..." : "Entrar com Google"}
          </button>
          <span className="login-note">
            Acesso exclusivo para contas autorizadas.
          </span>
        </div>
        {toast}
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar island">
        <Link href="/" className="brand">
          <CubeTransparentIcon />
          <span>
            TEX<span className="text-cyan-300">3D</span>
            <small>CREATIVE WORKSPACE</small>
          </span>
        </Link>
        <div className="nav-caption">SEU ESPAÇO</div>
        <nav>
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname === item.href ? "active" : ""}`}
            >
              <item.icon />
              <span>{item.label}</span>
              {pathname === item.href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="idea-card">
            <SparklesIcon className="size-6 text-cyan-300" />
            <p>
              Grandes ideias começam
              <br />
              com uma camada.
            </p>
            <span>Continue criando 🚀</span>
          </div>
          <div className="profile">
            <div className="avatar">
              {user?.displayName?.[0] || "T"}
            </div>
            <div>
              <strong>
                {user?.displayName?.split(" ")[0] || "Meu estúdio"}
              </strong>
              <small>Conta conectada</small>
            </div>
            <button className="icon-button" onClick={logout} aria-label="Sair">
              <ArrowRightOnRectangleIcon />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar island">
          <div className="workspace-name">
            <span className="workspace-icon">🧊</span>
            <div>
              <strong>
                TEX3D <span className="studio-tag">ESTÚDIO</span>
              </strong>
              <small>Seu universo de possibilidades</small>
            </div>
          </div>
          <div className="balances">
            {[
              {
                label: "Gasto",
                value: expenses,
                Icon: ArrowUpRightIcon,
                color: "expense",
              },
              {
                label: "Faturamento",
                value: revenue,
                Icon: ArrowDownLeftIcon,
                color: "income",
              },
              {
                label: "Saldo",
                value: revenue - expenses,
                Icon: WalletIcon,
                color: "balance",
              },
              {
                label: "Custo pessoal",
                value: personalCost,
                Icon: UserIcon,
                color: "personal",
              },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className={`balance-item ${color}`}>
                <span className="balance-icon">
                  <Icon />
                </span>
                <div>
                  <small>{label}</small>
                  <strong>{money(value)}</strong>
                </div>
              </div>
            ))}
          </div>
        </header>
        <main>
          {children}
        </main>
        <footer>
          <span>
            TEX3D <span className="text-slate-600">/</span> Feito para dar forma
            às suas ideias.
          </span>
          <span>
            <span className="status-dot" />{" "}
            Conectado ao Firebase
          </span>
        </footer>
      </div>
      {toast}
    </div>
  );
}
