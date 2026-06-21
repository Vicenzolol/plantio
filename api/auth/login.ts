import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { verifyPassword, signSession, setSessionCookie } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };

  if (!email?.trim() || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, normalizedEmail))
    .limit(1);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Email ou senha inválidos.' });
  }

  const token = await signSession({ sub: user.id, email: user.email, name: user.name });
  setSessionCookie(res, token);

  return res.status(200).json({
    user: { id: user.id, name: user.name, email: user.email },
  });
}
