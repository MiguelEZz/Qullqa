import type { FastifyInstance } from 'fastify';
import { privateView, type PlanView } from '@qullqa/engine';
import { sql } from '../db.ts';
import { buildEngineInput } from '../engineInput.ts';
import { HttpError, requireMember, requireUser, uuidParam } from '../http.ts';

export interface PlanResponse {
  hasValleyData: boolean;
  submittedCount: number;
  /** Corrida en cola o en curso (si hay). */
  pending: { id: string; status: 'queued' | 'running'; createdAt: string } | null;
  /** Última corrida terminada, filtrada para este agricultor. */
  latest: { id: string; createdAt: string; finishedAt: string; durationMs: number; view: PlanView } | null;
  lastError: string | null;
  /** Alguien envió o cambió datos después de la última corrida. */
  stale: boolean;
}

/**
 * Encola un cálculo con los datos enviados. Si ya hay uno en cola, se actualiza su entrada
 * (así varios envíos seguidos producen una sola corrida). El cerebro corre en el worker.
 */
export async function enqueueRun(communityId: string, requestedBy: string | null): Promise<{ id: string } | null> {
  const [c] = await sql<{ valley_id: string | null }[]>`select valley_id from communities where id = ${communityId}`;
  if (!c?.valley_id) return null;
  const input = await buildEngineInput(communityId);
  const ready = input.participants.filter((p) => p.preferences && p.parcels.length);
  if (!ready.length) return null;
  const [queued] = await sql<{ id: string }[]>`
    update runs set input = ${sql.json(input as never)}, requested_by = ${requestedBy}
    where community_id = ${communityId} and status = 'queued' returning id`;
  if (queued) return queued;
  const seed = Math.floor(Math.random() * 2 ** 31); // queda guardada: la corrida es reproducible
  const [run] = await sql<{ id: string }[]>`
    insert into runs (community_id, requested_by, valley_id, seed, input)
    values (${communityId}, ${requestedBy}, ${c.valley_id}, ${seed}, ${sql.json(input as never)}) returning id`;
  await sql`select pg_notify('qullqa_runs', ${communityId})`;
  return run!;
}

export async function runRoutes(app: FastifyInstance) {
  /** «Calcular el plan»: cualquier miembro puede pedirlo; entran quienes enviaron sus datos. */
  app.post<{ Params: { id: string } }>('/api/communities/:id/runs', async (req) => {
    const s = await requireUser(req);
    const id = uuidParam(req.params.id);
    await requireMember(s.sub, id);
    const [c] = await sql<{ valley_id: string | null }[]>`select valley_id from communities where id = ${id}`;
    if (!c?.valley_id) throw new HttpError(409, 'Todavía no tenemos los datos NASA de esta zona para calcular el plan.');
    const run = await enqueueRun(id, s.sub);
    if (!run) throw new HttpError(409, 'Nadie ha enviado sus datos todavía. Envía los tuyos primero.');
    return run;
  });

  app.get<{ Params: { id: string } }>('/api/communities/:id/plan', async (req): Promise<PlanResponse> => {
    const s = await requireUser(req);
    const id = uuidParam(req.params.id);
    await requireMember(s.sub, id);
    const [c] = await sql<{ valley_id: string | null; submitted: number; last_submit: Date | null }[]>`
      select valley_id,
        (select count(*)::int from memberships where community_id = c.id and submitted_at is not null) as submitted,
        (select max(submitted_at) from memberships where community_id = c.id) as last_submit
      from communities c where c.id = ${id}`;
    const [pending] = await sql<{ id: string; status: 'queued' | 'running'; created_at: Date }[]>`
      select id, status, created_at from runs where community_id = ${id} and status in ('queued', 'running') order by created_at limit 1`;
    const [done] = await sql<{ id: string; created_at: Date; finished_at: Date; duration_ms: number; result: Parameters<typeof privateView>[0] }[]>`
      select id, created_at, finished_at, duration_ms, result from runs where community_id = ${id} and status = 'done'
      order by created_at desc limit 1`;
    const [failed] = await sql<{ error: string; created_at: Date }[]>`
      select error, created_at from runs where community_id = ${id} and status = 'failed' order by created_at desc limit 1`;
    return {
      hasValleyData: !!c?.valley_id,
      submittedCount: c?.submitted ?? 0,
      pending: pending ? { id: pending.id, status: pending.status, createdAt: pending.created_at.toISOString() } : null,
      latest: done
        ? { id: done.id, createdAt: done.created_at.toISOString(), finishedAt: done.finished_at.toISOString(), durationMs: done.duration_ms, view: privateView(done.result, s.sub) }
        : null,
      lastError: failed && (!done || failed.created_at > done.created_at) ? 'El último cálculo falló. Vuelve a intentarlo.' : null,
      stale: !!done && !!c?.last_submit && c.last_submit > done.created_at,
    };
  });
}
