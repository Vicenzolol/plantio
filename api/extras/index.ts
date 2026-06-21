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
      .from(schema.extraHours)
      .where(eq(schema.extraHours.userId, userId))
      .orderBy(desc(schema.extraHours.date));
    return res.status(200).json({ extras: rows });
  }

  if (req.method === 'POST') {
    const { date, hours, description } = (req.body ?? {}) as {
      date?: string;
      hours?: number;
      description?: string | null;
    };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Data inválida (use YYYY-MM-DD).' });
    }
    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0 || h > 24) {
      return res.status(400).json({ error: 'Horas deve estar entre 0 e 24.' });
    }

    const [created] = await db
      .insert(schema.extraHours)
      .values({ userId, date, hours: String(h), description: description?.trim() || null })
      .returning();

    return res.status(201).json({ extra: created });
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
