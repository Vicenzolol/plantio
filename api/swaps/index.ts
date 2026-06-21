import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { requireUser } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = await requireUser(req, res);
  if (!session) return;
  const userId = session.sub;

  if (req.method === 'GET') {
    const rows = await db
      .select()
      .from(schema.shiftSwaps)
      .where(eq(schema.shiftSwaps.userId, userId))
      .orderBy(desc(schema.shiftSwaps.date));
    return res.status(200).json({ swaps: rows });
  }

  if (req.method === 'POST') {
    const { date, kind, hours, note } = (req.body ?? {}) as {
      date?: string;
      kind?: string;
      hours?: number | null;
      note?: string | null;
    };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Data inválida (use YYYY-MM-DD).' });
    }
    if (kind !== 'folga' && kind !== 'extra_turno') {
      return res.status(400).json({ error: 'Tipo de troca inválido.' });
    }
    let hoursValue: string | null = null;
    if (hours != null) {
      const h = Number(hours);
      if (!Number.isFinite(h) || h <= 0 || h > 24) {
        return res.status(400).json({ error: 'Horas deve estar entre 0 e 24.' });
      }
      hoursValue = String(h);
    }

    const [created] = await db
      .insert(schema.shiftSwaps)
      .values({ userId, date, kind, hours: hoursValue, note: note?.trim() || null })
      .returning();

    return res.status(201).json({ swap: created });
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
