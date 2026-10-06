import { and, eq, gt, isNull, lt, lte, or } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import type { SchedulePeriodRow } from '../../db/schema';

export interface PeriodInput {
  effectiveFrom: string;
  workDays: number;
  restDays: number;
  shiftHours: number;
  shiftStartTime: string | null;
}

/** Soma/subtrai dias de uma data 'YYYY-MM-DD' sem cair em armadilha de timezone. */
function shiftDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Formato YYYY-MM-DD e data real (rejeita 2026-02-31, que o Postgres recusaria com 500). */
export function isValidISODate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && shiftDate(value, 0) === value;
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' (para mensagens de erro). */
export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Valida os campos de uma escala vindos do body. */
export function parsePeriodInput(body: unknown): { value: PeriodInput } | { error: string } {
  const { effectiveFrom, workDays, restDays, shiftHours, shiftStartTime } = (body ?? {}) as {
    effectiveFrom?: unknown;
    workDays?: unknown;
    restDays?: unknown;
    shiftHours?: unknown;
    shiftStartTime?: unknown;
  };

  if (!isValidISODate(effectiveFrom)) {
    return { error: 'Data de início inválida (use YYYY-MM-DD).' };
  }
  const wd = Number(workDays);
  const rd = Number(restDays);
  const sh = Number(shiftHours);
  if (!Number.isInteger(wd) || wd < 1) {
    return { error: 'Dias de trabalho deve ser >= 1.' };
  }
  if (!Number.isInteger(rd) || rd < 0) {
    return { error: 'Dias de folga deve ser >= 0.' };
  }
  if (!Number.isFinite(sh) || sh <= 0 || sh > 24) {
    return { error: 'Horas por turno deve estar entre 0 e 24.' };
  }

  return {
    value: {
      effectiveFrom,
      workDays: wd,
      restDays: rd,
      shiftHours: sh,
      shiftStartTime: typeof shiftStartTime === 'string' ? shiftStartTime.trim() || null : null,
    },
  };
}

/**
 * Cria um período de escala para um emprego. Se esse MESMO emprego já tem uma escala aberta que
 * começou antes da nova data, ela é encerrada no dia anterior (mudança de escala preservando o
 * histórico). As escalas de outros empregos do usuário não são tocadas. neon-http não suporta
 * transações, então os passos são sequenciais.
 */
export async function createPeriod(
  userId: string,
  jobId: string,
  input: PeriodInput,
): Promise<SchedulePeriodRow> {
  await db
    .update(schema.schedulePeriods)
    .set({ effectiveUntil: shiftDate(input.effectiveFrom, -1) })
    .where(
      and(
        eq(schema.schedulePeriods.userId, userId),
        eq(schema.schedulePeriods.jobId, jobId),
        isNull(schema.schedulePeriods.effectiveUntil),
        lt(schema.schedulePeriods.effectiveFrom, input.effectiveFrom),
      ),
    );

  const [created] = await db
    .insert(schema.schedulePeriods)
    .values({
      userId,
      jobId,
      effectiveFrom: input.effectiveFrom,
      effectiveUntil: null,
      workDays: input.workDays,
      restDays: input.restDays,
      shiftHours: String(input.shiftHours),
      shiftStartTime: input.shiftStartTime,
    })
    .returning();
  return created;
}

/**
 * Início (primeira escala) e fim de um emprego. `end` só existe quando o emprego foi encerrado,
 * isto é, quando nenhuma escala dele está aberta: é o último `effectiveUntil`. `null` se não houver
 * escala nenhuma.
 */
export async function getJobLifetime(
  jobId: string,
): Promise<{ start: string; end: string | null } | null> {
  const rows = await db
    .select({
      from: schema.schedulePeriods.effectiveFrom,
      until: schema.schedulePeriods.effectiveUntil,
    })
    .from(schema.schedulePeriods)
    .where(eq(schema.schedulePeriods.jobId, jobId));
  if (rows.length === 0) return null;
  const start = rows.reduce((min, r) => (r.from < min ? r.from : min), rows[0].from);
  if (rows.some((r) => r.until == null)) return { start, end: null };
  const end = rows.reduce((max, r) => (r.until! > max ? r.until! : max), rows[0].until!);
  return { start, end };
}

/**
 * Mensagem de erro se o emprego já estiver encerrado em `date` (não se lança troca/hora extra num
 * trabalho depois da saída); `null` se pode lançar.
 */
export async function jobClosedOn(jobId: string, date: string): Promise<string | null> {
  const life = await getJobLifetime(jobId);
  if (life?.end && date > life.end) {
    return `Este trabalho foi encerrado em ${formatDateBR(life.end)}.`;
  }
  return null;
}

/**
 * Encerra um emprego: `endDate` é o último dia trabalhado nele. Tudo até essa data continua no
 * histórico. Depois dela: trocas desse emprego são removidas, mudanças de escala que só começariam
 * depois são descartadas e a escala que cobre a data passa a terminar nela. As horas extras não são
 * tocadas. Sem transações: as remoções vêm primeiro, para que uma falha no meio deixe o emprego
 * ainda aberto (e a operação possa ser repetida).
 */
export async function endJob(userId: string, jobId: string, endDate: string): Promise<void> {
  const { shiftSwaps: s, schedulePeriods: p } = schema;

  await db
    .delete(s)
    .where(and(eq(s.userId, userId), eq(s.jobId, jobId), gt(s.date, endDate)));
  await db
    .delete(p)
    .where(and(eq(p.userId, userId), eq(p.jobId, jobId), gt(p.effectiveFrom, endDate)));
  await db
    .update(p)
    .set({ effectiveUntil: endDate })
    .where(
      and(
        eq(p.userId, userId),
        eq(p.jobId, jobId),
        lte(p.effectiveFrom, endDate),
        or(isNull(p.effectiveUntil), gt(p.effectiveUntil, endDate)),
      ),
    );
}
