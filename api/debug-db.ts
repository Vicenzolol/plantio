import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const { db, schema } = await import('../db/client');
    const result = await db.select().from(schema.users).limit(1);
    return res.status(200).json({ ok: true, userCount: result.length });
  } catch (err) {
    return res.status(500).json({ error: String(err), stack: err instanceof Error ? err.stack : undefined });
  }
}
