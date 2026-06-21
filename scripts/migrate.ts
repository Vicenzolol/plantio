import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definida.');

  const sql = neon(url);
  const db = drizzle(sql);

  console.log('Aplicando migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations aplicadas com sucesso.');
}

main().catch((err) => {
  console.error('Falha ao migrar:', err);
  process.exit(1);
});
