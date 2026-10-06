import { describe, it, expect } from 'vitest';
import {
  DEFAULT_JOB_COLOR,
  JOB_COLORS,
  dayClassNames,
  dayStyle,
  dayVisual,
  jobsActiveInRange,
  jobsAvailableOn,
  jobsBackground,
  readableTextColor,
  suggestJobColor,
  suggestJobForDay,
} from './jobs';
import { getDayStatus } from './schedule';
import type { Job, SchedulePeriod, ShiftSwap } from './types';

function makeJob(id: string, color: string, name = id): Job {
  return { id, userId: 'u1', name, color, createdAt: '2026-06-01T00:00:00.000Z' };
}

function makePeriod(p: Partial<SchedulePeriod> & Pick<SchedulePeriod, 'jobId'>): SchedulePeriod {
  return {
    id: p.id ?? `p-${p.jobId}`,
    userId: 'u1',
    jobId: p.jobId,
    effectiveFrom: p.effectiveFrom ?? '2026-06-21',
    effectiveUntil: p.effectiveUntil ?? null,
    workDays: p.workDays ?? 1,
    restDays: p.restDays ?? 2,
    shiftHours: p.shiftHours ?? '12',
    shiftStartTime: null,
    createdAt: '2026-06-01T00:00:00.000Z',
  };
}

function makeSwap(s: Pick<ShiftSwap, 'jobId' | 'date' | 'kind'>): ShiftSwap {
  return { id: `s-${s.jobId}-${s.date}`, userId: 'u1', hours: null, note: null, createdAt: '', ...s };
}

