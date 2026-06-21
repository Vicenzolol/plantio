# 03 — Modelo de dados

Definido em [db/schema.ts](../db/schema.ts) com Drizzle ORM, dialeto PostgreSQL. As migrations
geradas pelo `drizzle-kit` ficam em `drizzle/`.

## Diagrama de relacionamentos

```
users (1) ──< (N) schedule_periods
   │
   ├──< (N) extra_hours
   │
   └──< (N) shift_swaps
```

Todas as tabelas-filhas referenciam `users.id` com `onDelete: 'cascade'` — apagar um usuário
remove suas escalas, extras e trocas.

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

### `schedule_periods`

Cada linha é uma escala vigente a partir de uma data. **É o coração do domínio.**

| Coluna | Tipo | Default | Notas |
| --- | --- | --- | --- |
| `id` | `uuid` PK | `defaultRandom()` | |
| `user_id` | `uuid` FK → users | | cascade |
| `effective_from` | `date` | | início da vigência **e âncora do ciclo** (offset 0 = trabalho) |
| `effective_until` | `date` (nullable) | | `null` = escala ainda aberta/vigente |
| `work_days` | `integer` | `1` | dias de trabalho no ciclo |
| `rest_days` | `integer` | `2` | dias de folga no ciclo |
| `shift_hours` | `numeric(5,2)` | `'12'` | horas por turno (chega como **string**) |
| `shift_start_time` | `text` (nullable) | | hora de início do turno (ex.: `"07:00"`), opcional |
| `created_at` | `timestamptz` | `defaultNow()` | |

> **Importante:** um usuário tem múltiplos períodos ao longo do tempo. No máximo um deve estar
> "aberto" (`effective_until = null`). A regra de encerramento é aplicada na API ao criar uma nova
> escala — ver [05 — API](./05-api.md) e [04 — Lógica de escala](./04-logica-de-escala.md).

### `extra_hours`

Horas extras avulsas, somadas independentemente da escala.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → users | cascade |
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
| `date` | `date` | dia ajustado |
| `kind` | `swap_kind` | `folga` ou `extra_turno` |
| `hours` | `numeric(5,2)` (nullable) | só usado em `extra_turno`; se nulo, usa as horas do turno da escala |
| `note` | `text` (nullable) | observação opcional |
| `created_at` | `timestamptz` | |

## Tipos

- **No backend** (Drizzle): `User`, `SchedulePeriodRow`, `ExtraHourRow`, `ShiftSwapRow` são
  inferidos via `typeof tabela.$inferSelect` em [db/schema.ts](../db/schema.ts).
- **No frontend**: tipos equivalentes em [src/lib/types.ts](../src/lib/types.ts) — `SchedulePeriod`,
  `ExtraHour`, `ShiftSwap`, `AuthUser`, `SwapKind`. Note que campos `numeric` e `date` são `string`
  no front (o Postgres serializa `numeric` como string para preservar precisão).

## Migrations e seed

- `npm run db:generate` — gera SQL de migration a partir de `db/schema.ts` em `drizzle/`.
- `npm run db:migrate` — aplica as migrations ([scripts/migrate.ts](../scripts/migrate.ts)).
- `npm run db:push` — empurra o schema direto (atalho de dev, sem gerar arquivo).
- `npm run db:seed` — cria o usuário admin padrão (`admin@plantio.app` / `admin123`,
  [scripts/seed.ts](../scripts/seed.ts)). **Troque a senha depois.**

Detalhes em [08 — Setup de desenvolvimento](./08-setup-desenvolvimento.md).
</content>
