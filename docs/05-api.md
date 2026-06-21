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

### Escalas — `/api/schedules`

#### `GET /api/schedules`
- `200` → `{ periods: SchedulePeriod[] }`, ordenados por `effectiveFrom` desc.

#### `POST /api/schedules`
Cria uma escala. Se já houver uma escala **aberta** que começou antes da nova data, ela é encerrada
em `effectiveFrom - 1` (mudança de escala preservando histórico — ver
[04 — Lógica de escala](./04-logica-de-escala.md)).
- Body: `{ effectiveFrom: 'YYYY-MM-DD', workDays, restDays, shiftHours, shiftStartTime? }`.
- Validações: data no formato ISO; `workDays ≥ 1`; `restDays ≥ 0`; `0 < shiftHours ≤ 24`.
- `400` em validação inválida · `201` → `{ period }`.

> Não há rota de update/delete de período: mudar de escala é sempre **criar** um novo período.

### Horas extras — `/api/extras`

#### `GET /api/extras`
- `200` → `{ extras: ExtraHour[] }`, ordenados por `date` desc.

#### `POST /api/extras`
- Body: `{ date: 'YYYY-MM-DD', hours, description? }`.
- Validações: data ISO; `0 < hours ≤ 24`.
- `400` inválido · `201` → `{ extra }`.

#### `DELETE /api/extras/[id]`
- `404` se não encontrado (ou não pertence ao usuário) · `200` → `{ ok: true }`.

### Trocas de turno — `/api/swaps`

#### `GET /api/swaps`
- `200` → `{ swaps: ShiftSwap[] }`, ordenados por `date` desc.

#### `POST /api/swaps`
- Body: `{ date: 'YYYY-MM-DD', kind: 'folga' | 'extra_turno', hours?, note? }`.
- Validações: data ISO; `kind` válido; se `hours` informado, `0 < hours ≤ 24`.
- `400` inválido · `201` → `{ swap }`.

#### `DELETE /api/swaps/[id]`
- `404` se não encontrado (ou não pertence ao usuário) · `200` → `{ ok: true }`.

## Cliente tipado (`src/lib/api.ts`)

O objeto `api` expõe um método por endpoint, já tipado e tratando erros:

```ts
api.me() · api.login() · api.register() · api.logout()
api.getSchedules() · api.createSchedule(body)
api.getExtras() · api.createExtra(body) · api.deleteExtra(id)
api.getSwaps() · api.createSwap(body) · api.deleteSwap(id)
```

O helper interno `request<T>` faz o `fetch`, parseia o JSON, e em caso de `!res.ok` lança
`Error(data.error ?? 'Erro N')`. Os componentes capturam esse erro para exibir mensagens.
</content>