describe('paleta de cores', () => {
  it('cores válidas, sem repetição, começando pelo azul padrão', () => {
    const values = JOB_COLORS.map((c) => c.value);
    expect(values.every((v) => /^#[0-9a-f]{6}$/.test(v))).toBe(true);
    expect(new Set(values).size).toBe(values.length);
    expect(values[0]).toBe(DEFAULT_JOB_COLOR);
  });

  it('suggestJobColor sugere a primeira cor ainda não usada', () => {
    expect(suggestJobColor([])).toBe('#0a84ff');
    expect(suggestJobColor([makeJob('a', '#0a84ff')])).toBe('#34c759');
    // Comparação ignora maiúsculas/minúsculas.
    expect(suggestJobColor([makeJob('a', '#0A84FF')])).toBe('#34c759');
    // Todas usadas: volta ao padrão.
    expect(suggestJobColor(JOB_COLORS.map((c, i) => makeJob(String(i), c.value)))).toBe(
      DEFAULT_JOB_COLOR,
    );
  });
});

describe('readableTextColor', () => {
  it('branco sobre cores escuras/saturadas, preto sobre claras', () => {
    expect(readableTextColor('#0a84ff')).toBe('#ffffff');
    expect(readableTextColor('#000000')).toBe('#ffffff');
    expect(readableTextColor('#ffcc00')).toBe('#000000');
    expect(readableTextColor('#ffffff')).toBe('#000000');
  });

  it('aceita sem "#" e cai no branco se a cor for inválida', () => {
    expect(readableTextColor('ffffff')).toBe('#000000');
    expect(readableTextColor('azul')).toBe('#ffffff');
    expect(readableTextColor('#fff')).toBe('#ffffff');
  });
});

describe('jobsBackground', () => {
  it('uma cor pura; várias viram faixas diagonais iguais', () => {
    expect(jobsBackground([])).toBe(DEFAULT_JOB_COLOR);
    expect(jobsBackground(['#112233'])).toBe('#112233');
    expect(jobsBackground(['#111111', '#222222'])).toBe(
      'linear-gradient(135deg, #111111 0%, #111111 50%, #222222 50%, #222222 100%)',
    );
    const three = jobsBackground(['#111111', '#222222', '#333333']);
    expect(three).toContain('#111111 33.33%');
    expect(three).toContain('#222222 66.67%');
    expect(three).toContain('#333333 100%');
  });
});

describe('dayVisual', () => {
  // A (azul) 1x2 desde 21/06; B (amarelo) 1x1 desde 01/06 → 21: A+B, 23: só B, 24: só A, 22: folga.
  const jobs = [makeJob('jA', '#0a84ff', 'Hospital'), makeJob('jB', '#ffcc00', 'Clínica')];
  const periods = [
    makePeriod({ jobId: 'jB', effectiveFrom: '2026-06-01', workDays: 1, restDays: 1, shiftHours: '8' }),
    makePeriod({ jobId: 'jA', effectiveFrom: '2026-06-21' }),
  ];
  const visual = (iso: string, swaps: ShiftSwap[] = []) =>
    dayVisual(getDayStatus(iso, periods, swaps), jobs);

  it('folga: sem cor de fundo', () => {
    const v = visual('2026-06-22');
    expect(v.modifier).toBe('is-rest');
    expect(v.background).toBeNull();
    expect(dayStyle(v)).toBeUndefined();
    expect(dayClassNames(v)).toBe('is-rest');
  });

  it('um emprego: a cor dele, com texto legível', () => {
    const a = visual('2026-06-24');
    expect(a.modifier).toBe('is-work');
    expect(a.background).toBe('#0a84ff');
    expect(a.color).toBe('#ffffff');
    expect(a.multi).toBe(false);
    expect(a.shifts.map((s) => s.job?.name)).toEqual(['Hospital']);
    expect(dayStyle(a)).toEqual({ background: '#0a84ff', color: '#ffffff' });

    const b = visual('2026-06-23');
    expect(b.background).toBe('#ffcc00');
    expect(b.color).toBe('#000000');
  });

  it('dois empregos: faixas na ordem da lista de empregos', () => {
    const v = visual('2026-06-21');
    expect(v.modifier).toBe('is-work');
    expect(v.multi).toBe(true);
    // Os períodos vêm com B primeiro, mas a ordem visual segue `jobs` (A, depois B).
    expect(v.shifts.map((s) => s.job?.id)).toEqual(['jA', 'jB']);
    expect(v.background).toBe(jobsBackground(['#0a84ff', '#ffcc00']));
    // Fundos pedem textos diferentes (branco no azul, preto no amarelo): fica branco.
    expect(v.color).toBe('#ffffff');
    expect(dayClassNames(v)).toBe('is-work is-multi');
  });

  it('dia de trabalho cancelado por troca', () => {
    const v = visual('2026-06-24', [makeSwap({ jobId: 'jA', date: '2026-06-24', kind: 'folga' })]);
    expect(v.modifier).toBe('is-cancelled');
    expect(v.background).toBeNull();
  });

  it('cancelar um emprego num dia de dois deixa só a cor do outro', () => {
    const v = visual('2026-06-21', [makeSwap({ jobId: 'jA', date: '2026-06-21', kind: 'folga' })]);
    expect(v.modifier).toBe('is-work');
    expect(v.multi).toBe(false);
    expect(v.background).toBe('#ffcc00');
  });

  it('plantão por troca (extra_turno) ganha a marca de troca na cor do emprego', () => {
    const v = visual('2026-06-22', [makeSwap({ jobId: 'jA', date: '2026-06-22', kind: 'extra_turno' })]);
    expect(v.modifier).toBe('is-work');
    expect(v.hasSwap).toBe(true);
    expect(v.background).toBe('#0a84ff');
    expect(dayClassNames(v)).toBe('is-work has-swap');
  });

  it('emprego desconhecido (lista ainda carregando) usa a cor padrão', () => {
    const v = dayVisual(getDayStatus('2026-06-24', periods), []);
    expect(v.modifier).toBe('is-work');
    expect(v.background).toBe(DEFAULT_JOB_COLOR);
    expect(v.shifts[0].job).toBeNull();
  });
});

describe('empregos disponíveis e sugestão', () => {
  // A ativo (1x2 desde 21/06). B (1x1 desde 01/06) encerrado em 30/06.
  const jobs = [makeJob('jA', '#0a84ff'), makeJob('jB', '#ff9500')];
  const periods = [
    makePeriod({ jobId: 'jA', effectiveFrom: '2026-06-21' }),
    makePeriod({ jobId: 'jB', effectiveFrom: '2026-06-01', effectiveUntil: '2026-06-30', workDays: 1, restDays: 1 }),
  ];
  const ids = (list: Job[]) => list.map((j) => j.id);

  it('jobsAvailableOn tira os encerrados antes da data (até o último dia ainda pode lançar)', () => {
    expect(ids(jobsAvailableOn('2026-06-30', jobs, periods))).toEqual(['jA', 'jB']);
    expect(ids(jobsAvailableOn('2026-07-01', jobs, periods))).toEqual(['jA']);
  });

  it('jobsActiveInRange considera início e fim de cada emprego', () => {
    expect(ids(jobsActiveInRange('2026-06-01', '2026-06-30', jobs, periods))).toEqual(['jA', 'jB']);
    expect(ids(jobsActiveInRange('2026-07-01', '2026-07-31', jobs, periods))).toEqual(['jA']);
    // Antes de A começar, só B.
    expect(ids(jobsActiveInRange('2026-06-01', '2026-06-10', jobs, periods))).toEqual(['jB']);
  });

  it('suggestJobForDay prefere quem trabalha (ou quem folga) no dia, entre os disponíveis', () => {
    // 23/06: A de folga (offset 2), B trabalha (offset 22).
    expect(suggestJobForDay('2026-06-23', 'working', jobs, periods)).toBe('jB');
    expect(suggestJobForDay('2026-06-23', 'resting', jobs, periods)).toBe('jA');
    // 24/06: A trabalha, B de folga.
    expect(suggestJobForDay('2026-06-24', 'working', jobs, periods)).toBe('jA');
    // Depois do encerramento de B, só A é sugerido — mesmo pedindo "quem folga".
    expect(suggestJobForDay('2026-07-02', 'resting', jobs, periods)).toBe('jA');
    expect(suggestJobForDay('2026-07-02', 'working', jobs, periods)).toBe('jA');
    expect(suggestJobForDay('2026-07-02', 'working', [], periods)).toBeUndefined();
  });
});
