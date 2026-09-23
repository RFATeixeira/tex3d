import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import type { ProjectDetails } from "./project-details";

export function watchProjectDetails(uid: string, projectId: string, next: (details: ProjectDetails) => void, error: () => void) {
  if (!db) { error(); return () => {}; }
  return onSnapshot(doc(db, "workspaces", uid, "projectDetails", projectId), { includeMetadataChanges: true }, snapshot => {
    if (snapshot.metadata.fromCache) return;
    next(snapshot.exists() ? snapshot.data() as ProjectDetails : { image: "", quotes: [] });
  }, error);
}
