# 05 — API

As rotas vivem em `api/**` como Vercel Serverless Functions (runtime `@vercel/node`). Cada arquivo
exporta um `handler(req, res)` default. O cliente do front que as consome é
[src/lib/api.ts](../src/lib/api.ts).

## Convenções

- **Base URL:** `/api`. Em produção é servida pela Vercel; em dev, via proxy do Vite para
  `vercel dev` (porta 3000).
- **Formato:** JSON in/out. O cliente sempre envia `credentials: 'include'` e
  `Content-Type: application/json`.
- **Autenticação:** por cookie httpOnly `plantio_session` (JWT). Rotas protegidas chamam
  `requireUser(req, res)` que responde **401** e encerra se não houver sessão. Ver
  [07 — Autenticação](./07-autenticacao.md).
- **Escopo por usuário:** toda query filtra por `userId` extraído da sessão — um usuário só lê/escreve
  os próprios dados.
- **Erros:** corpo `{ "error": "mensagem" }` com status apropriado. O cliente extrai `error` e o
  lança como `Error` (ver `request<T>` em `src/lib/api.ts`).
- **Sem transações:** o driver `neon-http` não suporta transações; operações multi-passo são
  sequenciais.
- **Limite de funções (Vercel Hobby = 12 por deploy):** cada arquivo em `api/` (fora de `_lib/`) vira
  uma função. Hoje são 12 — por isso `/api/jobs` concentra GET/POST/PATCH/DELETE num arquivo só, com
  o id por query (`?id=`) em vez de um `[id].ts`. Antes de criar um endpoint novo, considere juntar
  com um existente ou remover os temporários `api/debug.ts` / `api/debug-db.ts`.
- **Helpers compartilhados** ficam em `api/_lib/` (o `_` impede a Vercel de tratá-los como função):
  `auth.ts` (sessão), `jobs.ts` (validação de nome/cor, `findUserJob`) e `periods.ts`
  (`parsePeriodInput`, `createPeriod`, `getJobLifetime`, `jobClosedOn`, `endJob`, `isValidISODate`).
- **Trabalho encerrado:** trocas e horas extras com data **depois** do último dia de um trabalho
  encerrado são recusadas com `400` (`"Este trabalho foi encerrado em DD/MM/AAAA."`). Até o último
  dia, inclusive, continuam aceitas (lançamentos retroativos).

## Endpoints

### Auth

#### `POST /api/auth/register`
Cria usuário e já abre sessão.
- Body: `{ name, email, password }` (senha ≥ 6 caracteres).
- `400` campos faltando / senha curta · `409` email já cadastrado.
- `201` → `{ user: { id, name, email } }` + cookie de sessão.
- Email é normalizado (`trim().toLowerCase()`).

#### `POST /api/auth/login`
- Body: `{ email, password }`.
- `400` campos faltando · `401` credenciais inválidas.
- `200` → `{ user }` + cookie de sessão.

#### `GET /api/auth/me`
Lê a sessão do cookie (não exige auth: devolve `user: null` se não logado).
- `200` → `{ user: AuthUser | null, hasSchedule?: boolean }`.
- `hasSchedule` indica se o usuário já tem ao menos um período cadastrado — usado para decidir o
  fluxo de "primeiro acesso" no roteamento ([06 — Frontend](./06-frontend.md)).

#### `POST /api/auth/logout`
- `200` → `{ ok: true }` + limpa o cookie.

### Empregos — `/api/jobs`

Um único arquivo ([api/jobs/index.ts](../api/jobs/index.ts)) atende todos os métodos; PATCH/DELETE
recebem o id por query string (ver "Limite de funções" acima).

#### `GET /api/jobs`
- `200` → `{ jobs: Job[] }`, ordenados por `createdAt` asc (o primeiro é o emprego "principal").

#### `POST /api/jobs`
Cria um emprego **já com a sua primeira escala** (não existe emprego sem escala). Usado pelo Setup
(primeiro acesso) e por "Adicionar outro trabalho" no Perfil.
- Body: `{ name, color: '#rrggbb', schedule: { effectiveFrom, workDays, restDays, shiftHours, shiftStartTime? } }`.
- Validações: `name` com 1–40 caracteres (aparado); `color` no formato `#rrggbb` (salvo em
  minúsculas); `schedule` com as mesmas regras de `POST /api/schedules`. Tudo é validado **antes** de
  gravar.
- Sem transação: grava o emprego e depois a escala; se a escala falhar, o emprego é apagado
  (compensação) e o erro sobe como 500.
- `400` inválido · `201` → `{ job, period }`.
- Criar um emprego **não** encerra a escala dos outros empregos.

#### `PATCH /api/jobs?id=<uuid>`
Edita nome e/ou cor.
- Body: `{ name?, color? }` — ao menos um.
- `400` inválido/nada para atualizar · `404` não encontrado (ou de outro usuário, ou id malformado) ·
  `200` → `{ job }`.

