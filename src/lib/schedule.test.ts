import { describe, it, expect } from 'vitest';
import {
  addDays,
  diffDays,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  isCycleWorkDay,
  isWorkDay,
  getWorkDates,
  getUpcomingWorkDates,
  getActivePeriod,
  sumHours,
  getDayStatus,
  getMonthMatrix,
  addMonths,
} from './schedule';
import type { SchedulePeriod, ShiftSwap, ExtraHour } from './types';

function makePeriod(p: Partial<SchedulePeriod>): SchedulePeriod {
  return {
    id: p.id ?? 'p1',
    userId: 'u1',
    effectiveFrom: p.effectiveFrom ?? '2026-06-21',
    effectiveUntil: p.effectiveUntil ?? null,
    workDays: p.workDays ?? 1,
    restDays: p.restDays ?? 2,
    shiftHours: p.shiftHours ?? '12',
    shiftStartTime: p.shiftStartTime ?? null,
    createdAt: '2026-06-21T00:00:00Z',
  };
}

describe('helpers de data', () => {
  it('addDays atravessa meses', () => {
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('diffDays conta dias inteiros', () => {
    expect(diffDays('2026-06-24', '2026-06-21')).toBe(3);
    expect(diffDays('2026-06-21', '2026-06-24')).toBe(-3);
  });

  it('startOfWeek volta para segunda', () => {
    // 2026-06-21 é um domingo -> segunda anterior é 15
    expect(startOfWeek('2026-06-21')).toBe('2026-06-15');
    // 2026-06-22 é segunda -> ele mesmo
    expect(startOfWeek('2026-06-22')).toBe('2026-06-22');
  });

  it('limites de mês', () => {
    expect(startOfMonth('2026-06-21')).toBe('2026-06-01');
    expect(endOfMonth('2026-06-21')).toBe('2026-06-30');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
  });
});

describe('ciclo 1x2 (trabalha 1, folga 2)', () => {
  const period = makePeriod({ effectiveFrom: '2026-06-21' });

  it('trabalha no dia âncora e a cada 3 dias', () => {
    expect(isCycleWorkDay('2026-06-21', period)).toBe(true);
    expect(isCycleWorkDay('2026-06-22', period)).toBe(false);
    expect(isCycleWorkDay('2026-06-23', period)).toBe(false);
    expect(isCycleWorkDay('2026-06-24', period)).toBe(true);
    expect(isCycleWorkDay('2026-06-27', period)).toBe(true);
  });

  it('não trabalha antes da vigência', () => {
    expect(isCycleWorkDay('2026-06-20', period)).toBe(false);
  });

  it('próximas datas de trabalho', () => {
    const upcoming = getUpcomingWorkDates('2026-06-21', 4, [period]);
    expect(upcoming).toEqual(['2026-06-21', '2026-06-24', '2026-06-27', '2026-06-30']);
  });
});

describe('trocas de turno', () => {
  const period = makePeriod({ effectiveFrom: '2026-06-21' });

  it('folga remove um dia de trabalho', () => {
    const swaps: ShiftSwap[] = [
      { id: 's1', userId: 'u1', date: '2026-06-24', kind: 'folga', hours: null, note: null, createdAt: '' },
    ];
    expect(isWorkDay('2026-06-24', [period], swaps)).toBe(false);
  });

  it('extra_turno adiciona um dia de trabalho', () => {
    const swaps: ShiftSwap[] = [
      { id: 's2', userId: 'u1', date: '2026-06-22', kind: 'extra_turno', hours: '12', note: null, createdAt: '' },
    ];
    expect(isWorkDay('2026-06-22', [period], swaps)).toBe(true);
  });
});

describe('mudança de escala preserva passado', () => {
  // Até 30/06 escala 1x2x12h; a partir de 01/07 escala 1x1x8h.
  const periods: SchedulePeriod[] = [
    makePeriod({ id: 'p1', effectiveFrom: '2026-06-21', effectiveUntil: '2026-06-30' }),
    makePeriod({ id: 'p2', effectiveFrom: '2026-07-01', effectiveUntil: null, workDays: 1, restDays: 1, shiftHours: '8' }),
  ];

  it('getActivePeriod escolhe o período certo por data', () => {
    expect(getActivePeriod('2026-06-25', periods)?.id).toBe('p1');
    expect(getActivePeriod('2026-07-02', periods)?.id).toBe('p2');
  });

  it('o passado mantém o ciclo antigo', () => {
    expect(isWorkDay('2026-06-24', periods)).toBe(true); // ciclo 1x2 ancorado em 21
  });

  it('o futuro usa o novo ciclo 1x1', () => {
    // ancorado em 01/07: trabalha dias pares de offset (0,2,4...) -> 01, 03, 05
    expect(isWorkDay('2026-07-01', periods)).toBe(true);
    expect(isWorkDay('2026-07-02', periods)).toBe(false);
    expect(isWorkDay('2026-07-03', periods)).toBe(true);
  });
});

describe('sumHours', () => {
  const period = makePeriod({ effectiveFrom: '2026-06-01', shiftHours: '12' });

  it('soma turnos do mês + extras', () => {
    const extras: ExtraHour[] = [
      { id: 'e1', userId: 'u1', date: '2026-06-10', hours: '3', description: null, createdAt: '' },
    ];
    const summary = sumHours('2026-06-01', '2026-06-30', [period], [], extras);
    // junho tem 30 dias; ciclo de 3 ancorado em 01 -> dias 1,4,...,28 = 10 dias
    expect(summary.workDays).toBe(10);
    expect(summary.scheduled).toBe(120);
    expect(summary.extra).toBe(3);
    expect(summary.total).toBe(123);
  });

  it('getWorkDates respeita o intervalo', () => {
    const dates = getWorkDates('2026-06-01', '2026-06-07', [period]);
    expect(dates).toEqual(['2026-06-01', '2026-06-04', '2026-06-07']);
  });
});

describe('getDayStatus', () => {
  const period = makePeriod({ effectiveFrom: '2026-06-21', shiftHours: '12' });

  it('dia de trabalho do ciclo', () => {
    const s = getDayStatus('2026-06-21', [period]);
    expect(s.isWork).toBe(true);
    expect(s.shiftHours).toBe(12);
    expect(s.swap).toBeNull();
    expect(s.hasExtra).toBe(false);
  });

  it('dia de folga', () => {
    const s = getDayStatus('2026-06-22', [period]);
    expect(s.isWork).toBe(false);
    expect(s.shiftHours).toBe(0);
  });

  it('troca extra_turno marca trabalho com horas próprias', () => {
    const swaps: ShiftSwap[] = [
      { id: 's1', userId: 'u1', date: '2026-06-22', kind: 'extra_turno', hours: '6', note: null, createdAt: '' },
    ];
    const s = getDayStatus('2026-06-22', [period], swaps);
    expect(s.isWork).toBe(true);
    expect(s.shiftHours).toBe(6);
    expect(s.swap?.kind).toBe('extra_turno');
  });

  it('troca folga cancela um dia de trabalho', () => {
    const swaps: ShiftSwap[] = [
      { id: 's2', userId: 'u1', date: '2026-06-21', kind: 'folga', hours: null, note: null, createdAt: '' },
    ];
    const s = getDayStatus('2026-06-21', [period], swaps);
    expect(s.isWork).toBe(false);
    expect(s.shiftHours).toBe(0);
    expect(s.swap?.kind).toBe('folga');
  });

  it('hora extra avulsa soma e marca hasExtra', () => {
    const extras: ExtraHour[] = [
      { id: 'e1', userId: 'u1', date: '2026-06-22', hours: '3', description: null, createdAt: '' },
      { id: 'e2', userId: 'u1', date: '2026-06-22', hours: '2', description: null, createdAt: '' },
    ];
    const s = getDayStatus('2026-06-22', [period], [], extras);
    expect(s.hasExtra).toBe(true);
    expect(s.extraHours).toBe(5);
  });
});

describe('getMonthMatrix', () => {
  it('cobre o mês em semanas de 7 dias começando no domingo', () => {
    const weeks = getMonthMatrix('2026-06-15');
    // junho/2026: 1 é segunda -> grade começa no domingo 31/05.
    expect(weeks[0][0]).toBe('2026-05-31');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // último dia é sábado.
    const last = weeks[weeks.length - 1][6];
    expect(new Date(last + 'T00:00:00Z').getUTCDay()).toBe(6);
    // primeira coluna é sempre domingo.
    expect(weeks.every((w) => new Date(w[0] + 'T00:00:00Z').getUTCDay() === 0)).toBe(true);
    // contém todos os dias do mês.
    const flat = weeks.flat();
    expect(flat).toContain('2026-06-01');
    expect(flat).toContain('2026-06-30');
  });
});

describe('addMonths', () => {
  it('avança e recua ancorando no dia 1', () => {
    expect(addMonths('2026-06-15', 1)).toBe('2026-07-01');
    expect(addMonths('2026-01-10', -1)).toBe('2025-12-01');
    expect(addMonths('2026-12-31', 1)).toBe('2027-01-01');
  });
});
