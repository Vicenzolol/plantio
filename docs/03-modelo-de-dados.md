# 03 — Modelo de dados

Definido em [db/schema.ts](../db/schema.ts) com Drizzle ORM, dialeto PostgreSQL. As migrations
geradas pelo `drizzle-kit` ficam em `drizzle/`.

## Diagrama de relacionamentos

```text
users (1) ──< (N) jobs (1) ──< (N) schedule_periods
                       │
                       ├──< (N) shift_swaps
                       │
                       └──< (N) extra_hours
```

Um usuário pode ter **vários empregos** (`jobs`), cada um com sua própria escala (períodos), suas
próprias trocas e suas horas extras. `schedule_periods`, `shift_swaps` e `extra_hours` também
guardam `user_id` (para filtrar por usuário direto), além do `job_id`.

Todas as chaves estrangeiras usam `onDelete: 'cascade'` — apagar um usuário remove tudo dele;
apagar um emprego remove a escala, as trocas e as horas extras daquele emprego (por isso a UI
oferece **encerrar** o emprego, que mantém o histórico, antes de excluir).

## Enums

```ts
swap_kind = 'folga' | 'extra_turno'
```

- `folga` — um dia que seria de trabalho na escala mas a pessoa **não** vai trabalhar.
- `extra_turno` — um dia que seria de folga mas a pessoa **vai** trabalhar.

## Tabelas

### `users`

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | `uuid` PK | `defaultRandom()` |
| `name` | `text` | obrigatório |
| `email` | `text` | obrigatório, **único** (armazenado em minúsculas) |
| `password_hash` | `text` | hash bcrypt (custo 10) |
| `created_at` | `timestamptz` | `defaultNow()` |

### `jobs`

Empregos/trabalhos do usuário. A cor pinta os dias de plantão desse emprego na agenda.

| Coluna | Tipo | Default | Notas |
| --- | --- | --- | --- |
| `id` | `uuid` PK | `defaultRandom()` | |
| `user_id` | `uuid` FK → users | | cascade |
| `name` | `text` | | obrigatório (a API limita a 40 caracteres) |
| `color` | `text` | `'#0a84ff'` | `#rrggbb`, salvo em minúsculas |
| `created_at` | `timestamptz` | `defaultNow()` | define a ordem dos empregos (o mais antigo é o "principal") |

> Todo emprego nasce junto com sua primeira escala (`POST /api/jobs`), então não existe emprego sem
> período. O usuário precisa ter pelo menos um emprego (a API recusa excluir o último).
>
> **Emprego encerrado** não é uma coluna: é derivado das escalas. Um emprego está encerrado quando
> **nenhum** período dele está aberto; o último dia é o maior `effective_until`. Encerrar = fechar a
> escala vigente no último dia (ver `endJob` em [api/_lib/periods.ts](../api/_lib/periods.ts));
> retomar = criar uma escala nova aberta.

### `schedule_periods`

Cada linha é uma escala de um emprego, vigente a partir de uma data. **É o coração do domínio.**

| Coluna | Tipo | Default | Notas |
| --- | --- | --- | --- |
| `id` | `uuid` PK | `defaultRandom()` | |
| `user_id` | `uuid` FK → users | | cascade |
| `job_id` | `uuid` FK → jobs | | cascade — a qual emprego a escala pertence |
| `effective_from` | `date` | | início da vigência **e âncora do ciclo** (offset 0 = trabalho) |
| `effective_until` | `date` (nullable) | | `null` = escala ainda aberta/vigente |
| `work_days` | `integer` | `1` | dias de trabalho no ciclo |
| `rest_days` | `integer` | `2` | dias de folga no ciclo |
| `shift_hours` | `numeric(5,2)` | `'12'` | horas por turno (chega como **string**) |
| `shift_start_time` | `text` (nullable) | | hora de início do turno (ex.: `"07:00"`), opcional |
| `created_at` | `timestamptz` | `defaultNow()` | |

