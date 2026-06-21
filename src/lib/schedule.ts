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

/** Período que cobre a data (por vigência). `null` se nenhum. */
export function getActivePeriod(iso: string, periods: SchedulePeriod[]): SchedulePeriod | null {
  let best: SchedulePeriod | null = null;
  for (const p of periods) {
    if (iso < p.effectiveFrom) continue;
    if (p.effectiveUntil && iso > p.effectiveUntil) continue;
    if (!best || p.effectiveFrom > best.effectiveFrom) best = p;
  }
  return best;
}

/** A data cai num dia de trabalho do ciclo do período? (ignora trocas) */
export function isCycleWorkDay(iso: string, period: SchedulePeriod): boolean {
  const offset = diffDays(iso, period.effectiveFrom);
  if (offset < 0) return false;
  const cycle = period.workDays + period.restDays;
  if (cycle <= 0) return false;
  return offset % cycle < period.workDays;
}

/** Troca de turno registrada para a data, ou `null`. */
export function swapForDate(iso: string, swaps: ShiftSwap[]): ShiftSwap | null {
  return swaps.find((s) => s.date === iso) ?? null;
}

/** Considera escala + trocas: a pessoa trabalha nesse dia? */
export function isWorkDay(
  iso: string,
  periods: SchedulePeriod[],
  swaps: ShiftSwap[] = [],
): boolean {
  const swap = swapForDate(iso, swaps);
  if (swap) {
    if (swap.kind === 'folga') return false;
    if (swap.kind === 'extra_turno') return true;
  }
  const period = getActivePeriod(iso, periods);
  return period ? isCycleWorkDay(iso, period) : false;
}

/** Horas previstas de um dia de trabalho (turno + eventual troca com horas próprias). */
export function shiftHoursForDay(
  iso: string,
  periods: SchedulePeriod[],
  swaps: ShiftSwap[] = [],
): number {
  const swap = swapForDate(iso, swaps);
  if (swap?.kind === 'extra_turno' && swap.hours != null) {
    return Number(swap.hours);
  }
  const period = getActivePeriod(iso, periods);
  return period ? Number(period.shiftHours) : 0;
}

/** Datas trabalhadas dentro do intervalo [start, end] (inclusive). */
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
  /** Trabalha nesse dia (já considera trocas). */
  isWork: boolean;
  /** Troca de turno registrada para o dia, se houver. */
  swap: ShiftSwap | null;
  /** Há horas extras avulsas registradas no dia. */
  hasExtra: boolean;
  /** Horas previstas do turno (0 se folga). */
  shiftHours: number;
  /** Soma das horas extras avulsas do dia. */
  extraHours: number;
}

/** Classifica um dia combinando escala, trocas e horas extras avulsas. */
export function getDayStatus(
  iso: string,
  periods: SchedulePeriod[],
  swaps: ShiftSwap[] = [],
  extras: ExtraHour[] = [],
): DayStatus {
  const isWork = isWorkDay(iso, periods, swaps);
  const dayExtras = extras.filter((e) => e.date === iso);
  const extraHours = dayExtras.reduce((acc, e) => acc + Number(e.hours), 0);
  return {
    isWork,
    swap: swapForDate(iso, swaps),
    hasExtra: dayExtras.length > 0,
    shiftHours: isWork ? shiftHoursForDay(iso, periods, swaps) : 0,
    extraHours,
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

export interface HoursSummary {
  scheduled: number; // horas dos turnos de escala (já com trocas)
  extra: number; // horas extras avulsas
  total: number;
  workDays: number;
}

/** Soma de horas no intervalo [start, end] (inclusive). */
export function sumHours(
  start: string,
  end: string,
  periods: SchedulePeriod[],
  swaps: ShiftSwap[] = [],
  extras: ExtraHour[] = [],
): HoursSummary {
  const dates = getWorkDates(start, end, periods, swaps);
  const scheduled = dates.reduce((acc, d) => acc + shiftHoursForDay(d, periods, swaps), 0);
  const extra = extras
    .filter((e) => e.date >= start && e.date <= end)
    .reduce((acc, e) => acc + Number(e.hours), 0);
  return {
    scheduled,
    extra,
    total: scheduled + extra,
    workDays: dates.length,
  };
}
