import type { Job, SchedulePeriod, ShiftSwap } from './types';
import { getShiftsForDay, jobLifetime, type DayStatus, type JobShift } from './schedule';

/** Cor padrão de um emprego (o azul que o app sempre usou para dias de trabalho). */
export const DEFAULT_JOB_COLOR = '#0a84ff';

/** Paleta oferecida ao escolher a cor de um emprego (cores de sistema do iOS). */
export const JOB_COLORS: { value: string; label: string }[] = [
  { value: '#0a84ff', label: 'Azul' },
  { value: '#34c759', label: 'Verde' },
  { value: '#ff9500', label: 'Laranja' },
  { value: '#ff2d55', label: 'Rosa' },
  { value: '#af52de', label: 'Roxo' },
  { value: '#5856d6', label: 'Índigo' },
  { value: '#30b0c7', label: 'Turquesa' },
  { value: '#ff3b30', label: 'Vermelho' },
  { value: '#a2845e', label: 'Marrom' },
  { value: '#ffcc00', label: 'Amarelo' },
];

/**
 * Empregos em que dá para lançar algo (troca, hora extra) na data: todos, menos os encerrados
 * antes dela. A API aplica a mesma regra.
 */
export function jobsAvailableOn(iso: string, jobs: Job[], periods: SchedulePeriod[]): Job[] {
  return jobs.filter((j) => {
    const end = jobLifetime(j.id, periods)?.end;
    return !end || iso <= end;
  });
}

/** Empregos cuja vigência cruza o intervalo [start, end] (para legendas e resumos do período). */
export function jobsActiveInRange(
  start: string,
  end: string,
  jobs: Job[],
  periods: SchedulePeriod[],
): Job[] {
  return jobs.filter((j) => {
    const life = jobLifetime(j.id, periods);
    return !life || (life.start <= end && (life.end == null || life.end >= start));
  });
}

/**
 * Emprego sugerido ao lançar algo num dia, entre os disponíveis na data: `'working'` prefere o
 * primeiro que trabalha no dia (cancelar plantão, hora extra); `'resting'`, o primeiro de folga
 * (troca "vou trabalhar"). Sem nenhum assim, o primeiro disponível.
 */
export function suggestJobForDay(
  iso: string,
  prefer: 'working' | 'resting',
  jobs: Job[],
  periods: SchedulePeriod[],
  swaps: ShiftSwap[] = [],
): string | undefined {
  const available = jobsAvailableOn(iso, jobs, periods);
  const working = new Set(getShiftsForDay(iso, periods, swaps).map((s) => s.jobId));
  const match = available.find((j) => (prefer === 'working') === working.has(j.id));
  return (match ?? available[0])?.id;
}

/** Primeira cor da paleta que nenhum emprego usa ainda (sugestão para um emprego novo). */
export function suggestJobColor(jobs: Job[]): string {
  const used = new Set(jobs.map((j) => j.color.toLowerCase()));
  return JOB_COLORS.find((c) => !used.has(c.value))?.value ?? DEFAULT_JOB_COLOR;
}

/**
 * Cor de texto legível (preto ou branco) sobre o fundo `hex`, pela luminância relativa (WCAG).
 * O limiar favorece o branco, como o iOS faz sobre suas cores de sistema.
 */
export function readableTextColor(hex: string): '#000000' | '#ffffff' {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return '#ffffff';
  const n = parseInt(match[1], 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/** Fundo de um dia de plantão: a cor do emprego, ou faixas diagonais se houver mais de um. */
export function jobsBackground(colors: string[]): string {
  if (colors.length === 0) return DEFAULT_JOB_COLOR;
  if (colors.length === 1) return colors[0];
  const step = 100 / colors.length;
  const pct = (v: number) => `${Number(v.toFixed(2))}%`;
  const stops = colors.map((c, i) => `${c} ${pct(i * step)}, ${c} ${pct((i + 1) * step)}`);
  return `linear-gradient(135deg, ${stops.join(', ')})`;
}

/** Plantão do dia com o emprego resolvido (para exibir nome/cor). */
export interface ShiftWithJob {
  shift: JobShift;
  job: Job | null;
  color: string;
}

/** Como pintar um dia na agenda (faixa da Dashboard, calendário e card de "hoje"). */
export interface DayVisual {
  /** Classe base: trabalho, dia de trabalho cancelado por troca, ou folga. */
  modifier: 'is-work' | 'is-cancelled' | 'is-rest';
  /** Fundo do dia de trabalho (cor do emprego ou faixas); `null` nos demais. */
  background: string | null;
  /** Cor de texto legível sobre `background`; `null` nos demais. */
  color: string | null;
  /** Mais de um emprego trabalha no dia. */
  multi: boolean;
  /** Algum plantão do dia veio de troca (`extra_turno`). */
  hasSwap: boolean;
  /** Plantões do dia na ordem da lista de empregos. */
  shifts: ShiftWithJob[];
}

export function dayVisual(status: DayStatus, jobs: Job[]): DayVisual {
  const index = (jobId: string) => {
    const i = jobs.findIndex((j) => j.id === jobId);
    return i === -1 ? jobs.length : i;
  };
  const shifts: ShiftWithJob[] = [...status.shifts]
    .sort((a, b) => index(a.jobId) - index(b.jobId))
    .map((shift) => {
      const job = jobs.find((j) => j.id === shift.jobId) ?? null;
      return { shift, job, color: job?.color ?? DEFAULT_JOB_COLOR };
    });

  if (shifts.length === 0) {
    const cancelled = status.swaps.some((s) => s.kind === 'folga');
    return {
      modifier: cancelled ? 'is-cancelled' : 'is-rest',
      background: null,
      color: null,
      multi: false,
      hasSwap: false,
      shifts,
    };
  }

  const colors = shifts.map((s) => s.color);
  const textColors = new Set(colors.map(readableTextColor));
  return {
    modifier: 'is-work',
    background: jobsBackground(colors),
    // Faixas com fundos pedindo textos diferentes: branco (o CSS de .is-multi adiciona sombra).
    color: textColors.size === 1 ? [...textColors][0] : '#ffffff',
    multi: shifts.length > 1,
    hasSwap: shifts.some((s) => s.shift.swap?.kind === 'extra_turno'),
    shifts,
  };
}

/** Classes CSS de um dia (chip da faixa ou célula do calendário). */
export function dayClassNames(v: DayVisual): string {
  return [v.modifier, v.multi ? 'is-multi' : '', v.hasSwap ? 'has-swap' : '']
    .filter(Boolean)
    .join(' ');
}

/** Estilo inline de um dia de trabalho (as cores dos empregos são dinâmicas). */
export function dayStyle(v: DayVisual): { background: string; color: string } | undefined {
  return v.background && v.color ? { background: v.background, color: v.color } : undefined;
}
