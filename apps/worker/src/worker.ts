/**
 * Worker del cerebro: toma corridas en cola (tabla runs), arma el snapshot inmutable,
 * ejecuta runCommunity y guarda el resultado. Varios workers pueden correr a la vez (SKIP LOCKED).
 */
import postgres from 'postgres';
import { ASSUMPTIONS, CROPS } from '@qullqa/catalog';
import { ENGINE_VERSION, makeSnapshot, runCommunity } from '@qullqa/engine';
import type { EngineInput } from '@qullqa/shared';
import { loadValley } from './valleys.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL no está definida (revisa .env)');
const sql = postgres(url, { max: 3, onnotice: () => {} });
const log = (msg: string, extra: Record<string, unknown> = {}) => console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));

type Job = { id: string; community_id: string; valley_id: string; seed: number; input: EngineInput };

async function claim(): Promise<Job | null> {
  const [job] = await sql<Job[]>`
    update runs set status = 'running', started_at = now()
    where id = (select id from runs where status = 'queued' order by created_at for update skip locked limit 1)
    returning id, community_id, valley_id, seed, input`;
  return job ?? null;
}

async function runJob(job: Job) {
  const t0 = performance.now();
  try {
    const valley = loadValley(job.valley_id);
    const snap = makeSnapshot(job.input, valley, CROPS, ASSUMPTIONS, job.seed);
    const result = runCommunity(snap);
    const ms = Math.round(performance.now() - t0);
    // Snapshot: la entrada ya está en runs.input; aquí guardamos versiones, catálogo y supuestos usados.
    const meta = { engineVersion: ENGINE_VERSION, valleyId: valley.id, valleyVersion: valley.version, seed: job.seed, crops: snap.crops, assumptions: snap.assumptions };
    await sql`
      update runs set status = 'done', result = ${sql.json(result as never)}, snapshot_meta = ${sql.json(meta as never)},
        duration_ms = ${ms}, finished_at = now()
      where id = ${job.id}`;
    await sql`select pg_notify('qullqa_run_done', ${job.community_id})`;
    log('corrida lista', { run: job.id, ms, participants: result.participants.length });
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    log('corrida falló', { run: job.id, error: (err as Error).message });
    await sql`update runs set status = 'failed', error = ${(err as Error).message.slice(0, 500)}, duration_ms = ${ms}, finished_at = now() where id = ${job.id}`;
  }
}

let busy = false;
async function drain() {
  if (busy) return;
  busy = true;
  try {
    for (let job = await claim(); job; job = await claim()) await runJob(job);
  } catch (err) {
    log('error leyendo la cola', { error: (err as Error).message });
  } finally {
    busy = false;
  }
}

// Si el worker murió a mitad de una corrida, vuelve a la cola.
const reset = await sql`update runs set status = 'queued', started_at = null where status = 'running' returning id`;
if (reset.length) log('corridas reencoladas tras reinicio', { n: reset.length });

await sql.listen('qullqa_runs', () => void drain());
setInterval(() => void drain(), 5000); // respaldo por si se pierde una notificación
log('worker listo', { engine: ENGINE_VERSION });
void drain();

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await sql.end({ timeout: 5 });
    process.exit(0);
  });
}
