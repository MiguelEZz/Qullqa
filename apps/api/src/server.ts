import { buildApp } from './app.ts';
import { migrate } from './db.ts';

const applied = await migrate();
const app = await buildApp();
if (applied.length) app.log.info({ applied }, 'migraciones aplicadas');

const port = Number(process.env.API_PORT ?? 3000);
// 0.0.0.0 para que Caddy (en docker) llegue vía host.docker.internal
await app.listen({ host: '0.0.0.0', port });
