# Testes E2E (Maestro)

Fluxos de ponta a ponta do `Plano_de_Testes_PoupEazy.pdf`, seção 7:

| Plano | Fluxo | Comando |
| --- | --- | --- |
| 7.1 — Autenticação | `e2e/auth.yaml` | `npm run test:e2e:auth` |
| 7.2 — Ciclo de vida da transação | `e2e/transacoes.yaml` | `npm run test:e2e:transacoes` |
| 7.3 — Orçamentos e categorias | `e2e/orcamentos-categorias.yaml` | `npm run test:e2e:orcamentos` |
| 7.4 — Metas e Open Finance | `e2e/metas-open-finance.yaml` | `npm run test:e2e:metas` |
| Todos os fluxos acima | `e2e/` | `npm run test:e2e` |

**Última execução (15/10/2026, emulador Pixel 7 / Android 16, Maestro 2.11, API e PostgreSQL
locais de teste):**

| Fluxo | Resultado |
| --- | --- |
| `auth.yaml` | ✅ passou |
| `transacoes.yaml` | ✅ passou |
| `orcamentos-categorias.yaml` | ✅ passou |
| `metas-open-finance.yaml` | ⚠️ parte de metas passou; Open Finance parou em "Integracao Pluggy nao configurada." porque a API de teste não tinha credenciais sandbox da Pluggy |

A preparação de ambiente (API, banco, build Android e Maestro) é a mesma para todos e está
descrita abaixo. A integração da seção 6.1 é executada com `npm run test:auth`.

### Ajustes de ambiente que foram necessários

- **JDK 17 para compilar.** O Java que vem com o Android Studio recente (JDK 25) faz o
  `npx expo run:android` falhar em `configureCMakeDebug` com "A restricted method in
  java.lang.System has been called". Compile com `JAVA_HOME` apontando para um JDK 17.
- **Desligar a escrita com stylus no emulador.** No Android 16 o Gboard trata os toques do
  Maestro como caneta, abre o tutorial "Try out your stylus" e a digitação trava:
  `adb shell settings put secure stylus_handwriting_enabled 0`.
- **Animações desligadas e RAM do emulador.** Desative as três escalas de animação nas Opções do
  desenvolvedor e use pelo menos 4 GB de RAM no AVD.
- **Splash presa.** Em alguns lançamentos a animação de saída da splash fica presa e cada ação do
  Maestro espera ~10 s. Os fluxos já contornam isso com `subflows/destravar-splash.yaml`, usado
  logo depois de cada `launchApp`.

## Integração

Na raiz de `PoupEazy_Mobile`:

```powershell
npm install
npm run test:auth
```

A suíte exercita o contexto e seus consumidores, com dependências externas controladas. Não precisa de Android nem de banco de dados. O resultado esperado é uma suíte aprovada com 7 casos.

Validação desta entrega: os 7 casos de autenticação passaram; `npm test` passou com 44 testes
em 5 suítes. TypeScript (`npx tsc --noEmit`) e lint (`npm run lint`) também passaram.

## Pré-requisitos do E2E

