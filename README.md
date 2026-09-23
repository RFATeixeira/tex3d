# TEX3D 🧊

Estúdio pessoal para projetos de impressão 3D, em Next.js (App Router), TypeScript e Tailwind CSS. Interface escura com ilhas flutuantes, ciano, fonte Comfortaa local e Heroicons.

## Executar

Requer Node.js 22 ou superior.

```sh
npm install
npm run dev
```

Abra http://localhost:3000. O aplicativo é privado: visitantes são encaminhados para `/login`. Após entrar pela janela do Google e confirmar a permissão, o usuário é encaminhado ao painel `/`. Não há acesso de demonstração.

Neste ambiente Windows, também há o atalho `powershell -ExecutionPolicy Bypass -File .\Start-Tex3D.ps1`. Ele usa o Node instalado no sistema ou o runtime local em `.tools`, quando disponível. Essa pasta é ignorada pelo Git.

## Conectar o Firebase

1. Crie um projeto no Firebase Console e registre um app Web.
2. Copie `.env.example` para `.env.local` e preencha os seis valores da configuração Web fornecida pelo Firebase.
3. Em Authentication → Sign-in method, habilite **Google** e configure o e-mail de suporte.
4. Em Authentication → Settings → Authorized domains, adicione `localhost` e o domínio de produção.
5. Crie um banco **Cloud Firestore**, no banco padrão `(default)`. Publique o conteúdo de `firestore.rules` na aba Rules. Não use regras abertas de modo teste.
6. No Firestore, crie a coleção `allowedUsers`. Adicione um documento com ID igual ao e-mail exato da conta Google autorizada, por exemplo `voce@gmail.com`, e campo `active` do tipo boolean com valor `true`. Só o administrador, pelo Console/Admin SDK, pode alterar essa lista.
7. Siga [a configuração de autenticação privada](docs/firebase-private-auth.md) para publicar as regras e autorizar as contas no Firestore.
8. Reinicie o servidor depois de preencher `.env.local` (em produção, gere um novo build).

O acesso usa Google Authentication e Firestore, sem Cloud Functions ou plano Blaze. O Google pode criar um registro no Authentication, mas o painel só abre após confirmar `allowedUsers/{email}.active == true` no servidor. Sem permissão, o app encerra a sessão e permanece no login. As regras publicadas impedem o acesso aos dados por contas não autorizadas. Não é necessário cadastrar contas manualmente no Authentication.

Cada conta autorizada tem seu próprio documento `workspaces/{uid}`. Remover a autorização ou definir `active: false` bloqueia novas operações no banco; a interface encerra a sessão ao receber a atualização do servidor. O projeto usa transações para evitar sobrescrever atualizações concorrentes. Projetos e lançamentos ficam em listas nesse documento, adequadas a um estúdio pessoal: limite de 500 projetos, 2.000 lançamentos e o limite de 1 MiB por documento do Firestore. Para volumes maiores, migre as listas para subcoleções com paginação.

