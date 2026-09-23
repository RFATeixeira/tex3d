import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { SavedQuote } from "./quotes";

function quotesCollection(uid: string) {
  if (!db || !uid) throw new Error("Entre novamente para acessar os orçamentos.");
  return collection(db, "workspaces", uid, "quotes");
}

export async function saveQuote(uid: string, quote: SavedQuote) {
  await setDoc(doc(quotesCollection(uid), quote.id), quote);
}

export async function removeQuote(uid: string, id: string) {
  await deleteDoc(doc(quotesCollection(uid), id));
}

export function watchQuotes(uid: string, count: number, next: (quotes: SavedQuote[]) => void, error: () => void) {
  return onSnapshot(query(quotesCollection(uid), orderBy("createdAt", "desc"), limit(count)),
    snapshot => next(snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as SavedQuote)), error);
}