- Node/npm e o repositório `PoupEazy_BackEnd` ao lado deste projeto.
- PostgreSQL local e um banco **exclusivo de testes**, vazio na primeira preparação.
- Android SDK, `adb` no `PATH` e JDK compatível com o build Android desta versão do Expo. Siga a [configuração oficial do ambiente Expo](https://docs.expo.dev/get-started/set-up-your-environment/).
- Emulador iniciado ou aparelho Android conectado por USB com depuração autorizada. `adb devices` deve mostrar o dispositivo como `device`. Para simplificar, mantenha somente um dispositivo conectado.
- Maestro CLI no `PATH`. Siga a [instalação oficial do Maestro para Windows](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli) e confira `maestro --help`. O Maestro requer Java 17 ou superior; isso não substitui o requisito de compatibilidade do build Expo.

Use o aplicativo Android instalado com o pacote `com.wesleyglr.poupeazy`, em build **debug** (`__DEV__` habilitado). O fluxo não é direcionado ao Expo Go.

## 1. API e banco local — terminal 1

No computador desta entrega, os executáveis do PostgreSQL estão em `C:\Program Files\PostgreSQL\18\bin`. Ajuste esse caminho e a porta se sua instalação for diferente.

Crie o banco uma única vez. Informe um usuário PostgreSQL local com permissão para criar bancos; `createdb -W` solicita a senha sem colocá-la no comando:

```powershell
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$dbUser = Read-Host 'Usuario do PostgreSQL local'
& "$pgBin\createdb.exe" -h 127.0.0.1 -p 5432 -U $dbUser -W poupeazy_auth_e2e
```

Prossiga apenas se a criação terminar com sucesso. Se já existe um banco `poupeazy_auth_e2e`, reutilize-o somente se ele for exclusivo destes testes. Não execute `db/reset.sql` nem apague bancos usados pelo projeto.

No mesmo terminal, configure explicitamente a conexão local antes de inicializar o schema. Informe novamente a senha desse usuário; ela será codificada para uso na URI, sem impressão no terminal:

```powershell
Set-Location 'C:\Users\idjar\Documents\GitHub\PoupEazy_BackEnd'
$dbPassword = Read-Host 'Senha do PostgreSQL local' -AsSecureString
$dbCredential = [System.Management.Automation.PSCredential]::new($dbUser, $dbPassword)
$dbUserEncoded = [Uri]::EscapeDataString($dbUser)
$dbPasswordEncoded = [Uri]::EscapeDataString($dbCredential.GetNetworkCredential().Password)
$env:DATABASE_URL = "postgresql://${dbUserEncoded}:${dbPasswordEncoded}@127.0.0.1:5432/poupeazy_auth_e2e"
$env:JWT_SECRET = 'somente-testes-locais-poupeazy-auth-e2e-2026'
$env:NODE_ENV = 'test'
$env:DATABASE_SSL = 'disable'
$env:PORT = '3002'
npm install
npm run db:init
```

Se o schema for aplicado com sucesso, inicie a API e mantenha este terminal aberto:

```powershell
npm start
```

`db:init` aplica `db/schema.sql`, que já contém as tabelas e migrações necessárias para um banco novo. As variáveis acima sobrepõem os valores carregados de `.env`. Não use a API publicada no Render nem credenciais de produção neste roteiro.

`NODE_ENV=test` permite que `/auth/forgot-password` devolva o `resetToken` e desativa o limite de requisições nos testes. A recuperação exercitada aqui usa esse token local; o envio de e-mail ainda não faz parte do fluxo implementado. Credenciais da Pluggy não são necessárias.

## 2. Instalar o app e manter o Metro — terminal 2

Configure `EXPO_PUBLIC_API_URL` **antes** do build/início do Metro. Para o emulador Android padrão:

```powershell
Set-Location 'C:\Users\idjar\Documents\GitHub\PoupEazy_Mobile'
npm install
adb devices
$env:EXPO_PUBLIC_API_URL = 'http://10.0.2.2:3002/api'
npx expo run:android
```

Para aparelho físico via USB, use estas duas linhas **no lugar** da configuração de URL acima, antes de `npx expo run:android`:

```powershell
adb reverse tcp:3002 tcp:3002
$env:EXPO_PUBLIC_API_URL = 'http://127.0.0.1:3002/api'
```

Deixe a API e o Metro rodando durante o teste. Se o Metro já estava aberto com outra URL, encerre-o e reinicie-o no terminal com a variável correta usando `npx expo start --clear`. Não use build release: a tela de recuperação só continua automaticamente com o token quando `__DEV__` está habilitado.

Abra o app uma vez e confira a tela de login. No primeiro início, pode ser necessário fechar manualmente uma apresentação/menu de desenvolvimento do Expo antes de executar o fluxo. O teste deve operar as telas do PoupEazy.

## 3. Executar — terminal 3

```powershell
Set-Location 'C:\Users\idjar\Documents\GitHub\PoupEazy_Mobile'
Invoke-RestMethod 'http://127.0.0.1:3002/api/health'
adb devices
npm run test:e2e:auth
```

O healthcheck deve retornar `status: ok`. O comando npm executa:

```powershell
maestro test --test-output-dir .tmp/maestro e2e/auth.yaml
```

O fluxo verifica, em sequência:

1. Abertura sem sessão e rejeição de credenciais inválidas.
2. Cadastro, retorno ao login e acesso ao painel com a conta criada.
3. Sessão preservada ao fechar/reabrir o app; depois do logout, reabertura permanece na tela de login.
4. Solicitação de recuperação, redefinição por token local, rejeição da senha antiga e aceitação da nova.
5. Logout final.

Não há API simulada no E2E. Cada execução cria uma conta `Usuario E2E` com e-mail `e2e.auth.<timestamp>.<aleatorio>@example.com`. As senhas sintéticas são `E2eInicial123!` e, após redefinição, `E2eAtualizada456!`; não reutilize essas senhas fora do banco de testes.

O `clearState` inicial apaga os dados locais **somente do app alvo** no dispositivo; use uma instalação de testes, sem uma sessão pessoal que queira preservar. As contas criadas permanecem no banco, pois a API não oferece exclusão de usuário. Use um banco descartável dedicado e não limpe dados de outros usuários.

O resultado só será aprovado após o Maestro concluir o fluxo sem falhas. Consulte os artefatos gerados em `.tmp/maestro` e registre a data, dispositivo e resultado da execução. Em caso de falha no primeiro acesso, confira primeiro API, URL embutida no app, conectividade e eventuais telas de desenvolvimento.

## Fluxos 7.2 a 7.4

Cada fluxo é independente: começa com o subfluxo `subflows/nova-sessao.yaml`, que limpa o app,
cadastra um usuário exclusivo `e2e.fluxo.<timestamp>.<aleatorio>@example.com` e entra no painel.
As categorias de que o fluxo precisa são criadas pela própria UI com `subflows/criar-categoria.yaml`,
então os testes não dependem dos nomes das categorias do sistema no banco.

- **`transacoes.yaml` (7.2):** cria a despesa "Compra E2E" (R$ 123,45), confere lista, painel e
  orçamento, edita para "Compra E2E editada" (R$ 200,00), exclui com toque longo e confirma que os
  totais voltaram a zero.
- **`orcamentos-categorias.yaml` (7.3):** cria uma categoria e confere que ela aparece no seletor de
  transações, navega entre meses, cria um orçamento de R$ 1.000, lança despesas até 85% e depois
  115% (com aviso de excesso), ajusta o orçamento para R$ 2.000 (57%), renomeia a categoria,
  exclui uma categoria sem uso e confere que as categorias do sistema não têm botões de editar ou
  excluir.
- **`metas-open-finance.yaml` (7.4):** cria a meta "Viagem E2E" (R$ 1.000, prazo em 31/12 do ano
  seguinte), faz um aporte de R$ 250 e uma retirada de R$ 50 conferindo o progresso, conecta o
  conector sandbox da Pluggy, sincroniza, confere as transações importadas e desconecta.

### Requisitos extras do fluxo 7.4 (Open Finance)

- A API de teste precisa estar configurada com credenciais **sandbox** da Pluggy. Sem elas,
  `GET /pluggy/token` falha e o fluxo para em "Conectar instituição". Nunca use credenciais de
  produção.
- O widget só lista conectores sandbox em build debug (`includeSandbox={__DEV__}`).
- O conector e as credenciais de teste vêm do bloco `env` do YAML (`Pluggy Bank`, `user-ok`,
  `password-ok`). Para trocar, passe `-e`:

```powershell
maestro test -e PLUGGY_CONNECTOR="Pluggy Bank" -e PLUGGY_USER=user-ok -e PLUGGY_PASSWORD=password-ok --test-output-dir .tmp/maestro e2e/metas-open-finance.yaml
```

- O widget da Pluggy é uma WebView de terceiros. Seus seletores usam expressões regulares
  tolerantes, mas podem precisar de ajuste se a Pluggy mudar os textos da interface. Rode o trecho
  uma vez no Maestro Studio para conferir. A partir do Maestro 2.11 ele é um aplicativo
  separado (https://studio.maestro.dev/MaestroStudio.exe), não mais o comando `maestro studio`.

No Windows, se o PowerShell bloquear o `npm` ("a execução de scripts foi desabilitada"), use
`npm.cmd run test:e2e:transacoes` ou libere scripts locais para o seu usuário com
`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
- A verificação de transações importadas usa o mês atual. Se o sandbox devolver movimentações só
  de meses anteriores, navegue com "Mês anterior" antes da asserção.

### Identificadores usados nos fluxos

Os campos de formulário receberam `testID` para seleção estável no Maestro:
`transaction-description`, `transaction-amount`, `transaction-date`, `budget-year`,
`budget-amount`, `goal-name`, `goal-description`, `goal-target`, `goal-deadline`,
`goal-movement-amount`, `goal-movement-date`, `goal-movement-description` e `category-name`.
