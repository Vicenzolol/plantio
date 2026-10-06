import type { SchedulePeriod, ShiftSwap, ExtraHour } from './types';

/**
 * Toda a lógica de escala trabalha com datas-only no formato 'YYYY-MM-DD'.
 * As contas de data usam UTC para nunca sofrer com timezone/horário de verão.
 */

// ----- Helpers de data-only -----

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(iso: string, days: number): string {
  const dt = parseISO(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return toISO(dt);
}

/** Diferença em dias inteiros (a - b). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86_400_000);
}

export function todayISO(): string {
  const now = new Date();
  return toISO(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

/** Segunda-feira da semana de `iso` (semana começa na segunda). */
export function startOfWeek(iso: string): string {
  const dt = parseISO(iso);
  const dow = dt.getUTCDay(); // 0=domingo
  const delta = dow === 0 ? -6 : 1 - dow;
  return addDays(iso, delta);
}

export function startOfMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return toISO(new Date(Date.UTC(y, m - 1, 1)));
}

export function endOfMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return toISO(new Date(Date.UTC(y, m, 0)));
}

export function startOfYear(iso: string): string {
  const [y] = iso.split('-').map(Number);
  return toISO(new Date(Date.UTC(y, 0, 1)));
}

export function endOfYear(iso: string): string {
  const [y] = iso.split('-').map(Number);
  return toISO(new Date(Date.UTC(y, 11, 31)));
}

/** Soma `n` meses ao mês de `iso`, ancorando no dia 1. */
export function addMonths(iso: string, n: number): string {
  const [y, m] = iso.split('-').map(Number);
  return toISO(new Date(Date.UTC(y, m - 1 + n, 1)));
}

const WEEKDAYS_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS_PT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

/** Ex.: "seg, 22 jun" */
export function formatBR(iso: string): string {
  const dt = parseISO(iso);
  return `${WEEKDAYS_PT[dt.getUTCDay()]}, ${dt.getUTCDate()} ${MONTHS_PT[dt.getUTCMonth()]}`;
}

