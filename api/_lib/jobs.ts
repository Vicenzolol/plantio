import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import type { JobRow } from '../../db/schema';

export const DEFAULT_JOB_NAME = 'Trabalho principal';
export const DEFAULT_JOB_COLOR = '#0a84ff';
const JOB_NAME_MAX = 40;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

/** Evita mandar ao Postgres um id malformado (que estouraria como erro 500). */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Nome do emprego normalizado, ou `null` se inválido. */
export function parseJobName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length > 0 && name.length <= JOB_NAME_MAX ? name : null;
}

/** Cor `#rrggbb` normalizada em minúsculas, ou `null` se inválida. */
export function parseJobColor(value: unknown): string | null {
  return typeof value === 'string' && COLOR_RE.test(value) ? value.toLowerCase() : null;
}

/**
 * Emprego do usuário pelo id. Sem `jobId` (cliente antigo, de antes dos múltiplos empregos), usa o
 * emprego mais antigo do usuário — e, com `createIfMissing`, cria o emprego padrão se não houver
 * nenhum. Retorna `null` se o id for inválido ou não pertencer ao usuário.
 */
export async function findUserJob(
  userId: string,
  jobId: unknown,
  { createIfMissing = false }: { createIfMissing?: boolean } = {},
): Promise<JobRow | null> {
  if (jobId != null && jobId !== '') {
    if (!isUuid(jobId)) return null;
    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.userId, userId)))
      .limit(1);
    return job ?? null;
  }

  const [oldest] = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.userId, userId))
    .orderBy(asc(schema.jobs.createdAt), asc(schema.jobs.id))
    .limit(1);
  if (oldest || !createIfMissing) return oldest ?? null;

  const [created] = await db
    .insert(schema.jobs)
    .values({ userId, name: DEFAULT_JOB_NAME, color: DEFAULT_JOB_COLOR })
    .returning();
  return created;
}
