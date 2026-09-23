# Acesso privado no Firebase

Projeto: `<FIREBASE_PROJECT_ID>`. Conta inicial: `<EMAIL_AUTORIZADO>`.

## Configuracao sem Cloud Functions

O app usa Google Authentication e Firestore no plano Spark, sujeito aos limites gratuitos do Firebase. Nao exige Blaze nem funcoes de bloqueio.

1. Habilite Google em Authentication e configure o e-mail de suporte.
2. Autorize `localhost` e o dominio HTTPS de producao. Para o login local, use `http://localhost:3000`.
3. Crie o Firestore padrao `(default)`.
4. Crie `allowedUsers/<EMAIL_AUTORIZADO>` com o campo `active` do tipo booleano igual a `true`.
5. Publique as regras com a conta administradora:

```powershell
firebase deploy --only firestore:rules --project SEU_PROJECT_ID --account SUA_CONTA_ADMINISTRADORA
```

Nao ha subcolecoes obrigatorias. O app cria `workspaces/{uid}` na primeira gravacao, com `projects`, `transactions` e `settings`.

## Fluxo de acesso

- O botao abre a janela do Google.
- Depois de autenticar, o app consulta `allowedUsers/{email}` e aguarda a confirmacao do servidor.
- Documento existente com `active: true`: carrega os dados e redireciona de `/login` para `/`.
- Documento ausente, inativo ou erro de leitura: encerra a sessao, mostra um aviso e permanece no login.
- A revogacao da permissao bloqueia novas operacoes pelas regras e encerra a sessao na interface quando o servidor notifica a alteracao.

As regras exigem Google, e-mail verificado, permissao ativa e UID correspondente ao workspace. O cliente nao pode criar ou alterar permissoes.

## Authentication e autorizacao

O Firebase pode criar automaticamente um registro em Authentication no primeiro login Google, inclusive para contas sem permissao. Isso nao concede acesso ao painel nem aos dados. Nao e necessario cadastrar a conta manualmente em Authentication; a autorizacao e cadastrada no Firestore.

A antiga variavel `NEXT_PUBLIC_FIREBASE_PRIVATE_AUTH_READY` foi removida. O codigo em `functions/` pertence a abordagem anterior, nao esta configurado para deploy e nao e usado pelo app.

Referencia: [login Google](https://firebase.google.com/docs/auth/web/google-signin).
