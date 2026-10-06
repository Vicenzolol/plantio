import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { requireUser } from '../_lib/auth';
import { findUserJob } from '../_lib/jobs';
import { isValidISODate, jobClosedOn } from '../_lib/periods';

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
    const { jobId, date, hours, description } = (req.body ?? {}) as {
      jobId?: string;
      date?: string;
      hours?: number;
      description?: string | null;
    };

    if (!isValidISODate(date)) {
      return res.status(400).json({ error: 'Data inválida (use YYYY-MM-DD).' });
    }
    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0 || h > 24) {
      return res.status(400).json({ error: 'Horas deve estar entre 0 e 24.' });
    }

    // A hora extra pertence a um emprego (sem jobId, cliente antigo: o emprego mais antigo).
    const job = await findUserJob(userId, jobId);
    if (!job) {
      return res.status(404).json({ error: 'Emprego não encontrado.' });
    }
    const closed = await jobClosedOn(job.id, date);
    if (closed) {
      return res.status(400).json({ error: closed });
    }

    const [created] = await db
      .insert(schema.extraHours)
      .values({ userId, jobId: job.id, date, hours: String(h), description: description?.trim() || null })
      .returning();

    return res.status(201).json({ extra: created });
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
