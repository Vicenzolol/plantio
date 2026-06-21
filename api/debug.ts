import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    const jwtSecret = process.env.JWT_SECRET;

    return res.status(200).json({
      hasDbUrl: !!dbUrl,
      dbUrlPrefix: dbUrl ? dbUrl.substring(0, 40) + '...' : null,
      hasJwtSecret: !!jwtSecret,
      nodeVersion: process.version,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
