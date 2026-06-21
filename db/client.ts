import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL não definida. Configure-a no .env (local) ou nas env vars da Vercel.');
}

const sql = neon(databaseUrl);

export const db = drizzle(sql, { schema });
export { schema };
