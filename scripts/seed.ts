import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';

/**
 * Cria o usuário admin padrão caso ainda não exista.
 * A senha inicial deve ser trocada depois.
 */
const SEED_USERS = [
  { name: 'Admin', email: 'admin@plantio.app', password: 'admin123' },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definida.');

  const sql = neon(url);
  const db = drizzle(sql, { schema });

  for (const u of SEED_USERS) {
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, u.email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`• ${u.email} já existe — pulando.`);
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, 10);
    await db.insert(schema.users).values({
      name: u.name,
      email: u.email,
      passwordHash,
    });
    console.log(`✓ Criado ${u.email} (senha: ${u.password})`);
  }

  console.log('Seed concluído.');
}

main().catch((err) => {
  console.error('Falha no seed:', err);
  process.exit(1);
});
