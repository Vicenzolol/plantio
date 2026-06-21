import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { hashPassword, signSession, setSessionCookie } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { name, email, password } = (req.body ?? {}) as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    return res.status(409).json({ error: 'Este email já está cadastrado.' });
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(schema.users)
    .values({ name: name.trim(), email: normalizedEmail, passwordHash })
    .returning({ id: schema.users.id, name: schema.users.name, email: schema.users.email });

  const token = await signSession({ sub: user.id, email: user.email, name: user.name });
  setSessionCookie(res, token);

  return res.status(201).json({ user });
}
