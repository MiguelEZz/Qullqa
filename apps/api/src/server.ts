import Fastify from 'fastify';
import type { HealthResponse } from '@qullqa/shared';
import { sql } from './db.ts';

const app = Fastify({ logger: { level: 'info' }, trustProxy: true });

app.get('/api/health', async (): Promise<HealthResponse> => {
  let db: HealthResponse['db'] = { ok: false, postgis: null };
  try {
    const [row] = await sql<{ v: string }[]>`select postgis_lib_version() as v`;
    db = { ok: true, postgis: row?.v ?? null };
  } catch (err) {
    app.log.error(err, 'db health check failed');
  }
  return { ok: db.ok, service: 'qullqa-api', db, time: new Date().toISOString() };
});

const port = Number(process.env.API_PORT ?? 3000);
// 0.0.0.0 para que Caddy (en docker) llegue vía host.docker.internal
await app.listen({ host: '0.0.0.0', port });