> **Importante:** cada emprego tem múltiplos períodos ao longo do tempo. No máximo um deve estar
> "aberto" (`effective_until = null`) **por emprego** — com dois empregos, o usuário tem dois
> períodos abertos ao mesmo tempo, e isso é o esperado. A regra de encerramento é aplicada na API ao
> criar uma nova escala e só toca o período do mesmo emprego — ver [05 — API](./05-api.md) e
> [04 — Lógica de escala](./04-logica-de-escala.md).

### `extra_hours`

Horas extras avulsas, somadas independentemente da escala (não precisam cair num dia de plantão).

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → users | cascade |
| `job_id` | `uuid` FK → jobs | cascade — em qual emprego as horas foram feitas |
| `date` | `date` | dia das horas extras |
| `hours` | `numeric(5,2)` | quantidade (string) |
| `description` | `text` (nullable) | observação opcional |
| `created_at` | `timestamptz` | |

### `shift_swaps`

Ajustes pontuais de um único dia.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → users | cascade |
| `job_id` | `uuid` FK → jobs | cascade — a troca vale **só para esse emprego** |
| `date` | `date` | dia ajustado |
| `kind` | `swap_kind` | `folga` ou `extra_turno` |
| `hours` | `numeric(5,2)` (nullable) | só usado em `extra_turno`; se nulo, usa as horas do turno da escala **do emprego da troca** |
| `note` | `text` (nullable) | observação opcional |
| `created_at` | `timestamptz` | |

## Tipos

- **No backend** (Drizzle): `User`, `JobRow`, `SchedulePeriodRow`, `ExtraHourRow`, `ShiftSwapRow` são
  inferidos via `typeof tabela.$inferSelect` em [db/schema.ts](../db/schema.ts).
- **No frontend**: tipos equivalentes em [src/lib/types.ts](../src/lib/types.ts) — `Job`,
  `SchedulePeriod`, `ExtraHour`, `ShiftSwap`, `AuthUser`, `SwapKind`. Note que campos `numeric` e
  `date` são `string` no front (o Postgres serializa `numeric` como string para preservar precisão).

## Migrations existentes

| Migration | O que faz |
| --- | --- |
| `0000_clear_colonel_america` | Schema inicial (users, schedule_periods, extra_hours, shift_swaps) |
| `0001_add_jobs` | Múltiplos empregos: cria `jobs`, adiciona `job_id` em `schedule_periods`, `shift_swaps` e `extra_hours`. Cada usuário que já tinha escala, trocas ou horas extras ganha um emprego **"Trabalho principal"** azul (`#0a84ff`) e todos os registros existentes são ligados a ele. **Nada é apagado nem alterado**, e visualmente nada muda para quem já usava o app |

A `0001` foi **escrita à mão** (o SQL cru do drizzle-kit adicionaria `job_id NOT NULL` direto, o que
falha em tabelas com dados) e roda num único bloco `DO $$ ... $$`. Isso importa porque o migrator do
`neon-http` executa cada statement **sem transação**: com um bloco só, o Postgres aplica tudo ou nada.
O snapshot em `drizzle/meta/0001_snapshot.json` continua sendo o gerado pelo drizzle-kit, então o
próximo `db:generate` parte do schema correto. Ao escrever migrations futuras com backfill, siga o
mesmo padrão.

## Migrations e seed

- `npm run db:generate` — gera SQL de migration a partir de `db/schema.ts` em `drizzle/`.
- `npm run db:migrate` — aplica as migrations ([scripts/migrate.ts](../scripts/migrate.ts)).
- `npm run db:push` — empurra o schema direto (atalho de dev, sem gerar arquivo).
- `npm run db:seed` — cria o usuário admin padrão (`admin@plantio.app` / `admin123`,
  [scripts/seed.ts](../scripts/seed.ts)). **Troque a senha depois.**

Detalhes em [08 — Setup de desenvolvimento](./08-setup-desenvolvimento.md).
</content>
