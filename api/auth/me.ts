import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { readSession } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = await readSession(req);
  if (!session) {
    return res.status(200).json({ user: null });
  }

  // Confirma se há pelo menos uma escala cadastrada (decide o fluxo de "primeiro acesso").
  const periods = await db
    .select({ id: schema.schedulePeriods.id })
    .from(schema.schedulePeriods)
    .where(eq(schema.schedulePeriods.userId, session.sub))
    .limit(1);

  return res.status(200).json({
    user: { id: session.sub, name: session.name, email: session.email },
    hasSchedule: periods.length > 0,
  });
}
