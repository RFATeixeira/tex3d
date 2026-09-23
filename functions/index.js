import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { beforeUserCreated, beforeUserSignedIn } from "firebase-functions/v2/identity";
import { HttpsError } from "firebase-functions/v2/https";
import { canSignIn } from "./policy.js";

initializeApp();

// Administrative creation through the console/Admin SDK bypasses this trigger.
export const blockUserCreation = beforeUserCreated(() => {
  throw new HttpsError("permission-denied", "Cadastro indisponivel. Solicite acesso ao administrador.");
});

export const authorizeSignIn = beforeUserSignedIn(async (event) => {
  const email = event.data?.email;
  if (!email || email.includes("/")) {
    throw new HttpsError("permission-denied", "Conta sem permissao de acesso.");
  }
  const permission = await getFirestore().collection("allowedUsers").doc(email).get();
  if (!canSignIn(event, permission.data())) {
    throw new HttpsError("permission-denied", "Conta sem permissao de acesso.");
  }
});
