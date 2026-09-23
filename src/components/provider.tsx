"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { auth, db, firebaseReady } from "@/lib/firebase";
import { authErrorMessage } from "@/lib/auth-errors";
import { defaultSettings } from "@/lib/calculator";
import type { Workspace } from "@/lib/types";
import type { ProjectDetails, ProjectDetailsChange } from "@/lib/project-details";
import { syncFilamentPurchases, linkLegacyFilamentSales } from "@/lib/filament-finance";

const empty: Workspace = { projects: [], transactions: [], settings: defaultSettings };
type Store = {
  data: Workspace;
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  authorized: boolean;
  notice: string;
  setNotice: (s: string) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  mutate: (fn: (value: Workspace) => Workspace, detailsChange?: ProjectDetailsChange) => Promise<void>;
};
const Context = createContext<Store | null>(null);

export function Provider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Workspace>(empty);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseReady);
  const [signingIn, setSigningIn] = useState(false);
  const loginPending = useRef(false);
  const [authorized, setAuthorized] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!auth || !db) return;
    let stop = () => {};
    const unsubscribe = onAuthStateChanged(auth, (current) => {
      stop();
      setUser(null);
      setAuthorized(false);
      setData(empty);
      if (!current) {
        setLoading(false);
        return;
      }
      setLoading(true);
      let active = true;
      let stopWorkspace: (() => void) | undefined;
      let stopPermission = () => {};
      let financeMigrationPending = false;
      const reject = (message: string) => {
        if (!active) return;
        stop();
        setNotice(message);
        setAuthorized(false);
        setUser(null);
        setData(empty);
        setLoading(false);
        void signOut(auth!).catch(() => {});
      };
      const timeout = setTimeout(() => reject("A verificação de acesso demorou demais. Confira sua conexão e tente novamente."), 15000);
      stop = () => {
        active = false;
        clearTimeout(timeout);
        stopPermission();
        stopWorkspace?.();
      };
      if (!current.email || !current.emailVerified) {
        reject("Sua conta precisa ter um e-mail Google verificado.");
        return;
      }
      // Wait for server confirmation; a cached permission must not unlock the app.
      stopPermission = onSnapshot(doc(db!, "allowedUsers", current.email), { includeMetadataChanges: true }, (permission) => {
        if (!active || permission.metadata.fromCache) return;
        if (!permission.exists() || permission.data().active !== true) {
          reject("Esta conta não tem permissão de acesso. Contate o administrador.");
          return;
        }
        if (stopWorkspace) return;
        stopWorkspace = onSnapshot(doc(db!, "workspaces", current.uid), { includeMetadataChanges: true }, (snapshot) => {
          if (!active || snapshot.metadata.fromCache) return;
          clearTimeout(timeout);
          const workspace = snapshot.exists() ? snapshot.data() as Workspace : empty;
          setData(workspace);
          setUser(current);
          setAuthorized(true);
          setLoading(false);
          const missingPurchases = (workspace.filaments ?? []).some(filament => !workspace.transactions.some(item => item.id === `filament:${filament.id}:purchase`));
          const legacySales = workspace.transactions.some(item => item.kind === "project-sale" && item.type === "Compra" && item.productionCost === undefined);
          if (!financeMigrationPending && (missingPurchases || legacySales)) {
            financeMigrationPending = true;
            void runTransaction(db!, async transaction => {
              const ref = doc(db!, "workspaces", current.uid);
              const latest = await transaction.get(ref);
              if (!latest.exists()) return;
              const value = latest.data() as Workspace;
              const details = new Map<string, ProjectDetails>();
              const ids = new Set(value.transactions.filter(item => item.kind === "project-sale" && item.type === "Compra" && item.productionCost === undefined).map(item => item.sourceProjectId).filter((id): id is string => Boolean(id)));
              for (const id of ids) {
                const saved = await transaction.get(doc(db!, "workspaces", current.uid, "projectDetails", id));
                if (saved.exists()) details.set(id, saved.data() as ProjectDetails);
              }
              transaction.set(ref, syncFilamentPurchases({ ...value, transactions: linkLegacyFilamentSales(value.transactions, details) }));
            }).catch(() => { if (active) setNotice("Não foi possível sincronizar os investimentos dos filamentos. Recarregue para tentar novamente."); }).finally(() => { financeMigrationPending = false; });
          }
        }, () => reject("Não foi possível acessar seus dados. Contate o administrador."));
      }, () => reject("Não foi possível verificar sua permissão de acesso. Contate o administrador."));
    });
    return () => { stop(); unsubscribe(); };
  }, []);

  const login = async () => {
    if (loginPending.current) return;
    setNotice("");
    if (!firebaseReady || !auth) {
      setNotice("O login está indisponível. Contate o administrador para configurar o Firebase.");
      return;
    }
    loginPending.current = true;
    setSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (error) {
      setNotice(authErrorMessage(error));
    } finally {
      loginPending.current = false;
      setSigningIn(false);
    }
  };
  const logout = async () => {
    try {
      if (auth) await signOut(auth);
      setAuthorized(false);
      setUser(null);
      setData(empty);
    } catch { setNotice("Não foi possível sair. Tente novamente."); }
  };
  const mutate = async (fn: (value: Workspace) => Workspace, detailsChange?: ProjectDetailsChange) => {
    try {
      if (!db || !user || !authorized) throw new Error("Sem acesso");
      const ref = doc(db, "workspaces", user.uid);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        transaction.set(ref, syncFilamentPurchases(fn(snapshot.exists() ? snapshot.data() as Workspace : empty)));
        if (detailsChange) {
          const detailsRef = doc(db!, "workspaces", user.uid, "projectDetails", detailsChange.projectId);
          if (detailsChange.details) transaction.set(detailsRef, detailsChange.details);
          else transaction.delete(detailsRef);
        }
      });
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      const message = code === "permission-denied"
        ? "O Firebase recusou a gravação. Verifique sua autorização e as regras do projeto."
        : code === "unavailable"
          ? "Não foi possível conectar ao Firebase. Verifique sua conexão e tente novamente."
          : !code && error instanceof Error ? error.message
            : "Não foi possível salvar. Seus dados não foram confirmados; tente novamente.";
      setNotice(message);
      throw new Error(message);
    }
  };
  return <Context.Provider value={{ data, user, loading, signingIn, authorized, notice, setNotice, login, logout, mutate }}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("Provider ausente");
  return context;
}
