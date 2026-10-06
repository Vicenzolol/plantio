# 04 — Lógica de escala

Toda a lógica de domínio vive em [src/lib/schedule.ts](../src/lib/schedule.ts): funções **puras**,
sem efeitos colaterais e sem dependências de rede/banco. Isso a torna fácil de testar — ver
[src/lib/schedule.test.ts](../src/lib/schedule.test.ts) (`npm test`).

A decisão de **como pintar** cada dia (cor do emprego, faixas, marca de troca) fica separada em
[src/lib/jobs.ts](../src/lib/jobs.ts), também pura e testada
([src/lib/jobs.test.ts](../src/lib/jobs.test.ts)) — ver [Cores dos empregos](#cores-dos-empregos).

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
| `addMonths(iso, n)` | avança/recua `n` meses, ancorando no dia 1 |
| `formatBR(iso)` | ex.: `"seg, 22 jun"` |
| `formatFullBR(iso)` | ex.: `"22/06/2026"` |
| `monthLabel(iso)` | ex.: `"Junho de 2026"` (qualquer dia do mês) |

## Múltiplos empregos: tudo é calculado por emprego

Uma pessoa pode ter mais de um emprego (`Job`), e **cada emprego tem sua própria sequência de
períodos e suas próprias trocas** (`SchedulePeriod.jobId`, `ShiftSwap.jobId`). A escala de um
emprego nunca interfere na de outro:

- o ciclo de cada emprego é calculado com os períodos **daquele** emprego;
- uma troca vale só para o emprego dela;
- os resultados são combinados no fim: o dia é "de trabalho" se **algum** emprego trabalha nele, e as
  horas dos empregos **somam**.

> ⚠️ Nunca chame `getActivePeriod` com períodos de empregos diferentes misturados: ele escolheria o
> período mais recente e "taparia" o outro emprego. Quem agrupa por emprego é `getShiftsForDay`.

## Conceito de período com vigência

Um **período** (`SchedulePeriod`) representa uma escala de um emprego válida a partir de uma data:

- `effectiveFrom` é o **início da vigência** e a **âncora do ciclo** (offset 0 = dia de trabalho).
- `effectiveUntil` nulo = escala aberta/vigente; preenchido = escala encerrada.

### `getActivePeriod(iso, periods)`

Retorna, dentre os períodos de **um** emprego, o que cobre a data (por vigência). Filtra os que
ainda não começaram (`iso < effectiveFrom`) ou já terminaram (`iso > effectiveUntil`), e em caso de
sobreposição escolhe o de `effectiveFrom` mais recente. **Empate** na mesma data de início (ex.: a
pessoa "mudou" a escala no mesmo dia para corrigir um erro): vence o de `createdAt` mais recente.
Retorna `null` se nenhum cobre a data.

## O ciclo de trabalho

### `isCycleWorkDay(iso, period)`

A peça central. Dado o offset em dias desde a âncora:

```text
offset = diffDays(iso, period.effectiveFrom)
cycle  = workDays + restDays
trabalha  ⇔  offset >= 0  E  (offset % cycle) < workDays
```

Ou seja, dentro de cada ciclo de `cycle` dias, os primeiros `workDays` são de trabalho e o restante
de folga. **Ignora trocas** — é apenas o padrão puro do ciclo.

Exemplo (escala 1x2, âncora 21/06):

```text
21  22  23  24  25  26  27 ...
T   F   F   T   F   F   T
```

## Plantões do dia (ciclo + trocas, por emprego)

### `getShiftsForDay(iso, periods, swaps)` → `JobShift[]`

Devolve um plantão para cada emprego que trabalha no dia:

```ts
interface JobShift {
  jobId: string;
  hours: number;           // horas da troca (se tiver horas próprias) ou do turno da escala
  swap: ShiftSwap | null;  // troca extra_turno que colocou/ajustou o plantão
}
```

Para cada emprego (os que aparecem em `periods` ou nas trocas do dia):

1. Se há uma troca **desse emprego** no dia: `folga` → não trabalha; `extra_turno` → trabalha
   (sobrepõe o ciclo), com as horas da troca ou, se ela não tiver, as do turno do período ativo
   **desse emprego**.
2. Sem troca: acha o período ativo do emprego e aplica `isCycleWorkDay`.

Ordem do resultado: primeira aparição do emprego em `periods` (depois nas trocas). A UI reordena
pela lista de empregos.

Exemplo com dois empregos (A 1x2 desde 21/06; B 1x1 desde 01/06):

```text
dia:  21  22  23  24  25  26  27
A:    T   .   .   T   .   .   T
B:    T   .   T   .   T   .   T
dia:  A+B .   B   A   B   .   A+B
```

### Funções derivadas

| Função | O que faz |
| --- | --- |
| `isWorkDay(iso, periods, swaps)` | algum emprego trabalha no dia? (`getShiftsForDay(...).length > 0`) |
| `shiftHoursForDay(iso, periods, swaps)` | soma das horas dos plantões do dia (0 se folga) |
| `swapsForDate(iso, swaps)` | trocas do dia, de todos os empregos |

## Mudança de escala preservando o passado

Quando o usuário muda a escala de um emprego numa data, **não** se edita o período antigo
retroativamente. Em vez disso, a API ([api/_lib/periods.ts](../api/_lib/periods.ts), usada por
`POST /api/schedules`) faz:

1. Encerra a escala aberta anterior **do mesmo emprego** que começou antes da nova data, setando
   `effectiveUntil = (novaData - 1 dia)`. As escalas dos outros empregos não são tocadas.
2. Cria um novo período aberto a partir da nova data.

Assim, `getActivePeriod` devolve a escala antiga para datas passadas e a nova para datas futuras —
cada metade do tempo usa sua própria âncora e ciclo. Há testes cobrindo isso ("mudança de escala
preserva passado" e "mudar a escala de um emprego não afeta o outro" em `schedule.test.ts`).

## Encerrar e retomar um emprego

"Saí deste trabalho" **não apaga nada do passado**. Não existe coluna de status: um emprego está
encerrado quando **nenhum** período dele está aberto.

| Função | O que faz |
| --- | --- |
| `jobLifetime(jobId, periods)` | `{ start, end }` — `start` = início da 1ª escala; `end` = último dia (maior `effectiveUntil`) **só se nada estiver aberto**, senão `null`. `null` se o emprego não tem escala |
| `jobEndDate(jobId, periods)` | atalho para `jobLifetime(...)?.end ?? null` |

Encerrar (`POST /api/jobs?id=...&action=end`, `endJob` em
[api/_lib/periods.ts](../api/_lib/periods.ts)) com o último dia `D`:

1. remove as trocas desse emprego depois de `D` (a UI avisa quantas);
2. descarta mudanças de escala desse emprego que só começariam depois de `D`;
3. a escala que cobre `D` passa a terminar em `D`.

As horas extras não são tocadas. Como o cálculo usa só os períodos, depois de `D` o emprego
simplesmente não tem mais plantões; antes de `D` tudo continua igual (horas, agenda, histórico).
Depois do encerramento, a API recusa novas trocas/horas extras nesse emprego com data após `D`.

**Retomar** é criar uma escala nova (aberta) pelo fluxo normal de mudança de escala: o emprego volta
a ficar ativo a partir da nova data, e o intervalo entre `D` e ela fica sem plantões.

## Geração de datas e soma de horas

| Função | O que faz |
| --- | --- |
| `getWorkDates(start, end, periods, swaps)` | datas trabalhadas (em algum emprego) no intervalo inclusivo |
| `getUpcomingWorkDates(from, count, periods, swaps)` | próximos `count` dias de trabalho (limite de segurança: ~3 anos) |
| `sumHours(start, end, periods, swaps, extras)` | retorna `HoursSummary` |
| `getDayStatus(iso, periods, swaps, extras)` | classifica um dia para exibição na agenda (ver `DayStatus`) |
| `getMonthMatrix(iso)` | grade do mês: semanas de 7 datas ISO, domingo como 1ª coluna, com dias vazados dos meses vizinhos |

### `HoursSummary`

```ts
{
  scheduled: number; // horas dos turnos de escala (já com trocas), somando os empregos
  extra: number;     // horas extras avulsas no intervalo
  total: number;     // scheduled + extra
  workDays: number;  // dias com ao menos um plantão (dois empregos no mesmo dia contam 1)
  byJob: Record<string, { scheduled: number; extra: number; workDays: number }>; // por jobId
}
```

`sumHours` percorre cada dia do intervalo, chama `getShiftsForDay` uma vez e acumula o total e o
detalhamento por emprego (`byJob[jobId].workDays` = quantidade de plantões daquele emprego). Depois
soma as `extra_hours` cujo `date` cai no intervalo — no total e no `byJob[extra.jobId].extra` do
emprego em que foram lançadas. Hora extra avulsa não conta como dia de plantão.

### `DayStatus`

Retornado por `getDayStatus(iso, periods, swaps, extras)`:

```ts
{
  isWork: boolean;        // algum emprego trabalha nesse dia (considera trocas)
  shifts: JobShift[];     // plantões do dia, um por emprego
  swaps: ShiftSwap[];     // trocas registradas para o dia (todos os empregos)
  hasExtra: boolean;      // há horas extras avulsas no dia
  shiftHours: number;     // soma das horas dos plantões (0 se folga)
  extraHours: number;     // soma das horas extras avulsas do dia
}
```

## Cores dos empregos

Cada emprego tem uma `color` (`#rrggbb`) escolhida pelo usuário numa paleta de cores do iOS
(`JOB_COLORS` em [src/lib/jobs.ts](../src/lib/jobs.ts); o padrão é o azul `#0a84ff` de sempre).
`dayVisual(status, jobs)` transforma um `DayStatus` em como pintar o dia:

| Situação | Resultado |
| --- | --- |
| Folga | `modifier: 'is-rest'`, sem fundo |
| Nenhum plantão e alguma troca `folga` no dia | `'is-cancelled'` (número riscado) |
| Um emprego | `'is-work'`, fundo = cor do emprego |
| Dois ou mais empregos | `'is-work'` + `multi`, fundo em **faixas diagonais** com as cores, na ordem da lista de empregos |
| Algum plantão veio de troca `extra_turno` | `hasSwap` → contorno tracejado (antes era o dia inteiro verde) |

A cor do texto vem de `readableTextColor` (preto ou branco pela luminância WCAG, favorecendo o
branco como o iOS). Em faixas cujos fundos pedem textos diferentes, fica branco com sombra
(`.is-multi`). `dayClassNames`/`dayStyle` aplicam o resultado como classes + estilo inline.

### Quais empregos mostrar/sugerir

Também em [src/lib/jobs.ts](../src/lib/jobs.ts):

| Função | O que faz |
| --- | --- |
| `jobsAvailableOn(iso, jobs, periods)` | empregos em que dá para lançar troca/hora extra na data — todos menos os encerrados antes dela (mesma regra da API) |
| `jobsActiveInRange(start, end, jobs, periods)` | empregos cuja vigência cruza o intervalo — legenda do calendário (por mês) e detalhamento da tela de Horas |
| `suggestJobForDay(iso, prefer, jobs, periods, swaps)` | emprego pré-selecionado: `'working'` (cancelar plantão, hora extra) prefere o 1º que trabalha no dia; `'resting'` (troca "vou trabalhar"), o 1º de folga; senão o 1º disponível |

## Onde isso é consumido no front

- **Dashboard** — `sumHours` (semana/mês), `getDayStatus` + `dayVisual` (card de hoje e faixa de dias).
- **Horas** — `sumHours` por semana/mês/ano, com `byJob` (plantões + extras) quando há mais de um
  emprego no período (`jobsActiveInRange`).
- **Agenda** — `getDayStatus` + `getMonthMatrix` + `dayVisual` (calendário mensal em grade);
  legenda com `jobsActiveInRange` do mês.
- **Ações por dia / modais** — `suggestJobForDay` e `jobsAvailableOn` escolhem e filtram o emprego
  da troca e da hora extra.
- **Perfil** — `jobEndDate` mostra "Encerrado em …" e troca "Mudar escala" por "Retomar".

Ver [06 — Frontend](./06-frontend.md).
