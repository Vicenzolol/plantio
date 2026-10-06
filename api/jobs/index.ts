import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { requireUser } from '../_lib/auth';
import { isUuid, parseJobColor, parseJobName } from '../_lib/jobs';
import {
  createPeriod,
  endJob,
  formatDateBR,
  getJobLifetime,
  isValidISODate,
  parsePeriodInput,
} from '../_lib/periods';

/**
 * Empregos do usuário. PATCH/DELETE e a ação de encerrar recebem o id por query
 * (`/api/jobs?id=...`) em vez de arquivos próprios: cada arquivo em `api/` vira uma função na
 * Vercel, e o plano Hobby limita a 12 funções por deploy.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = await requireUser(req, res);
  if (!session) return;
  const userId = session.sub;
  const id = String(req.query.id ?? '');

  // Encerra o emprego ("saí deste trabalho") mantendo o histórico até o último dia.
  if (req.method === 'POST' && req.query.action === 'end') {
    const [job] = isUuid(id)
      ? await db
          .select({ id: schema.jobs.id })
          .from(schema.jobs)
          .where(and(eq(schema.jobs.id, id), eq(schema.jobs.userId, userId)))
          .limit(1)
      : [];
    if (!job) {
      return res.status(404).json({ error: 'Emprego não encontrado.' });
    }
    const { endDate } = (req.body ?? {}) as { endDate?: unknown };
    if (!isValidISODate(endDate)) {
      return res.status(400).json({ error: 'Data de encerramento inválida (use YYYY-MM-DD).' });
    }
    const life = await getJobLifetime(job.id);
    if (!life) {
      return res.status(400).json({ error: 'Este trabalho não tem escala.' });
    }
    if (endDate < life.start) {
      return res.status(400).json({
        error: `A data é anterior ao início deste trabalho (${formatDateBR(life.start)}).`,
      });
    }
    // Já encerrado: só aceita antecipar a data (para estender, retoma-se com uma nova escala).
    if (life.end && endDate >= life.end) {
      return res
        .status(400)
        .json({ error: `Este trabalho já foi encerrado em ${formatDateBR(life.end)}.` });
    }

    await endJob(userId, job.id, endDate);
    return res.status(200).json({ ok: true, endDate });
  }

  if (req.method === 'GET') {
    const rows = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.userId, userId))
      .orderBy(asc(schema.jobs.createdAt), asc(schema.jobs.id));
    return res.status(200).json({ jobs: rows });
  }

  // Cria o emprego já com a sua primeira escala.
  if (req.method === 'POST') {
    const body = (req.body ?? {}) as { name?: unknown; color?: unknown; schedule?: unknown };
    const name = parseJobName(body.name);
    if (!name) {
      return res.status(400).json({ error: 'Informe o nome do trabalho (até 40 caracteres).' });
    }
    const color = parseJobColor(body.color);
    if (!color) {
      return res.status(400).json({ error: 'Cor inválida.' });
    }
    const parsed = parsePeriodInput(body.schedule);
    if (!('value' in parsed)) {
      return res.status(400).json({ error: parsed.error });
    }

    const [job] = await db.insert(schema.jobs).values({ userId, name, color }).returning();
    try {
      const period = await createPeriod(userId, job.id, parsed.value);
      return res.status(201).json({ job, period });
    } catch (err) {
      // Sem transações no neon-http: desfaz o emprego para não deixá-lo sem escala.
      await db.delete(schema.jobs).where(eq(schema.jobs.id, job.id));
      throw err;
    }
  }

  if (req.method === 'PATCH') {
    if (!isUuid(id)) {
      return res.status(404).json({ error: 'Emprego não encontrado.' });
    }
    const body = (req.body ?? {}) as { name?: unknown; color?: unknown };
    const patch: { name?: string; color?: string } = {};
    if (body.name !== undefined) {
      const name = parseJobName(body.name);
      if (!name) {
        return res.status(400).json({ error: 'Informe o nome do trabalho (até 40 caracteres).' });
      }
      patch.name = name;
    }
    if (body.color !== undefined) {
      const color = parseJobColor(body.color);
      if (!color) {
        return res.status(400).json({ error: 'Cor inválida.' });
      }
      patch.color = color;
    }
    if (patch.name === undefined && patch.color === undefined) {
      return res.status(400).json({ error: 'Nada para atualizar.' });
    }

    const [updated] = await db
      .update(schema.jobs)
      .set(patch)
      .where(and(eq(schema.jobs.id, id), eq(schema.jobs.userId, userId)))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: 'Emprego não encontrado.' });
    }
    return res.status(200).json({ job: updated });
  }

  // Exclui o emprego junto com sua escala, trocas e horas extras (cascade). O último emprego não
  // pode sair. Para manter o histórico, o caminho é encerrar (action=end).
  if (req.method === 'DELETE') {
    const userJobs = isUuid(id)
      ? await db
          .select({ id: schema.jobs.id })
          .from(schema.jobs)
          .where(eq(schema.jobs.userId, userId))
      : [];
    if (!userJobs.some((j) => j.id === id)) {
      return res.status(404).json({ error: 'Emprego não encontrado.' });
    }
    if (userJobs.length <= 1) {
      return res.status(400).json({ error: 'Você precisa ter pelo menos um trabalho cadastrado.' });
    }

    await db
      .delete(schema.jobs)
      .where(and(eq(schema.jobs.id, id), eq(schema.jobs.userId, userId)));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
