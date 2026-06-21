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

function swapForDate(iso: string, swaps: ShiftSwap[]): ShiftSwap | undefined {
  return swaps.find((s) => s.date === iso);
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