/** Ex.: "22/06/2026" */
export function formatFullBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const MONTHS_FULL_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Ex.: "Junho de 2026" (a partir de qualquer dia do mês). */
export function monthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTHS_FULL_PT[m - 1]} de ${y}`;
}

// ----- Lógica de escala -----
//
// Cada emprego tem sua própria sequência de períodos e suas próprias trocas. A escala de um
// emprego nunca interfere na de outro: o cálculo é feito por emprego (agrupando por `jobId`) e os
// resultados são combinados (um dia "é de trabalho" se algum emprego trabalha nele; as horas somam).

/**
 * Período que cobre a data (por vigência), dentre os períodos de UM emprego. `null` se nenhum.
 * Em sobreposição vence o de `effectiveFrom` mais recente; empate na mesma data, o criado por último.
 */
export function getActivePeriod(iso: string, periods: SchedulePeriod[]): SchedulePeriod | null {
  let best: SchedulePeriod | null = null;
  for (const p of periods) {
    if (iso < p.effectiveFrom) continue;
    if (p.effectiveUntil && iso > p.effectiveUntil) continue;
    if (
      !best ||
      p.effectiveFrom > best.effectiveFrom ||
      (p.effectiveFrom === best.effectiveFrom && p.createdAt > best.createdAt)
    ) {
      best = p;
    }
  }
  return best;
}

/**
 * Início e fim de um emprego pelas suas escalas. `end` só existe quando nenhuma escala dele está
 * aberta — o emprego foi encerrado e `end` é o último dia trabalhado (maior `effectiveUntil`).
 * `null` se o emprego não tem escala.
 */
export function jobLifetime(
  jobId: string,
  periods: SchedulePeriod[],
): { start: string; end: string | null } | null {
  const own = periods.filter((p) => p.jobId === jobId);
  if (own.length === 0) return null;
  let start = own[0].effectiveFrom;
  let lastUntil = '';
  let open = false;
  for (const p of own) {
    if (p.effectiveFrom < start) start = p.effectiveFrom;
    if (p.effectiveUntil == null) open = true;
    else if (p.effectiveUntil > lastUntil) lastUntil = p.effectiveUntil;
  }
  return { start, end: open ? null : lastUntil };
}

/** Último dia de um emprego encerrado; `null` se ainda está ativo. */
export function jobEndDate(jobId: string, periods: SchedulePeriod[]): string | null {
  return jobLifetime(jobId, periods)?.end ?? null;
}

/** A data cai num dia de trabalho do ciclo do período? (ignora trocas) */
export function isCycleWorkDay(iso: string, period: SchedulePeriod): boolean {
  const offset = diffDays(iso, period.effectiveFrom);
  if (offset < 0) return false;
  const cycle = period.workDays + period.restDays;
  if (cycle <= 0) return false;
  return offset % cycle < period.workDays;
}

/** Trocas de turno registradas para a data (de qualquer emprego). */
export function swapsForDate(iso: string, swaps: ShiftSwap[]): ShiftSwap[] {
  return swaps.filter((s) => s.date === iso);
}

/** Plantão de um emprego num dia. */
export interface JobShift {
  jobId: string;
  /** Horas previstas: as da troca, se ela tiver horas próprias; senão, as do turno da escala. */
  hours: number;
  /** Troca `extra_turno` que colocou/ajustou esse plantão, se houver. */
  swap: ShiftSwap | null;
}

/**
 * Plantões do dia: um por emprego que trabalha nele. Para cada emprego, uma troca dele no dia
 * sobrepõe o ciclo (`folga` → não trabalha; `extra_turno` → trabalha); sem troca, vale o ciclo do
 * período ativo desse emprego. Ordem: primeira aparição do emprego em `periods` (depois `swaps`).
 */
export function getShiftsForDay(
  iso: string,
  periods: SchedulePeriod[],
  swaps: ShiftSwap[] = [],
): JobShift[] {
  const daySwaps = swapsForDate(iso, swaps);
  const jobIds = new Set<string>();
  for (const p of periods) jobIds.add(p.jobId);
  for (const s of daySwaps) jobIds.add(s.jobId);

  const shifts: JobShift[] = [];
  for (const jobId of jobIds) {
    const swap = daySwaps.find((s) => s.jobId === jobId) ?? null;
    if (swap?.kind === 'folga') continue;
    const period = getActivePeriod(
      iso,
      periods.filter((p) => p.jobId === jobId),
    );
    if (swap?.kind === 'extra_turno') {
      const hours =
        swap.hours != null ? Number(swap.hours) : period ? Number(period.shiftHours) : 0;
      shifts.push({ jobId, hours, swap });
    } else if (period && isCycleWorkDay(iso, period)) {
      shifts.push({ jobId, hours: Number(period.shiftHours), swap: null });
    }
  }
  return shifts;
}

/** Considera escalas + trocas: a pessoa trabalha (em algum emprego) nesse dia? */
export function isWorkDay(
  iso: string,
  periods: SchedulePeriod[],
  swaps: ShiftSwap[] = [],
): boolean {
  return getShiftsForDay(iso, periods, swaps).length > 0;
}

/** Horas previstas no dia: soma dos plantões de todos os empregos (0 se folga). */
export function shiftHoursForDay(
  iso: string,
  periods: SchedulePeriod[],
  swaps: ShiftSwap[] = [],
): number {
  return getShiftsForDay(iso, periods, swaps).reduce((acc, s) => acc + s.hours, 0);
}

/** Datas trabalhadas (em algum emprego) dentro do intervalo [start, end] (inclusive). */
export function getWorkDates(
  start: string,
  end: string,
  periods: SchedulePeriod[],
  swaps: ShiftSwap[] = [],
): string[] {
  const result: string[] = [];
  if (end < start) return result;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (isWorkDay(d, periods, swaps)) result.push(d);
  }
  return result;
}

/** Próximos `count` dias de trabalho a partir de `from` (inclusive). */
export function getUpcomingWorkDates(
  from: string,
  count: number,
  periods: SchedulePeriod[],
  swaps: ShiftSwap[] = [],
): string[] {
  const result: string[] = [];
  if (count <= 0) return result;
  let d = from;
  // Limite de segurança: ~3 anos.
  for (let i = 0; i < 366 * 3 && result.length < count; i++) {
    if (isWorkDay(d, periods, swaps)) result.push(d);
    d = addDays(d, 1);
  }
  return result;
}

/** Classificação de um dia para exibição na agenda/calendário. */
export interface DayStatus {
  /** Trabalha nesse dia em algum emprego (já considera trocas). */
  isWork: boolean;
  /** Plantões do dia, um por emprego que trabalha (já considera trocas). */
  shifts: JobShift[];
  /** Trocas de turno registradas para o dia (de qualquer emprego). */
  swaps: ShiftSwap[];
  /** Há horas extras avulsas registradas no dia. */
  hasExtra: boolean;
  /** Horas previstas dos plantões do dia, somando os empregos (0 se folga). */
  shiftHours: number;
  /** Soma das horas extras avulsas do dia. */
  extraHours: number;
}

/** Classifica um dia combinando escalas, trocas e horas extras avulsas. */
export function getDayStatus(
  iso: string,
  periods: SchedulePeriod[],
  swaps: ShiftSwap[] = [],
  extras: ExtraHour[] = [],
): DayStatus {
  const shifts = getShiftsForDay(iso, periods, swaps);
  const dayExtras = extras.filter((e) => e.date === iso);
  return {
    isWork: shifts.length > 0,
    shifts,
    swaps: swapsForDate(iso, swaps),
    hasExtra: dayExtras.length > 0,
    shiftHours: shifts.reduce((acc, s) => acc + s.hours, 0),
    extraHours: dayExtras.reduce((acc, e) => acc + Number(e.hours), 0),
  };
}

/**
 * Grade do mês de `iso` para exibição em calendário: semanas de 7 datas ISO,
 * começando no domingo, incluindo os dias "vazados" dos meses vizinhos.
 */
export function getMonthMatrix(iso: string): string[][] {
  const first = startOfMonth(iso);
  const last = endOfMonth(iso);
  // Recua até o domingo da primeira semana (getUTCDay: 0=domingo).
  const gridStart = addDays(first, -parseISO(first).getUTCDay());
  // Avança até o sábado da última semana.
  const gridEnd = addDays(last, 6 - parseISO(last).getUTCDay());
  const weeks: string[][] = [];
  for (let d = gridStart; d <= gridEnd; ) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(d);
      d = addDays(d, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Horas de um emprego num intervalo. */
export interface JobHours {
  /** Horas dos plantões de escala (já com trocas). */
  scheduled: number;
  /** Horas extras avulsas lançadas nesse emprego. */
  extra: number;
  /** Quantidade de plantões desse emprego. */
  workDays: number;
}

export interface HoursSummary {
  scheduled: number; // horas dos turnos de escala (já com trocas), somando os empregos
  extra: number; // horas extras avulsas
  total: number;
  workDays: number; // dias com ao menos um plantão (dois empregos no mesmo dia contam 1)
  byJob: Record<string, JobHours>; // detalhamento por emprego (chave: jobId)
}

/** Soma de horas no intervalo [start, end] (inclusive). */
export function sumHours(
  start: string,
  end: string,
  periods: SchedulePeriod[],
  swaps: ShiftSwap[] = [],
  extras: ExtraHour[] = [],
): HoursSummary {
  let scheduled = 0;
  let workDays = 0;
  const byJob: Record<string, JobHours> = {};
  const jobHours = (jobId: string) => (byJob[jobId] ??= { scheduled: 0, extra: 0, workDays: 0 });
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const shifts = getShiftsForDay(d, periods, swaps);
    if (shifts.length === 0) continue;
    workDays++;
    for (const s of shifts) {
      scheduled += s.hours;
      const job = jobHours(s.jobId);
      job.scheduled += s.hours;
      job.workDays++;
    }
  }
  let extra = 0;
  for (const e of extras) {
    if (e.date < start || e.date > end) continue;
    extra += Number(e.hours);
    jobHours(e.jobId).extra += Number(e.hours);
  }
  return {
    scheduled,
    extra,
    total: scheduled + extra,
    workDays,
    byJob,
  };
}
