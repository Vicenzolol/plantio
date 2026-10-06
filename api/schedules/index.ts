import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { requireUser } from '../_lib/auth';
import { findUserJob } from '../_lib/jobs';
import { createPeriod, parsePeriodInput } from '../_lib/periods';

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
    const parsed = parsePeriodInput(req.body);
    if (!('value' in parsed)) {
      return res.status(400).json({ error: parsed.error });
    }

    // Sem jobId (cliente antigo) cai no emprego mais antigo, criando o padrão se não houver.
    const job = await findUserJob(userId, (req.body ?? {}).jobId, { createIfMissing: true });
    if (!job) {
      return res.status(404).json({ error: 'Emprego não encontrado.' });
    }

    const created = await createPeriod(userId, job.id, parsed.value);
    return res.status(201).json({ period: created });
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
