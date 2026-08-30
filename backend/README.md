# TecidOps API

Backend de producao para o **TecidOps Console** — sistema de gestao para lojas/distribuidoras de
tecidos: estoque de rolos, balcao com corte imediato, pedidos, clientes, importacao, financeiro
(contas a receber e caderneta/fiado), emissao de NF-e e relatorios de margem.

Stack: **Node.js 20 + TypeScript + Express + Prisma + PostgreSQL**, autenticacao **JWT**,
validacao com **zod**, pronto para rodar em **Docker**.

## Sumario

- [Modelo de negocio coberto](#modelo-de-negocio-coberto)
- [Rodando localmente](#rodando-localmente)
- [Rodando com Docker](#rodando-com-docker)
- [Variaveis de ambiente](#variaveis-de-ambiente)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Referencia da API](#referencia-da-api)
- [Emissao de NF-e em producao](#emissao-de-nf-e-em-producao)
- [Deploy em nuvem gerenciada](#deploy-em-nuvem-gerenciada-railway--render)
- [Seguranca e producao](#seguranca-e-producao)
- [Testes](#testes)

## Modelo de negocio coberto

| Modulo | O que faz |
| --- | --- |
| **Auth** | Cadastro da empresa (onboarding), login, refresh token, usuarios com papeis (`OWNER`, `MANAGER`, `SELLER`, `WAREHOUSE`, `FINANCE`) |
| **Clientes** | Cadastro de confeccoes, limite de credito, mix habitual, extrato |
| **Fornecedores** | Cadastro de fornecedores nacionais/importados |
| **Artigos** | Catalogo de tecidos (composicao, largura, custo/venda por metro) |
| **Estoque de rolos** | Rolos individuais com saldo, localizacao, status automatico (`WHOLE`/`RESERVED`/`REMNANT`/`CRITICAL`), historico de movimentacoes |
| **Importacao** | Lotes de importacao (FOB, cambio, custo landed por metro) e recebimento gerando rolos automaticamente |
| **Pedidos / Balcao** | Venda de balcao com corte imediato ou pedido atacado, baixa automatica de estoque (com selecao automatica de rolo por artigo+cor quando nao informado), controle de limite de credito |
| **Financeiro** | Titulos a receber, caderneta (fiado de balcao), idade da carteira (aging), cobranca via link de WhatsApp |
| **Fiscal** | Emissao de NF-e por pedido via provedor plugavel (mock incluso; pronto para Focus NFe/PlugNotas) |
| **Relatorios** | Dashboard (faturamento, metros vendidos, ticket medio, top artigos/clientes, alertas) e margem/giro por artigo |
| **App do deposito** | Consulta de rolo por etiqueta e conferencia de saldo com ajuste |
| **Agente OPS** | Assistente que responde perguntas sobre estoque, pedidos, financeiro e clientes com dados reais do banco; usa Claude (Anthropic) para perguntas livres se `ANTHROPIC_API_KEY` for configurada |

## Rodando localmente

Pre-requisitos: Node.js 20+, PostgreSQL 14+ (ou Docker).

```bash
cd backend
cp .env.example .env        # edite DATABASE_URL e os segredos JWT
npm install
npm run prisma:migrate:dev  # cria as tabelas
npm run seed                # popula dados de demonstracao
npm run dev                 # http://localhost:4000
```

Login de demonstracao criado pelo seed:

- **E-mail:** `owner@tecidops.com.br`
- **Senha:** `Demo1234!`

## Rodando com Docker

Sobe Postgres + API com um comando (aplica as migracoes automaticamente ao iniciar):

```bash
cd backend
docker compose up --build
```

A API fica disponivel em `http://localhost:4000`. Depois de subir, rode o seed dentro do
container caso queira dados de exemplo:

```bash
docker compose exec api node -e "require('child_process').execSync('npx tsx prisma/seed.ts', {stdio:'inherit'})"
```

## Variaveis de ambiente

Veja `.env.example` para a lista completa e comentada. As essenciais:

| Variavel | Descricao |
| --- | --- |
| `DATABASE_URL` | String de conexao PostgreSQL |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Segredos dos tokens — **gere valores aleatorios fortes em producao** (`openssl rand -hex 32`) |
| `CORS_ORIGIN` | Origens permitidas (dominio do frontend), separadas por virgula |
| `FISCAL_PROVIDER` | `mock` (padrao) ou o nome de um provedor real de NF-e (ver secao abaixo) |
| `ANTHROPIC_API_KEY` | Opcional — habilita respostas livres do Agente OPS via Claude |

## Estrutura do projeto

```
backend/
  prisma/
    schema.prisma     # modelo de dados completo
    seed.ts           # dados de demonstracao
  src/
    app.ts            # montagem do Express (middlewares + rotas)
    server.ts          # bootstrap/porta/graceful shutdown
    config/env.ts      # validacao de variaveis de ambiente (zod)
    middleware/         # auth (JWT), validacao, tratamento de erros
    modules/
      auth/ customers/ suppliers/ articles/ rolls/ imports/
      orders/ financial/ fiscal/ reports/ warehouse/ agent/ company/
        *.schema.ts     # validacao de entrada (zod)
        *.service.ts    # regra de negocio + acesso ao banco (Prisma)
        *.controller.ts # HTTP request/response
        *.routes.ts     # definicao das rotas + permissoes por papel
  tests/                # testes unitarios (vitest)
```

Cada modulo segue o mesmo padrao `schema -> service -> controller -> routes`, o que facilita
adicionar um novo modulo (ex: um segundo canal de venda) copiando a estrutura de um existente.

## Referencia da API

Todas as rotas (exceto `/health`, `/api/v1/auth/register`, `/login`, `/refresh`, `/logout`) exigem
`Authorization: Bearer <accessToken>`. Paginacao usa `?page=1&pageSize=20` e retorna
`{ items, meta: { total, page, pageSize, totalPages } }`.

```
POST   /api/v1/auth/register           cria empresa + usuario OWNER
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
GET    /api/v1/auth/users              (OWNER/MANAGER)
POST   /api/v1/auth/users              (OWNER/MANAGER)

GET    /api/v1/customers               ?search=&page=&pageSize=
GET    /api/v1/customers/:id
GET    /api/v1/customers/:id/statement
POST   /api/v1/customers
PATCH  /api/v1/customers/:id
DELETE /api/v1/customers/:id           (soft delete)

GET    /api/v1/suppliers | POST | GET/:id | PATCH/:id | DELETE/:id

GET    /api/v1/articles | POST | GET/:id | PATCH/:id | DELETE/:id

GET    /api/v1/rolls                   ?status=&warehouse=&articleId=&search=
GET    /api/v1/rolls/:id               ficha do rolo + historico de movimentacoes
POST   /api/v1/rolls                   entrada manual de rolo
PATCH  /api/v1/rolls/:id
POST   /api/v1/rolls/:id/adjust        ajuste de saldo (conferencia manual)

GET    /api/v1/import-lots             ?status=
GET    /api/v1/import-lots/:id
POST   /api/v1/import-lots
PATCH  /api/v1/import-lots/:id
POST   /api/v1/import-lots/:id/receive gera rolos a partir do lote recebido

GET    /api/v1/orders                  ?stage=&customerId=&search=
GET    /api/v1/orders/kpis
GET    /api/v1/orders/:id
POST   /api/v1/orders                  cria pedido/venda (deduz estoque, gera titulo se a prazo)
PATCH  /api/v1/orders/:id/stage        avanca etapa (QUOTE->AWAITING_CUT->CUT->INVOICED->DELIVERED)
POST   /api/v1/orders/:id/cancel       cancela e estorna estoque/titulos

GET    /api/v1/financial/titles        ?status=&customerId=&isCaderneta=
GET    /api/v1/financial/titles/aging  idade da carteira (buckets)
POST   /api/v1/financial/titles/caderneta   registra fiado de balcao
POST   /api/v1/financial/titles/:id/pay
POST   /api/v1/financial/titles/:id/charge  gera link de cobranca no WhatsApp

GET    /api/v1/fiscal/notes            ?status=
GET    /api/v1/fiscal/notes/:id
POST   /api/v1/fiscal/notes            emite NF-e para um pedido
POST   /api/v1/fiscal/notes/:id/cancel

GET    /api/v1/reports/dashboard       KPIs, faturamento semanal, top artigos/clientes, alertas
GET    /api/v1/reports/margins         margem, giro e cobertura por artigo

GET    /api/v1/warehouse/rolls/lookup  ?code=R-4412  (leitura de etiqueta)
GET    /api/v1/warehouse/conferences   ?status=
GET    /api/v1/warehouse/conferences/queue
POST   /api/v1/warehouse/conferences
POST   /api/v1/warehouse/conferences/:id/resolve

POST   /api/v1/agent/ask               { message } -> resposta com dados reais do negocio
GET    /api/v1/agent/history

GET    /api/v1/company
PATCH  /api/v1/company                 (OWNER/MANAGER)
```

## Emissao de NF-e em producao

A emissao fiscal real depende de contratar um **certificado digital A1 (e-CNPJ)** e um provedor
de emissao homologado junto a SEFAZ (ex: **Focus NFe**, **PlugNotas/Tecnospeed**, **eNotas**).
Este backend ja isola essa integracao atras de uma interface (`FiscalProvider`, em
`src/modules/fiscal/fiscal.provider.ts`) com um provedor **mock** que simula autorizacao/rejeicao
para voce testar o fluxo completo sem custos. Para ir a producao real:

1. Contrate um dos provedores acima e obtenha a API key.
2. Implemente uma classe que satisfaca a interface `FiscalProvider` chamando a API do provedor.
3. Preencha `FISCAL_PROVIDER`, `FISCAL_PROVIDER_API_KEY` e `FISCAL_PROVIDER_BASE_URL` no `.env`.

Nenhuma outra parte do sistema precisa mudar — pedidos, financeiro e relatorios continuam
funcionando com o mesmo contrato.

## Deploy em nuvem gerenciada (Railway / Render)

1. Crie um projeto e adicione um banco **PostgreSQL gerenciado** (Railway/Render tem addon
   nativo). Copie a `DATABASE_URL` gerada.
2. Crie um servico apontando para a pasta `backend/` deste repositorio, com:
   - Build command: `npm install && npm run build`
   - Start command: `npx prisma migrate deploy && npm start`
3. Configure as variaveis de ambiente do servico (`DATABASE_URL`, `JWT_ACCESS_SECRET`,
   `JWT_REFRESH_SECRET`, `CORS_ORIGIN` com o dominio do seu frontend, `FISCAL_PROVIDER`, etc.)
   — use os mesmos nomes de `.env.example`.
4. Apos o primeiro deploy, rode o seed uma unica vez (opcional, so para dados de exemplo)
   pelo terminal do proprio servico: `npm run seed`.
5. Aponte o frontend (`OdontoManage/TecidOps Console`) para a URL publica do servico
   (ex: `https://teciops-api.up.railway.app/api/v1`).

O `Dockerfile` incluso tambem funciona em qualquer plataforma que aceite containers
(Fly.io, Google Cloud Run, ECS, um VPS com Docker, etc.).

## Seguranca e producao

- Senhas com `bcrypt` (12 rounds); tokens de acesso JWT de vida curta (15 min) + refresh token
  opaco de vida longa, com rotacao a cada uso e revogacao no logout.
- `helmet`, `cors` restrito por origem, `express-rate-limit` em `/api`, limite de payload JSON.
- Toda escrita valida entrada com `zod`; erros de validacao retornam `422` com detalhes.
- Multi-tenant desde o inicio (`companyId` em todas as tabelas de negocio) — cada usuario so
  enxerga dados da propria empresa, controlado pelo `companyId` do token JWT.
- **Antes de ir para producao com clientes reais**, troque os segredos JWT, restrinja
  `CORS_ORIGIN` ao dominio real do frontend, e configure backups automaticos do PostgreSQL
  gerenciado (Railway/Render fazem isso; confirme a politica de retencao).

## Testes

```bash
npm test          # testes unitarios (vitest) — nao precisam de banco
npm run typecheck # checagem de tipos
```

Os testes de integracao dos endpoints (com banco de dados real) ficam como proximo passo natural:
suba um Postgres de teste (`docker compose up db`), aponte `DATABASE_URL` para ele e escreva
testes com `supertest` chamando `createApp()` — a estrutura de `tests/` ja esta pronta para isso.
