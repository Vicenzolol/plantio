import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, eq, isNull, lt, desc } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { requireUser } from '../_lib/auth';

/** Soma/subtrai dias de uma data 'YYYY-MM-DD' sem cair em armadilha de timezone. */
function shiftDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = await requireUser(req, res);
  if (!session) return;
  const userId = session.sub;

  if (req.method === 'GET') {
    const rows = await db
      .select()
      .from(schema.schedulePeriods)
      .where(eq(schema.schedulePeriods.userId, userId))
      .orderBy(desc(schema.schedulePeriods.effectiveFrom));
    return res.status(200).json({ periods: rows });
  }

  if (req.method === 'POST') {
    const { effectiveFrom, workDays, restDays, shiftHours, shiftStartTime } = (req.body ??
      {}) as {
      effectiveFrom?: string;
      workDays?: number;
      restDays?: number;
      shiftHours?: number;
      shiftStartTime?: string | null;
    };

    if (!effectiveFrom || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      return res.status(400).json({ error: 'Data de início inválida (use YYYY-MM-DD).' });
    }
    const wd = Number(workDays);
    const rd = Number(restDays);
    const sh = Number(shiftHours);
    if (!Number.isFinite(wd) || wd < 1) {
      return res.status(400).json({ error: 'Dias de trabalho deve ser >= 1.' });
    }
    if (!Number.isFinite(rd) || rd < 0) {
      return res.status(400).json({ error: 'Dias de folga deve ser >= 0.' });
    }
    if (!Number.isFinite(sh) || sh <= 0 || sh > 24) {
      return res.status(400).json({ error: 'Horas por turno deve estar entre 0 e 24.' });
    }

    // Encerra a escala aberta anterior que começou antes da nova data (mudança de escala),
    // preservando o histórico. neon-http não suporta transações, então fazemos sequencial.
    await db
      .update(schema.schedulePeriods)
      .set({ effectiveUntil: shiftDate(effectiveFrom, -1) })
      .where(
        and(
          eq(schema.schedulePeriods.userId, userId),
          isNull(schema.schedulePeriods.effectiveUntil),
          lt(schema.schedulePeriods.effectiveFrom, effectiveFrom),
        ),
      );

    const [created] = await db
      .insert(schema.schedulePeriods)
      .values({
        userId,
        effectiveFrom,
        effectiveUntil: null,
        workDays: wd,
        restDays: rd,
        shiftHours: String(sh),
        shiftStartTime: shiftStartTime?.trim() || null,
      })
      .returning();

    return res.status(201).json({ period: created });
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
