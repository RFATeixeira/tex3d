export function authErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
  const messages: Record<string, string> = {
    "auth/popup-blocked": "O navegador bloqueou a janela do Google. Permita pop-ups para este site.",
    "auth/popup-closed-by-user": "A janela do Google foi fechada antes de concluir o login.",
    "auth/cancelled-popup-request": "Outra tentativa de login está em andamento.",
    "auth/unauthorized-domain": "Este endereço não está autorizado para login. Contate o administrador.",
    "auth/operation-not-allowed": "O login com Google ainda não foi habilitado pelo administrador.",
    "auth/operation-not-supported-in-this-environment": "Abra o aplicativo em localhost ou em um endereço HTTPS para entrar.",
    "auth/network-request-failed": "Não foi possível conectar ao Google. Verifique sua conexão e tente novamente.",
    "auth/user-disabled": "Sua conta foi desativada. Contate o administrador.",
    "auth/user-not-found": "Sua conta ainda não foi cadastrada pelo administrador.",
    "auth/account-exists-with-different-credential": "Sua conta usa outro método de acesso. Contate o administrador.",
    "auth/internal-error": "O login foi recusado ou o serviço está indisponível. Confirme seu acesso com o administrador.",
    "auth/too-many-requests": "Muitas tentativas de login. Aguarde um pouco e tente novamente.",
  };
  return messages[code] ?? "Não foi possível concluir o login. Tente novamente ou contate o administrador.";
}
