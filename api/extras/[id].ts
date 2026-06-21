import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { requireUser } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = await requireUser(req, res);
  if (!session) return;

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const id = String(req.query.id);
  const deleted = await db
    .delete(schema.extraHours)
    .where(and(eq(schema.extraHours.id, id), eq(schema.extraHours.userId, session.sub)))
    .returning({ id: schema.extraHours.id });

  if (deleted.length === 0) {
    return res.status(404).json({ error: 'Registro não encontrado.' });
  }
  return res.status(200).json({ ok: true });
}
