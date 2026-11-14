import type { FastifyInstance } from 'fastify';
import { CreateCommunityBody, JoinBody, type CommunityView, type LonLat, type Readiness } from '@qullqa/shared';
import { sql } from '../db.ts';
import { HttpError, parse, requireMember, requireUser, uuidParam } from '../http.ts';
import { joinCode } from '../security.ts';

/** Piloto: corredor agrícola Chivay–Yanque–Coporaque (valle del Colca). */
export const DEFAULT_CENTER: LonLat = [-71.635, -15.64];

export async function readinessFor(userId: string, communityId: string): Promise<Readiness> {
  const [r] = await sql<{ parcels: number; prefs: number; submitted_at: Date | null }[]>`
    select
      (select count(*)::int from parcels where owner_id = ${userId} and community_id = ${communityId}) as parcels,
      (select count(*)::int from preferences where user_id = ${userId} and community_id = ${communityId}) as prefs,
      (select submitted_at from memberships where user_id = ${userId} and community_id = ${communityId}) as submitted_at`;
  const types = await sql<{ type: string }[]>`
    select distinct o.type from observations o join parcels p on p.id = o.parcel_id
    where p.owner_id = ${userId} and p.community_id = ${communityId}`;
  const hasParcel = (r?.parcels ?? 0) > 0;
  const preferencesSaved = (r?.prefs ?? 0) > 0;
  return {
    hasParcel,
    rotationsComplete: hasParcel, // la rotación es obligatoria al crear la parcela
    preferencesSaved,
    observationTypes: types.map((t) => t.type),
    canSubmit: hasParcel && preferencesSaved,
    submittedAt: r?.submitted_at ? r.submitted_at.toISOString() : null,
  };
}

export async function communityRoutes(app: FastifyInstance) {
  app.post('/api/communities', async (req) => {
    const s = await requireUser(req);
    const body = parse(CreateCommunityBody, req.body);
    const [lon, lat] = body.center ?? DEFAULT_CENTER;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = joinCode();
      const [c] = await sql<{ id: string }[]>`
        insert into communities (name, join_code, center, created_by)
        values (${body.name}, ${code}, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography, ${s.sub})
        on conflict (join_code) do nothing returning id`;
      if (c) {
        await sql`insert into memberships (user_id, community_id, role) values (${s.sub}, ${c.id}, 'coordinator')`;
        return { id: c.id, joinCode: code };
      }
    }
    throw new HttpError(500, 'No se pudo generar un código de comunidad');
  });

  app.post('/api/communities/join', async (req) => {
    const s = await requireUser(req);
    const { code } = parse(JoinBody, req.body);
    const [c] = await sql<{ id: string; name: string }[]>`select id, name from communities where join_code = ${code}`;
    if (!c) throw new HttpError(404, 'No existe una comunidad con ese código');
    await sql`insert into memberships (user_id, community_id, role) values (${s.sub}, ${c.id}, 'member')
              on conflict do nothing`;
    return { id: c.id, name: c.name };
  });

  /** Vista pública para miembros: agregados + geometrías. Nunca preferencias ni observaciones ajenas. */
  app.get<{ Params: { id: string } }>('/api/communities/:id', async (req): Promise<CommunityView> => {
    const s = await requireUser(req);
    const id = uuidParam(req.params.id);
    const myRole = await requireMember(s.sub, id);
    const [c] = await sql<{ id: string; name: string; join_code: string; lon: number; lat: number; members: number; submitted: number }[]>`
      select c.id, c.name, c.join_code,
        ST_X(c.center::geometry) as lon, ST_Y(c.center::geometry) as lat,
        (select count(*)::int from memberships where community_id = c.id) as members,
        (select count(*)::int from memberships where community_id = c.id and submitted_at is not null) as submitted
      from communities c where c.id = ${id}`;
    if (!c) throw new HttpError(404, 'Comunidad no encontrada');
    const parcels = await sql<{ id: string; geo: { coordinates: LonLat[][] }; area_ha: number; mine: boolean }[]>`
      select id, ST_AsGeoJSON(polygon)::json as geo, ST_Area(polygon) / 10000 as area_ha, owner_id = ${s.sub} as mine
      from parcels where community_id = ${id} order by created_at`;
    return {
      id: c.id,
      name: c.name,
      joinCode: c.join_code,
      center: [c.lon, c.lat],
      myRole,
      memberCount: c.members,
      submittedCount: c.submitted,
      parcels: parcels.map((p) => ({
        id: p.id,
        ring: (p.geo.coordinates[0] ?? []).slice(0, -1),
        areaHa: Math.round(p.area_ha * 1000) / 1000,
        mine: p.mine,
      })),
    };
  });

  app.get<{ Params: { id: string } }>('/api/communities/:id/readiness', async (req) => {
    const s = await requireUser(req);
    const id = uuidParam(req.params.id);
    await requireMember(s.sub, id);
    return readinessFor(s.sub, id);
  });

  /** «Enviar mis datos»: marca al agricultor como listo para la próxima corrida del cerebro. */
  app.post<{ Params: { id: string } }>('/api/communities/:id/submit', async (req) => {
    const s = await requireUser(req);
    const id = uuidParam(req.params.id);
    await requireMember(s.sub, id);
    const r = await readinessFor(s.sub, id);
    if (!r.canSubmit) throw new HttpError(400, 'Falta registrar al menos una parcela y tus prioridades');
    await sql`update memberships set submitted_at = now() where user_id = ${s.sub} and community_id = ${id}`;
    return readinessFor(s.sub, id);
  });
}