Referências: [login Google](https://firebase.google.com/docs/auth/web/google-signin), [regras do Firestore](https://firebase.google.com/docs/firestore/security/get-started), [instalação do Next.js](https://nextjs.org/docs/app/getting-started/installation).

## Funcionalidades

- Projetos: criar, editar, excluir e pesquisar; material, emoji, peso e tempo estimados, sem abas de status ou banner promocional.
- Projetos podem reunir até 100 orçamentos salvos, somando peso, tempo, custo e valor conforme a quantidade de peças. A foto própria e cópias dos dados dos orçamentos ficam em `workspaces/{uid}/projectDetails/{projectId}` e são gravadas na mesma transação do projeto. Excluir o orçamento original não altera os dados já incorporados ao projeto.
- Vendas: os contadores + e - representam projetos completos. Uma unidade inclui todas as peças e quantidades dos orçamentos selecionados; vender duas multiplica o valor e o custo do conjunto por dois. Pessoal e Presente têm contadores separados e não geram faturamento. Ajustar as contagens atualiza os lançamentos sem duplicá-los; zerar as vendas remove seus lançamentos automáticos. Projetos sem orçamentos usam valor/custo manuais. Excluir o projeto preserva o histórico. Vendas avulsas antigas são preservadas até a conversão explícita para projetos completos.
- Investimentos: aba própria para compras de impressoras, cola, ferramentas e outros materiais. Cada rolo cadastrado gera automaticamente uma compra de investimento vinculada ao seu ID, inclusive rolos existentes ao abrir o app. Editar o preço do rolo atualiza a mesma compra; excluir ou zerar o rolo preserva o histórico. Compras vinculadas são alteradas pela aba Filamentos. Compras manuais antigas sem vínculo não são conciliadas por nome.
- Header: nome TEX3D e totais de Gasto, Faturamento e Saldo, calculados de todos os lançamentos.
- Histórico: compras e vendas editáveis, vínculo opcional com projeto, filtros por tipo/mês/texto e exportação CSV dos resultados filtrados.
- Calculadora FDM: filamento, energia, uso da máquina, trabalho manual, custos extras, quantidade, falhas e margem; configurações salvas por conta; cópia de orçamento.
- Filamentos na sidebar (`/filamentos`): página própria para cadastro individual de até 500 rolos por conta, com marca, tipo, cor, preço pago, peso original e estado zerado. Rolos disponíveis podem fornecer preço e peso ao orçamento. Cadastros iguais permanecem separados; calcular não desconta estoque automaticamente.
- Retorno por filamento: faturamento das vendas vinculadas ao ID do rolo e retorno líquido = faturamento menos os demais custos das impressões vendidas menos o preço integral do rolo. O material (incluindo sua reserva de falhas) já pago na compra não é cobrado novamente nos gastos do cabeçalho. O lucro estimado do projeto continua considerando seu custo completo. Vendas antigas recebem o vínculo quando a cópia do orçamento no projeto ainda identifica o filamento; registros sem essa informação não são atribuídos por nome.
- Orçamentos salvos: nome da peça, tipo de impressão, imagem JPEG em string Base64, peso, tempo, quantidade, configurações e detalhamento dos custos registrados no momento do cálculo. Ficam em `workspaces/{uid}/quotes/{id}`, com consulta e exclusão na calculadora. Imagens JPG/PNG/WebP de até 10 MB são reduzidas no navegador para no máximo 250.000 caracteres. Não usa Firebase Storage nem cria lançamentos financeiros.
- Login Google, lista de autorização e regras com isolamento por usuário.
- Layout responsivo, modais nativos com foco contido, campos rotulados e respeito à preferência por movimento reduzido.

O custo de produção é `(filamento + energia + máquina) / (1 − taxa de falhas)`. Mão de obra e extras são somados depois. O preço de venda é `custo / (1 − margem)`; portanto, margem não é markup. Todos os dados da impressão são por peça, e o total multiplica o preço pela quantidade. Os cálculos mantêm precisão até a formatação em reais. A calculadora estima custos FDM; não modela lavagem/cura ou volume de resina. Criar projeto ou copiar orçamento não gera lançamentos financeiros automaticamente.

## Estrutura

```text
src/app/                  Rotas, layout e estilo global
src/components/ui.tsx     Campos, modal, títulos e estados vazios
src/components/shell.tsx  Navegação, header, login e notificações
src/components/provider.tsx Sessão, demo e persistência Firebase
src/components/projects.tsx Formulário e painel de projetos
src/components/history.tsx  Histórico e formulário financeiro
src/components/calculator.tsx Calculadora e preferências
src/lib/                  Tipos, Firebase, cálculos e exemplos
tests/                    Testes das fórmulas e validação
firestore.rules           Regras de acesso
```

## Verificar e publicar

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Para hospedar, importe este projeto em um serviço que suporte Next.js, configure as variáveis de `.env.example` antes do build e autorize o domínio no Firebase. As variáveis `NEXT_PUBLIC_FIREBASE_*` identificam o app cliente; a proteção dos dados é feita pelas regras. Não coloque credenciais Admin SDK no frontend. As regras precisam ser publicadas separadamente pelo Firebase Console ou por `firebase deploy --only firestore:rules --project SEU_PROJECT_ID` com Firebase CLI autenticado.
