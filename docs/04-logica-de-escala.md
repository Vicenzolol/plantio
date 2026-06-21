# 04 — Lógica de escala

Toda a lógica de domínio vive em [src/lib/schedule.ts](../src/lib/schedule.ts): funções **puras**,
sem efeitos colaterais e sem dependências de rede/banco. Isso a torna fácil de testar — ver
[src/lib/schedule.test.ts](../src/lib/schedule.test.ts) (`npm test`).

## Princípio: datas-only em UTC

Todas as datas são strings no formato `YYYY-MM-DD`. As contas usam `Date.UTC(...)` para **nunca**
sofrer com fuso horário ou horário de verão. Comparações de datas são feitas com comparação de
strings (`'2026-06-21' < '2026-06-24'`), que funciona porque o formato é ordenável lexicograficamente.

### Helpers de data

| Função | O que faz |
| --- | --- |
| `toISO(date)` | `Date` → `'YYYY-MM-DD'` |
| `addDays(iso, n)` | soma/subtrai dias (atravessa meses/anos) |
| `diffDays(a, b)` | diferença inteira em dias (`a - b`) |
| `todayISO()` | hoje em UTC |
| `startOfWeek(iso)` | segunda-feira da semana (semana começa na **segunda**) |
| `startOfMonth` / `endOfMonth` | limites do mês |
| `startOfYear` / `endOfYear` | limites do ano |
| `formatBR(iso)` | ex.: `"seg, 22 jun"` |
| `formatFullBR(iso)` | ex.: `"22/06/2026"` |

## Conceito de período com vigência

Um **período** (`SchedulePeriod`) representa uma escala válida a partir de uma data:

- `effectiveFrom` é o **início da vigência** e a **âncora do ciclo** (offset 0 = dia de trabalho).
- `effectiveUntil` nulo = escala aberta/vigente; preenchido = escala encerrada.

### `getActivePeriod(iso, periods)`

Retorna o período que cobre uma data (por vigência). Filtra os que ainda não começaram
(`iso < effectiveFrom`) ou já terminaram (`iso > effectiveUntil`), e em caso de sobreposição escolhe
o de `effectiveFrom` mais recente. Retorna `null` se nenhum cobre a data.

## O ciclo de trabalho

### `isCycleWorkDay(iso, period)`

A peça central. Dado o offset em dias desde a âncora:

```
offset = diffDays(iso, period.effectiveFrom)
cycle  = workDays + restDays
trabalha  ⇔  offset >= 0  E  (offset % cycle) < workDays
```

Ou seja, dentro de cada ciclo de `cycle` dias, os primeiros `workDays` são de trabalho e o restante
de folga. **Ignora trocas** — é apenas o padrão puro do ciclo.

Exemplo (escala 1x2, âncora 21/06):

```
21  22  23  24  25  26  27 ...
T   F   F   T   F   F   T
```

## Trocas sobrepõem o ciclo

### `isWorkDay(iso, periods, swaps)`

Combina ciclo + trocas:

1. Se há uma troca nesse dia: `folga` → não trabalha; `extra_turno` → trabalha (sobrepõe o ciclo).
2. Caso contrário, acha o período ativo e aplica `isCycleWorkDay`.

### `shiftHoursForDay(iso, periods, swaps)`

Horas previstas para um dia de trabalho:

- Se há `extra_turno` **com horas próprias**, usa essas horas.
- Senão, usa `shiftHours` do período ativo.
- `0` se não há período.

## Mudança de escala preservando o passado

Quando o usuário muda de escala numa data, **não** se edita o período antigo retroativamente. Em vez
disso, a API ([api/schedules/index.ts](../api/schedules/index.ts)) faz:

1. Encerra a escala aberta anterior que começou antes da nova data, setando
   `effectiveUntil = (novaData - 1 dia)`.
2. Cria um novo período aberto a partir da nova data.

Assim, `getActivePeriod` devolve a escala antiga para datas passadas e a nova para datas futuras —
cada metade do tempo usa sua própria âncora e ciclo. Há teste cobrindo exatamente isso
("mudança de escala preserva passado" em `schedule.test.ts`).

## Geração de datas e soma de horas

| Função | O que faz |
| --- | --- |
| `getWorkDates(start, end, periods, swaps)` | todas as datas trabalhadas no intervalo inclusivo |
| `getUpcomingWorkDates(from, count, periods, swaps)` | próximos `count` dias de trabalho (limite de segurança: ~3 anos) |
| `sumHours(start, end, periods, swaps, extras)` | retorna `HoursSummary` |

### `HoursSummary`

```ts
{
  scheduled: number; // horas dos turnos de escala (já com trocas)
  extra: number;     // horas extras avulsas no intervalo
  total: number;     // scheduled + extra
  workDays: number;  // qtd de dias trabalhados
}
```

`sumHours` itera os dias trabalhados (via `getWorkDates`), soma `shiftHoursForDay` de cada um, e
adiciona as `extra_hours` cujo `date` cai no intervalo.

## Onde isso é consumido no front

- **Dashboard** — `sumHours` (semana/mês), `getUpcomingWorkDates`, `isWorkDay` (status de hoje).
- **Horas** — `sumHours` por semana/mês/ano.
- **Agenda** — `getUpcomingWorkDates` + `shiftHoursForDay`, agrupando por mês.

Ver [06 — Frontend](./06-frontend.md).
</content>
