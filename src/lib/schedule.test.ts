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
  getShiftsForDay,
  shiftHoursForDay,
  swapsForDate,
  jobLifetime,
  jobEndDate,
} from './schedule';
import type { SchedulePeriod, ShiftSwap, ExtraHour } from './types';

function makePeriod(p: Partial<SchedulePeriod>): SchedulePeriod {
  return {
    id: p.id ?? 'p1',
    userId: 'u1',
    jobId: p.jobId ?? 'j1',
    effectiveFrom: p.effectiveFrom ?? '2026-06-21',
    effectiveUntil: p.effectiveUntil ?? null,
    workDays: p.workDays ?? 1,
    restDays: p.restDays ?? 2,
    shiftHours: p.shiftHours ?? '12',
    shiftStartTime: p.shiftStartTime ?? null,
    createdAt: p.createdAt ?? '2026-06-21T00:00:00Z',
  };
}

function makeExtra(e: Partial<ExtraHour> & Pick<ExtraHour, 'date' | 'hours'>): ExtraHour {
  return {
    id: e.id ?? `e-${e.date}`,
    userId: 'u1',
    jobId: e.jobId ?? 'j1',
    date: e.date,
    hours: e.hours,
    description: e.description ?? null,
    createdAt: '',
  };
}

function makeSwap(s: Partial<ShiftSwap> & Pick<ShiftSwap, 'date' | 'kind'>): ShiftSwap {
  return {
    id: s.id ?? `s-${s.date}-${s.kind}`,
    userId: 'u1',
    jobId: s.jobId ?? 'j1',
    date: s.date,
    kind: s.kind,
    hours: s.hours ?? null,
    note: s.note ?? null,
    createdAt: '',
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
    const swaps = [makeSwap({ date: '2026-06-24', kind: 'folga' })];
    expect(isWorkDay('2026-06-24', [period], swaps)).toBe(false);
  });

  it('extra_turno adiciona um dia de trabalho', () => {
    const swaps = [makeSwap({ date: '2026-06-22', kind: 'extra_turno', hours: '12' })];
    expect(isWorkDay('2026-06-22', [period], swaps)).toBe(true);
  });

  it('extra_turno sem horas próprias usa as horas do turno da escala', () => {
    const swaps = [makeSwap({ date: '2026-06-22', kind: 'extra_turno' })];
    expect(shiftHoursForDay('2026-06-22', [period], swaps)).toBe(12);
  });

  it('shiftHoursForDay é 0 numa folga', () => {
    expect(shiftHoursForDay('2026-06-22', [period])).toBe(0);
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
    const extras = [makeExtra({ date: '2026-06-10', hours: '3' })];
    const summary = sumHours('2026-06-01', '2026-06-30', [period], [], extras);
    // junho tem 30 dias; ciclo de 3 ancorado em 01 -> dias 1,4,...,28 = 10 dias
    expect(summary.workDays).toBe(10);
    expect(summary.scheduled).toBe(120);
    expect(summary.extra).toBe(3);
    expect(summary.total).toBe(123);
    expect(summary.byJob).toEqual({ j1: { scheduled: 120, extra: 3, workDays: 10 } });
  });

  it('intervalo invertido não soma nada', () => {
    const summary = sumHours('2026-06-30', '2026-06-01', [period]);
    expect(summary).toEqual({ scheduled: 0, extra: 0, total: 0, workDays: 0, byJob: {} });
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
    expect(s.shifts).toEqual([{ jobId: 'j1', hours: 12, swap: null }]);
    expect(s.swaps).toEqual([]);
    expect(s.hasExtra).toBe(false);
  });

  it('dia de folga', () => {
    const s = getDayStatus('2026-06-22', [period]);
    expect(s.isWork).toBe(false);
    expect(s.shiftHours).toBe(0);
    expect(s.shifts).toEqual([]);
  });

  it('troca extra_turno marca trabalho com horas próprias', () => {
    const swaps = [makeSwap({ date: '2026-06-22', kind: 'extra_turno', hours: '6' })];
    const s = getDayStatus('2026-06-22', [period], swaps);
    expect(s.isWork).toBe(true);
    expect(s.shiftHours).toBe(6);
    expect(s.swaps[0]?.kind).toBe('extra_turno');
    expect(s.shifts[0]?.swap?.kind).toBe('extra_turno');
  });

  it('troca folga cancela um dia de trabalho', () => {
    const swaps = [makeSwap({ date: '2026-06-21', kind: 'folga' })];
    const s = getDayStatus('2026-06-21', [period], swaps);
    expect(s.isWork).toBe(false);
    expect(s.shiftHours).toBe(0);
    expect(s.swaps[0]?.kind).toBe('folga');
  });

  it('hora extra avulsa soma e marca hasExtra', () => {
    const extras = [
      makeExtra({ id: 'e1', date: '2026-06-22', hours: '3' }),
      makeExtra({ id: 'e2', date: '2026-06-22', hours: '2' }),
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

describe('getActivePeriod — empate na mesma data de início', () => {
  // Ex.: a pessoa cadastrou a escala e logo "mudou" para corrigir, com a mesma data.
  const older = makePeriod({ id: 'old', effectiveFrom: '2026-07-01', createdAt: '2026-07-01T10:00:00.000Z' });
  const newer = makePeriod({
    id: 'new',
    effectiveFrom: '2026-07-01',
    createdAt: '2026-07-01T11:00:00.000Z',
    workDays: 1,
    restDays: 1,
    shiftHours: '6',
  });

  it('vence o criado por último, independente da ordem do array', () => {
    expect(getActivePeriod('2026-07-05', [older, newer])?.id).toBe('new');
    expect(getActivePeriod('2026-07-05', [newer, older])?.id).toBe('new');
  });
});

describe('múltiplos empregos', () => {
  // Emprego A: 1x2 de 12h desde 21/06 (dom). Emprego B: 1x1 de 8h desde 01/06 (começou ANTES).
  //   dia:  21  22  23  24  25  26  27
  //   A:    T   .   .   T   .   .   T
  //   B:    T   .   T   .   T   .   T
  const pA = makePeriod({ id: 'pA', jobId: 'jA', effectiveFrom: '2026-06-21', shiftHours: '12' });
  const pB = makePeriod({
    id: 'pB',
    jobId: 'jB',
    effectiveFrom: '2026-06-01',
    workDays: 1,
    restDays: 1,
    shiftHours: '8',
  });
  // Mesma ordem que a API devolve (effectiveFrom desc).
  const periods = [pA, pB];

  it('a escala mais recente de um emprego não esconde a do outro', () => {
    // Com um único getActivePeriod para todos os períodos, o emprego A "taparia" o B a partir
    // de 21/06 e o dia 23 viraria folga.
    expect(getShiftsForDay('2026-06-23', periods)).toEqual([{ jobId: 'jB', hours: 8, swap: null }]);
    expect(isWorkDay('2026-06-23', periods)).toBe(true);
    expect(isWorkDay('2026-06-25', periods)).toBe(true);
  });

  it('cada emprego segue o próprio ciclo', () => {
    expect(getShiftsForDay('2026-06-24', periods).map((s) => s.jobId)).toEqual(['jA']);
    expect(getShiftsForDay('2026-06-22', periods)).toEqual([]);
    expect(getShiftsForDay('2026-06-26', periods)).toEqual([]);
    // Antes de A começar, só B.
    expect(getShiftsForDay('2026-06-19', periods).map((s) => s.jobId)).toEqual(['jB']);
    expect(getShiftsForDay('2026-06-20', periods)).toEqual([]);
  });

  it('dois empregos no mesmo dia: os dois plantões e as horas somadas', () => {
    expect(getShiftsForDay('2026-06-21', periods)).toEqual([
      { jobId: 'jA', hours: 12, swap: null },
      { jobId: 'jB', hours: 8, swap: null },
    ]);
    expect(shiftHoursForDay('2026-06-21', periods)).toBe(20);
    const s = getDayStatus('2026-06-21', periods);
    expect(s.isWork).toBe(true);
    expect(s.shiftHours).toBe(20);
    expect(s.shifts).toHaveLength(2);
  });

  it('próximos dias de trabalho combinam os dois empregos', () => {
    expect(getUpcomingWorkDates('2026-06-21', 4, periods)).toEqual([
      '2026-06-21',
      '2026-06-23',
      '2026-06-24',
      '2026-06-25',
    ]);
    expect(getWorkDates('2026-06-21', '2026-06-27', periods)).toEqual([
      '2026-06-21',
      '2026-06-23',
      '2026-06-24',
      '2026-06-25',
      '2026-06-27',
    ]);
  });

  it('sumHours soma os empregos e detalha por emprego', () => {
    const summary = sumHours('2026-06-21', '2026-06-27', periods);
    // A: 21, 24, 27 = 36h · B: 21, 23, 25, 27 = 32h
    expect(summary.scheduled).toBe(68);
    expect(summary.total).toBe(68);
    // Dias distintos: 21, 23, 24, 25, 27 (21 e 27 têm os dois empregos, mas contam 1 dia).
    expect(summary.workDays).toBe(5);
    expect(summary.byJob).toEqual({
      jA: { scheduled: 36, extra: 0, workDays: 3 },
      jB: { scheduled: 32, extra: 0, workDays: 4 },
    });
  });

  it('horas extras somam no total e no emprego em que foram lançadas', () => {
    const extras = [
      makeExtra({ id: 'x1', jobId: 'jA', date: '2026-06-22', hours: '2' }),
      makeExtra({ id: 'x2', jobId: 'jB', date: '2026-06-23', hours: '1.5' }),
      makeExtra({ id: 'x3', jobId: 'jB', date: '2026-07-10', hours: '9' }), // fora do intervalo
    ];
    const summary = sumHours('2026-06-21', '2026-06-27', periods, [], extras);
    expect(summary.extra).toBe(3.5);
    expect(summary.total).toBe(71.5);
    expect(summary.byJob.jA).toEqual({ scheduled: 36, extra: 2, workDays: 3 });
    expect(summary.byJob.jB).toEqual({ scheduled: 32, extra: 1.5, workDays: 4 });
  });

  it('hora extra de um emprego sem plantão no intervalo também aparece no detalhamento', () => {
    const extras = [makeExtra({ jobId: 'jC', date: '2026-06-22', hours: '4' })];
    const summary = sumHours('2026-06-21', '2026-06-27', periods, [], extras);
    expect(summary.byJob.jC).toEqual({ scheduled: 0, extra: 4, workDays: 0 });
    expect(summary.workDays).toBe(5); // hora extra avulsa não conta como dia de plantão
  });

  it('folga num emprego não cancela o plantão do outro no mesmo dia', () => {
    const swaps = [makeSwap({ jobId: 'jA', date: '2026-06-21', kind: 'folga' })];
    expect(getShiftsForDay('2026-06-21', periods, swaps)).toEqual([
      { jobId: 'jB', hours: 8, swap: null },
    ]);
    expect(isWorkDay('2026-06-21', periods, swaps)).toBe(true);
    // E uma folga de A num dia em que só B trabalha não muda nada.
    const swaps23 = [makeSwap({ jobId: 'jA', date: '2026-06-23', kind: 'folga' })];
    expect(getShiftsForDay('2026-06-23', periods, swaps23).map((s) => s.jobId)).toEqual(['jB']);
  });

  it('extra_turno sem horas usa as horas do turno do PRÓPRIO emprego', () => {
    const swaps = [makeSwap({ jobId: 'jB', date: '2026-06-22', kind: 'extra_turno' })];
    const shifts = getShiftsForDay('2026-06-22', periods, swaps);
    expect(shifts).toHaveLength(1);
    expect(shifts[0].jobId).toBe('jB');
    expect(shifts[0].hours).toBe(8); // não os 12h do emprego A
    expect(shifts[0].swap?.kind).toBe('extra_turno');
  });

  it('extra_turno num emprego soma ao plantão normal do outro', () => {
    const swaps = [makeSwap({ jobId: 'jA', date: '2026-06-23', kind: 'extra_turno' })];
    expect(shiftHoursForDay('2026-06-23', periods, swaps)).toBe(20);
    const summary = sumHours('2026-06-21', '2026-06-27', periods, swaps);
    expect(summary.byJob.jA).toEqual({ scheduled: 48, extra: 0, workDays: 4 });
    expect(summary.workDays).toBe(5); // o dia 23 já contava (B)
  });

  it('troca de um emprego sem escala ainda conta com as horas próprias', () => {
    const swaps = [makeSwap({ jobId: 'jC', date: '2026-06-22', kind: 'extra_turno', hours: '5' })];
    expect(getShiftsForDay('2026-06-22', periods, swaps)).toEqual([
      { jobId: 'jC', hours: 5, swap: swaps[0] },
    ]);
  });

  it('swapsForDate devolve as trocas do dia de todos os empregos', () => {
    const swaps = [
      makeSwap({ jobId: 'jA', date: '2026-06-21', kind: 'folga' }),
      makeSwap({ jobId: 'jB', date: '2026-06-21', kind: 'folga' }),
      makeSwap({ jobId: 'jB', date: '2026-06-22', kind: 'extra_turno' }),
    ];
    expect(swapsForDate('2026-06-21', swaps)).toHaveLength(2);
    // As duas folgas cancelam o dia inteiro.
    expect(isWorkDay('2026-06-21', periods, swaps)).toBe(false);
  });

  describe('encerrar um emprego', () => {
    // A: 1x2 de 21/06 a 30/06, depois 1x1 de 01/07 até o último dia, 15/07 (encerrado).
    const ended = [
      makePeriod({ id: 'pA1', jobId: 'jA', effectiveFrom: '2026-06-21', effectiveUntil: '2026-06-30' }),
      makePeriod({
        id: 'pA2',
        jobId: 'jA',
        effectiveFrom: '2026-07-01',
        effectiveUntil: '2026-07-15',
        workDays: 1,
        restDays: 1,
      }),
      pB,
    ];

    it('jobLifetime: início na 1ª escala, fim no último dia só quando nada está aberto', () => {
      expect(jobLifetime('jA', ended)).toEqual({ start: '2026-06-21', end: '2026-07-15' });
      expect(jobEndDate('jA', ended)).toBe('2026-07-15');
      expect(jobLifetime('jB', ended)).toEqual({ start: '2026-06-01', end: null });
      expect(jobEndDate('jB', ended)).toBeNull();
      // Com a mudança de escala (período antigo fechado + novo aberto), o emprego segue ativo.
      expect(jobEndDate('jA', periods)).toBeNull();
      expect(jobLifetime('sem-escala', ended)).toBeNull();
    });

    it('o passado continua contando e depois do último dia o emprego some', () => {
      // 15/07: offset 14 no ciclo 1x1 → último plantão de A (B também trabalha nesse dia).
      expect(getShiftsForDay('2026-07-15', ended).map((s) => s.jobId)).toEqual(['jA', 'jB']);
      // 17/07 seria plantão de A (offset 16), mas ele foi encerrado; B segue normal.
      expect(getShiftsForDay('2026-07-17', ended).map((s) => s.jobId)).toEqual(['jB']);
      const june = sumHours('2026-06-01', '2026-06-30', ended);
      expect(june.byJob.jA.workDays).toBe(4); // 21, 24, 27, 30
      const after = sumHours('2026-07-16', '2026-07-31', ended);
      expect(after.byJob.jA).toBeUndefined();
    });

    it('retomar (nova escala aberta) reativa o emprego a partir da nova data', () => {
      const resumed = [
        ...ended,
        makePeriod({ id: 'pA3', jobId: 'jA', effectiveFrom: '2026-08-01', shiftHours: '6' }),
      ];
      expect(jobEndDate('jA', resumed)).toBeNull();
      expect(getShiftsForDay('2026-07-20', resumed).map((s) => s.jobId)).toEqual([]); // intervalo
      expect(getShiftsForDay('2026-08-01', resumed).find((s) => s.jobId === 'jA')?.hours).toBe(6);
    });
  });

  it('mudar a escala de um emprego não afeta o outro', () => {
    // A muda em 01/07 para 2x2 de 6h (período antigo encerrado em 30/06, como a API faz).
    const changed = [
      makePeriod({ id: 'pA2', jobId: 'jA', effectiveFrom: '2026-07-01', workDays: 2, restDays: 2, shiftHours: '6' }),
      makePeriod({ id: 'pA1', jobId: 'jA', effectiveFrom: '2026-06-21', effectiveUntil: '2026-06-30' }),
      pB,
    ];
    // Passado de A intacto.
    expect(getShiftsForDay('2026-06-24', changed).map((s) => s.jobId)).toEqual(['jA']);
    // Futuro de A no ciclo novo; B continua no dele (01/07 = offset 30 de B → trabalha).
    expect(getShiftsForDay('2026-07-01', changed)).toEqual([
      { jobId: 'jA', hours: 6, swap: null },
      { jobId: 'jB', hours: 8, swap: null },
    ]);
    expect(getShiftsForDay('2026-07-02', changed)).toEqual([{ jobId: 'jA', hours: 6, swap: null }]);
    expect(getShiftsForDay('2026-07-03', changed)).toEqual([{ jobId: 'jB', hours: 8, swap: null }]);
  });
});