#### `POST /api/jobs?id=<uuid>&action=end`
Encerra o emprego ("saí deste trabalho"), **mantendo o histórico** até o último dia.
- Body: `{ endDate: 'YYYY-MM-DD' }` — o último dia trabalhado (pode ser no futuro).
- Efeitos: remove as trocas desse emprego depois de `endDate`; descarta escalas desse emprego que
  começariam depois; a escala que cobre `endDate` passa a terminar nela. Horas extras não são
  tocadas. Outros empregos não mudam. Sem transação: as remoções vêm antes do fechamento, então uma
  falha no meio deixa o emprego ainda aberto e a operação pode ser repetida.
- `404` não encontrado · `400` data inválida, anterior ao início do emprego, ou emprego **já
  encerrado** numa data igual/anterior (só é permitido antecipar o encerramento; para estender,
  retome com uma nova escala) · `200` → `{ ok: true, endDate }`.
- **Retomar** um emprego encerrado = `POST /api/schedules` com o `jobId` dele.

#### `DELETE /api/jobs?id=<uuid>`
Exclui o emprego **e, em cascata, a escala, as trocas e as horas extras dele**. Para guardar o
histórico, use o encerramento acima.
- `404` não encontrado · `400` se for o último emprego do usuário · `200` → `{ ok: true }`.

### Escalas — `/api/schedules`

#### `GET /api/schedules`
- `200` → `{ periods: SchedulePeriod[] }` (de todos os empregos, cada um com `jobId`), ordenados por
  `effectiveFrom` desc.

#### `POST /api/schedules`
Cria uma escala para um emprego. Se **esse emprego** já tiver uma escala **aberta** que começou antes
da nova data, ela é encerrada em `effectiveFrom - 1` (mudança de escala preservando histórico — ver
[04 — Lógica de escala](./04-logica-de-escala.md)). As escalas dos outros empregos não mudam.
- Body: `{ jobId, effectiveFrom: 'YYYY-MM-DD', workDays, restDays, shiftHours, shiftStartTime? }`.
- Validações: data ISO e existente (rejeita `2026-02-31`); `workDays` inteiro `≥ 1`; `restDays`
  inteiro `≥ 0`; `0 < shiftHours ≤ 24`; `jobId` do próprio usuário.
- **Compatibilidade:** sem `jobId` (cliente antigo em cache do PWA), usa o emprego mais antigo do
  usuário — e, se ele não tiver nenhum, cria o emprego padrão "Trabalho principal".
- `400` em validação inválida · `404` emprego não encontrado · `201` → `{ period }`.

> Não há rota de update/delete de período: mudar de escala é sempre **criar** um novo período.

### Horas extras — `/api/extras`

#### `GET /api/extras`
- `200` → `{ extras: ExtraHour[] }` (cada uma com `jobId`), ordenados por `date` desc.

#### `POST /api/extras`
- Body: `{ jobId, date: 'YYYY-MM-DD', hours, description? }`.
- Validações: data ISO e existente; `0 < hours ≤ 24`; `jobId` do próprio usuário; trabalho não
  encerrado antes da data. Sem `jobId` (cliente antigo): emprego mais antigo do usuário.
- `400` inválido · `404` emprego não encontrado · `201` → `{ extra }`.

#### `DELETE /api/extras/[id]`
- `404` se não encontrado (ou não pertence ao usuário) · `200` → `{ ok: true }`.

### Trocas de turno — `/api/swaps`

#### `GET /api/swaps`
- `200` → `{ swaps: ShiftSwap[] }` (cada uma com `jobId`), ordenados por `date` desc.

#### `POST /api/swaps`
A troca vale só para o emprego informado.
- Body: `{ jobId, date: 'YYYY-MM-DD', kind: 'folga' | 'extra_turno', hours?, note? }`.
- Validações: data ISO; `kind` válido; se `hours` informado, `0 < hours ≤ 24`; `jobId` do próprio
  usuário; trabalho não encerrado antes da data. Sem `jobId` (cliente antigo): emprego mais antigo
  do usuário.
- `400` inválido · `404` emprego não encontrado (ou usuário sem emprego) · `201` → `{ swap }`.

#### `DELETE /api/swaps/[id]`
- `404` se não encontrado (ou não pertence ao usuário) · `200` → `{ ok: true }`.

## Cliente tipado (`src/lib/api.ts`)

O objeto `api` expõe um método por endpoint, já tipado e tratando erros:

```ts
api.me() · api.login() · api.register() · api.logout()
api.getJobs() · api.createJob(body) · api.updateJob(id, body) · api.deleteJob(id) · api.endJob(id, endDate)
api.getSchedules() · api.createSchedule(body)  // body inclui jobId
api.getExtras() · api.createExtra(body) · api.deleteExtra(id)  // createExtra inclui jobId
api.getSwaps() · api.createSwap(body) · api.deleteSwap(id)  // createSwap inclui jobId
```

O helper interno `request<T>` faz o `fetch`, parseia o JSON, e em caso de `!res.ok` lança
`Error(data.error ?? 'Erro N')`. Os componentes capturam esse erro para exibir mensagens.
</content>
