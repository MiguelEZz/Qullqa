import type { FastifyInstance } from 'fastify';
import { PreferencesBody } from '@qullqa/shared';
import { sql } from '../db.ts';
import { clearSubmission, parse, requireMember, requireUser, uuidParam } from '../http.ts';

/** Prioridades y restricciones: PRIVADAS. Solo el dueño las lee; el cerebro las recibe vía EngineInput. */
export async function preferenceRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/api/communities/:id/preferences', async (req) => {
    const s = await requireUser(req);
    const cid = uuidParam(req.params.id);
    await requireMember(s.sub, cid);
    const [row] = await sql<{ coins: unknown; constraints: unknown; vetoes: string[] }[]>`
      select coins, constraints, vetoes from preferences where user_id = ${s.sub} and community_id = ${cid}`;
    return row ? { coins: row.coins, constraints: row.constraints, vetoes: row.vetoes } : null;
  });

  app.put<{ Params: { id: string } }>('/api/communities/:id/preferences', async (req) => {
    const s = await requireUser(req);
    const cid = uuidParam(req.params.id);
    await requireMember(s.sub, cid);
    const body = parse(PreferencesBody, req.body);
    await sql`
      insert into preferences (user_id, community_id, coins, constraints, vetoes)
      values (${s.sub}, ${cid}, ${sql.json(body.coins)}, ${sql.json(body.constraints)}, ${body.vetoes})
      on conflict (user_id, community_id) do update
        set coins = excluded.coins, constraints = excluded.constraints, vetoes = excluded.vetoes, updated_at = now()`;
    await clearSubmission(s.sub, cid);
    return body;
  });
}
