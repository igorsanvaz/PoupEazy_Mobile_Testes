# PoupEazy Mobile - Gestão Financeira Pessoal

![CI](https://github.com/Wesley-GLR/PoupEazy_Mobile/actions/workflows/ci.yml/badge.svg)

Aplicativo móvel de gerenciamento financeiro pessoal desenvolvido como continuação do projeto
acadêmico da disciplina de **Análise e Desenvolvimento de Software IV** da
**UNIFEI - Campus Itabira**.

O PoupEazy Mobile adapta para Android as principais funcionalidades do sistema web, mantendo sua
identidade visual e reorganizando a navegação para uma experiência nativa. O aplicativo permite
acompanhar receitas e despesas, planejar orçamentos mensais, criar metas financeiras e importar
movimentações por Open Finance.

---

## Funcionalidades

- **Autenticação** — Cadastro, login e restauração segura da sessão com JWT armazenado no aparelho
- **Painel (Dashboard)** — Resumo mensal de receitas, despesas, saldo, orçamento, transações recentes e despesas por categoria
- **Transações** — CRUD completo de receitas e despesas, filtros por período e tipo e associação automática ao orçamento mensal
- **Categorias** — Consulta às categorias do sistema e gerenciamento das categorias personalizadas do usuário
- **Metas Financeiras** — Criação e edição de metas, acompanhamento do progresso e registro de entradas ou retiradas
- **Orçamentos Mensais** — Planejamento do limite de gastos e comparação entre o valor planejado e o valor realizado
- **Perfil** — Atualização de dados pessoais, alteração de senha e encerramento da sessão
- **Open Finance** — Conexão com instituições via Pluggy, sincronização pelo backend e deduplicação das transações importadas
- **Experiência mobile** — Cinco abas principais, formulários em modais, atualização por gesto e estados de carregamento, erro e conteúdo vazio
- **Conectividade** — Cache com React Query, detecção de rede e tratamento padronizado de falhas da API

---

## Tecnologias

| Camada | Tecnologia |
|--------|------------|
| Aplicativo | React Native 0.86 + React 19 |
| Framework | Expo SDK 57 |
| Linguagem | TypeScript |
| Navegação | Expo Router |
| Dados e cache | TanStack React Query |
| Formulários e validação | React Hook Form + Zod |
| Sessão local | Expo SecureStore |
| Gráficos | React Native SVG |
| Open Finance | Pluggy Connect |
| Backend | Node.js + Express + JWT |
| Banco de dados | PostgreSQL (Neon) |
| Hospedagem da API | Render |

---

## Ecossistema do projeto

| Projeto | Plataforma | Endereço |
|---------|------------|----------|
| Aplicação web | Vercel | [poup-eazy.vercel.app](https://poup-eazy.vercel.app) |
| API | Render | [poupeazy-backend.onrender.com](https://poupeazy-backend.onrender.com) |
| Banco de dados | Neon (PostgreSQL) | Acesso interno |
| Código do frontend web | GitHub | [Wesley-GLR/PoupEazy](https://github.com/Wesley-GLR/PoupEazy) |
| Código do backend | GitHub | [Wesley-GLR/PoupEazy_BackEnd](https://github.com/Wesley-GLR/PoupEazy_BackEnd) |
| Código do aplicativo | GitHub | [Wesley-GLR/PoupEazy_Mobile](https://github.com/Wesley-GLR/PoupEazy_Mobile) |

O aplicativo ainda não está publicado na Play Store. A configuração EAS, a geração do AAB e a
publicação serão realizadas depois da aprovação dos testes locais.

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) 20 ou superior
- npm
- Expo Go compatível com o SDK 57 ou um emulador Android
- Acesso à internet para consumir a API publicada
- Docker Desktop apenas se houver necessidade de usar o backend local

---

## Como executar

### 1. Clonar o repositório

```bash
git clone https://github.com/Wesley-GLR/PoupEazy_Mobile.git
cd PoupEazy_Mobile
```

### 2. Instalar as dependências

```bash
npm install
```

O script `postinstall` reaplica automaticamente a compatibilidade mantida em `patches/` para a
biblioteca de conexão da Pluggy.

### 3. Iniciar o Expo

```bash
npx expo start
```

Depois do carregamento:

- leia o QR Code com o Expo Go em um aparelho Android; ou
- pressione `a` no terminal para abrir o emulador Android.

O aplicativo usa por padrão a API publicada em:

```text
https://poupeazy-backend.onrender.com/api
```

Não é necessário criar um arquivo `.env` para utilizar o ambiente publicado.

> O plano gratuito do Render pode hibernar após um período sem uso. Por isso, a primeira operação
> do aplicativo pode levar alguns segundos a mais enquanto o serviço é iniciado.

### Usar o backend local, se necessário

Copie `.env.example` para `.env` e altere `EXPO_PUBLIC_API_URL` conforme o ambiente:

```env
# Emulador Android
EXPO_PUBLIC_API_URL=http://10.0.2.2:3001/api

# Aparelho físico na mesma rede do computador
EXPO_PUBLIC_API_URL=http://192.168.0.10:3001/api

# Navegador local
EXPO_PUBLIC_API_URL=http://localhost:3001/api
```

Após alterar uma variável de ambiente, reinicie o Expo limpando o cache:

```bash
npx expo start --clear
```

Variáveis com o prefixo `EXPO_PUBLIC_` fazem parte do bundle do aplicativo. Portanto, esse espaço
deve conter apenas configurações públicas, nunca senhas, tokens privados ou credenciais da Pluggy.

### Correção do `URL.canParse` no Metro

O `metro.config.js` precisa existir por causa de um conflito interno do Expo SDK 57. A renderização
web do Expo Router acontece no mesmo processo Node do Metro e executa o `setupURLPolyfill` do React
Native, que substitui o `URL` global por uma implementação mínima sem o método estático `canParse`.

Como o Metro usa `URL.canParse` para interpretar as requisições de bundle, qualquer acesso à rota web
fazia o servidor passar a responder `500` para **todas** as plataformas, inclusive Android:

```text
TypeError: URL.canParse is not a function
    at parseBundleOptionsFromBundleRequestUrl (node_modules/metro/src/lib/...)
```

A proteção tem duas camadas e nenhuma delas deve ser removida enquanto o Expo não corrigir o conflito
na origem:

1. `metro.config.js` restaura a implementação do Node antes de cada requisição do bundler.
2. `web.output` usa `single` em vez de `static`, o que dispensa a renderização no servidor. A
   interface web do PoupEazy é mantida em um repositório próprio, então o Expo Router aqui só precisa
   servir o aplicativo.

---

## API em produção

O endereço público pode ser conferido pelo healthcheck:

```text
GET https://poupeazy-backend.onrender.com/api/health
```

As demais rotas são consumidas pelo cliente HTTP central do aplicativo. Depois da autenticação,
o JWT é lido do SecureStore e enviado no cabeçalho `Authorization`. Respostas `401` removem a
sessão local e os dados protegidos mantidos em cache.

O endereço da API pode ser substituído sem alterar o código:

```env
EXPO_PUBLIC_API_URL=https://outro-endereco.example.com/api
```

---

## Fluxo técnico da aplicação

1. O Expo Router inicia o aplicativo e decide entre as rotas públicas e autenticadas.
2. O `AuthProvider` recupera o JWT do SecureStore e valida a sessão na API.
3. O cliente HTTP central adiciona os cabeçalhos, controla o tempo-limite e normaliza os erros.
4. Os hooks do React Query consultam e atualizam transações, categorias, metas, orçamentos e integrações.
5. O backend filtra os registros por `id_usuario`, impedindo acesso a dados de outro usuário.
6. O PostgreSQL mantém valores derivados por meio de constraints, índices, views e triggers.

### Como navegar pelo código

- Comece por `src/app/_layout.tsx` para entender os providers e o roteamento principal.
- Leia `src/app/(tabs)/_layout.tsx` para conhecer a navegação autenticada.
- Consulte `src/auth` para entender a sessão e o armazenamento seguro.
- Veja `src/api/config.ts`, `src/api/client.ts`, `src/api/services.ts` e `src/api/hooks.ts` para acompanhar a comunicação com o backend.
- Explore `src/features` para encontrar as telas separadas por domínio.
- Use `src/types/api.ts` como referência dos contratos entre o aplicativo e a API.

---

## Estrutura do projeto

```text
PoupEazy_Mobile/
├── .github/workflows/      # CI: lint, tipos e testes Jest a cada push/PR
├── __tests__/              # Testes unitários e de integração (Jest)
├── e2e/                    # Fluxos Maestro (E2E) e instruções de execução
├── assets/
│   ├── brand/              # Logotipos do PoupEazy
│   ├── fonts/              # Fontes usadas pelo design system
│   └── images/             # Ícones e imagens do aplicativo
├── patches/                # Compatibilidades reaplicadas após npm install
├── scripts/                # Utilitários de manutenção do projeto
├── src/
│   ├── app/                # Rotas, abas e modais do Expo Router
│   ├── api/                # Configuração, cliente HTTP, serviços e hooks
│   ├── auth/               # Contexto de autenticação e SecureStore
│   ├── components/         # Componentes visuais reutilizáveis
│   ├── features/           # Telas organizadas por domínio
│   ├── providers/          # Providers globais e React Query
│   ├── state/              # Estado do período financeiro selecionado
│   ├── theme/              # Cores, tipografia, espaços, raios e sombras
│   ├── types/              # Contratos TypeScript da API
│   └── utils/              # Formatação de moeda, datas e mensagens
├── .env.example
├── .gitignore
├── app.json
├── eas.json               # Perfis de build e distribuição do Expo Application Services
├── eslint.config.js
├── metro.config.js        # Configuração do bundler e correção do URL global do Metro
├── LICENSE
├── migration-progress.md
├── package-lock.json
├── package.json
├── README.md
└── tsconfig.json
```

---

## Open Finance

O aplicativo solicita um Connect Token ao backend e abre o widget da Pluggy. Depois da conexão:

1. o backend confirma que o item bancário pertence ao usuário autenticado;
2. identificadores e tokens privados permanecem somente no servidor;
3. todas as contas e páginas de transações disponíveis são consultadas;
4. cada transação é associada ao orçamento correspondente à sua própria data;
5. categorias compatíveis são escolhidas e registros duplicados são ignorados;
6. a importação inteira é confirmada ou revertida como uma única operação.

O widget da Pluggy declara a própria área segura com `flex: 1`, então ele é aberto em um modal de tela
cheia e não compartilha o espaço com a lista de conexões.

O modal pode ser conferido no Expo Go. O retorno por aplicativo bancário ou OAuth externo exige um
development build Android e será validado antes da fase de publicação.

---

## Requisitos implementados

| Código | Descrição | Situação no aplicativo móvel |
|--------|-----------|-------------------------------|
| RF01 | Gerenciar usuários | Implementado |
| RF02 | ChatBot WhatsApp | Estrutura compatível no backend; fora desta etapa mobile |
| RF03 | Metas e gastos | Implementado |
| RF04 | Integração Open Finance | Implementado com Pluggy |
| RF05 | Categorização automática | Parcial, aplicada às importações bancárias |
| RF06 | Relatórios financeiros | Implementado no dashboard mensal |
| RF07 | Notificações e alertas | Estrutura disponível no backend; tela mobile adiada |
| RF08 | Orçamentos mensais | Implementado |
| RNF01 | Interface intuitiva | Implementado com navegação e layout próprios para mobile |
| RNF02 | Proteção de dados | Implementado com JWT, SecureStore e autorização por usuário |

---

## Qualidade e verificações

O plano de testes (`Plano_de_Testes_PoupEazy.pdf`) está implementado por completo:

| Tipo | Arquivo | Cobre |
|------|---------|-------|
| Unitário | `__tests__/services-budgets-goals.test.ts` | Serviços de orçamentos e metas (5.1) |
| Unitário | `__tests__/token-storage.test.ts` | Token de sessão no SecureStore e na web (5.2) |
| Unitário | `__tests__/format-edge-cases.test.ts` | Casos-limite de moeda e datas (5.3) |
| Unitário | `__tests__/services-integrations.test.ts` | Serviços de Open Finance/Pluggy e `queryString` (5.4) |
| Integração | `__tests__/auth-context.test.tsx` | Contexto de autenticação (6.1) |
| Integração | `__tests__/hooks-transactions.test.tsx` | Hooks de React Query e invalidação de cache (6.2) |
| Integração | `__tests__/transaction-form.test.tsx` | Formulário de transação com Zod (6.3) |
| Integração | `__tests__/budget-goal-form.test.tsx` | Formulários de orçamento, meta e movimentação (6.4) |
| E2E | `e2e/auth.yaml` | Autenticação (7.1) |
| E2E | `e2e/transacoes.yaml` | Ciclo de vida da transação (7.2) |
| E2E | `e2e/orcamentos-categorias.yaml` | Orçamentos e categorias (7.3) |
| E2E | `e2e/metas-open-finance.yaml` | Metas e Open Finance (7.4) |

```bash
npm test                    # unitários + integração (Jest)
npm run test:coverage       # idem, com relatório em coverage/
npm run test:e2e            # todos os fluxos Maestro (exige emulador e API de teste)
npm run test:e2e:transacoes # ou um fluxo por vez: :auth, :transacoes, :orcamentos, :metas
```

Os fluxos E2E exigem preparação do Android e da API. Consulte [o guia do E2E](e2e/README.md)
antes de executar. Os fluxos de autenticação, transações e orçamentos/categorias passaram no
emulador Android; o de metas passou até a etapa de Open Finance, que exige credenciais sandbox da
Pluggy na API de teste. O `npm test` executa somente os testes Jest, sem iniciar o E2E.

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda lint, `tsc` e a suíte
Jest com cobertura a cada push e pull request para a `main`.

```bash
npx tsc --noEmit
npm run lint
npm test
npx expo-doctor
npx expo export --platform android --output-dir dist-qa
```

A validação local da versão atual concluiu:

- 141 testes automatizados em 12 suítes Jest (unitários e de integração);
- 21 verificações do Expo Doctor;
- exportação do bundle Android;
- fluxos principais no Expo Go e emulador Android;
- integração com o backend local e acesso à API publicada no Render.

O `npm audit --audit-level=high` não identifica vulnerabilidades altas ou críticas. O alerta alto do
`js-yaml` é resolvido pelo bloco `overrides` do `package.json`, que fixa versões corrigidas dentro da
mesma versão maior para as ferramentas de build e de teste.

Permanecem 14 alertas moderados transitivos na cadeia de ferramentas do Expo. Eles não são
corrigíveis sem quebrar o aplicativo e foram avaliados individualmente:

| Pacote | Origem | Por que não é corrigido |
|--------|--------|--------------------------|
| `uuid` | `@expo/config-plugins` → `xcode` | O alerta afeta apenas `v3/v5/v6` recebendo `buf`. O `xcode` só chama `uuid.v4()`, então a falha não é alcançável |
| `decode-uri-component` | `expo-router` → `query-string` | A única versão corrigida (`0.5.0`) é ESM puro e o `query-string@7` a consome por `require()`, o que quebraria o roteamento |
| `@expo/*` | Dependências internas do Expo | Reexportam os dois itens acima; o reparo forçado do npm faria downgrade para o Expo 46 |

O reparo forçado sugerido pelo npm (`npm audit fix --force`) faria downgrade para uma versão
incompatível do Expo e não deve ser aplicado.

---

## Limitações e próximas etapas

- O fluxo de recuperação usa token local nesta etapa e ainda não envia e-mail.
- O retorno OAuth por aplicativo bancário será validado em um development build.
- EAS, assinatura, geração do AAB e publicação na Play Store ainda serão configurados.
- A tela de notificações e o ChatBot WhatsApp permanecem fora desta versão mobile.
- A versão atual foi validada prioritariamente no Android.

---

## Equipe

| Nome | Função |
|------|--------|
| Brendow Scarabelli Silveira | Desenvolvedor |
| Heitor Martins Colombino | Desenvolvedor |
| Matheus Idjarurir Santos Miranda | Desenvolvedor |
| Pedro Mello Morais | Desenvolvedor |
| Matheus de Oliveira Barbosa | Desenvolvedor |
| Wesley Gabriel Lima Rabelo | Desenvolvedor |
| Vitor Hugo Peluchi Nascimento | Desenvolvedor |
| Kleber Augusto Barbosa | Desenvolvedor |

**Instituição:** UNIFEI - Universidade Federal de Itajubá, Campus Itabira

---

## Licença

Projeto acadêmico. Todos os direitos reservados aos autores.
