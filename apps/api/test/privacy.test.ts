/**
 * Privacidad: cada agricultor solo ve SU información; la vista comunitaria solo trae agregados.
 * Corre contra la base real (docker) con usuarios de prueba que se borran al final.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { migrate, sql } from '../src/db.ts';
import { buildEngineInput } from '../src/engineInput.ts';

let app: FastifyInstance;
const phones: string[] = [];
let communityId = '';
let joinCode = '';

// Dos parcelas vecinas en el corredor Chivay–Yanque (≈ 30 m × 30 m cada una)
const ringA: [number, number][] = [[-71.6352, -15.6402], [-71.6349, -15.6402], [-71.6349, -15.6399], [-71.6352, -15.6399]];
const ringB: [number, number][] = [[-71.6348, -15.6402], [-71.6345, -15.6402], [-71.6345, -15.6399], [-71.6348, -15.6399]];

const coins = { water: 2, climateRisk: 2, organicMatter: 1, nitrogen: 1, erosion: 1, pestHealth: 1, income: 1, forage: 1 };
const constraints = { traction: 'yunta', familyWorkers: 3, canGetExtraLabor: true, market: 'mixto', livestockHeads: 4 };
const irrigation = { source: 'canal', turnsPerMonth: 2, hoursPerTurn: 3 };

async function register(name: string) {
  const phone = `9${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  phones.push(phone);
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { name, phone, pin: '1234' } });
  expect(res.statusCode).toBe(200);
  const cookie = res.cookies.find((c) => c.name === 'qullqa_session')!;
  return { id: res.json().id as string, headers: { cookie: `qullqa_session=${cookie.value}` } };
}

let alice: Awaited<ReturnType<typeof register>>;
let bruno: Awaited<ReturnType<typeof register>>;
let carla: Awaited<ReturnType<typeof register>>; // no pertenece a la comunidad
let parcelA = '';
let obsA = '';

beforeAll(async () => {
  await migrate();
  app = await buildApp({ logger: false });
  alice = await register('Test Alice');
  bruno = await register('Test Bruno');
  carla = await register('Test Carla');

  const c = await app.inject({ method: 'POST', url: '/api/communities', headers: alice.headers, payload: { name: 'Test Yanque' } });
  communityId = c.json().id;
  joinCode = c.json().joinCode;
  const j = await app.inject({ method: 'POST', url: '/api/communities/join', headers: bruno.headers, payload: { code: joinCode } });
  expect(j.statusCode).toBe(200);

  const base = { communityId, captureMethod: 'draw', irrigation, currentRotation: ['papa', 'haba', 'cebada'] };
  const pa = await app.inject({ method: 'POST', url: '/api/parcels', headers: alice.headers, payload: { ...base, name: 'Chacra de Alice', ring: ringA } });
  expect(pa.statusCode).toBe(200);
  parcelA = pa.json().id;
  const pb = await app.inject({ method: 'POST', url: '/api/parcels', headers: bruno.headers, payload: { ...base, name: 'Chacra de Bruno', ring: ringB } });
  expect(pb.statusCode).toBe(200);

  for (const u of [alice, bruno]) {
    const r = await app.inject({ method: 'PUT', url: `/api/communities/${communityId}/preferences`, headers: u.headers, payload: { coins, constraints, vetoes: ['tarwi'] } });
    expect(r.statusCode).toBe(200);
  }
  const o = await app.inject({
    method: 'POST', url: `/api/parcels/${parcelA}/observations`, headers: alice.headers,
    payload: { value: { type: 'soil_moisture', fistTest: 'seco' }, lat: -15.64, lon: -71.635, accuracyM: 5, observedAt: new Date().toISOString(), photo: null },
  });
  expect(o.statusCode).toBe(200);
  obsA = o.json().id;
});

afterAll(async () => {
  if (communityId) await sql`delete from communities where id = ${communityId}`;
  await sql`delete from users where phone in ${sql(phones)}`;
  await app?.close();
  await sql.end();
});

describe('privacidad entre agricultores', () => {
  it('la vista comunitaria no contiene preferencias, nombres de parcela, observaciones ni teléfonos', async () => {
    const r = await app.inject({ method: 'GET', url: `/api/communities/${communityId}`, headers: bruno.headers });
    expect(r.statusCode).toBe(200);
    const text = r.body;
    expect(r.json().parcels).toHaveLength(2);
    for (const leak of ['coins', 'constraints', 'vetoes', 'tarwi', 'Chacra de Alice', 'soil_moisture', 'Test Alice', ...phones]) {
      expect(text).not.toContain(leak);
    }
    const mine = r.json().parcels.filter((p: { mine: boolean }) => p.mine);
    expect(mine).toHaveLength(1);
  });

  it('nadie puede leer, editar ni borrar la parcela de otro (404, sin revelar que existe)', async () => {
    for (const [method, url] of [
      ['GET', `/api/parcels/${parcelA}`],
      ['PATCH', `/api/parcels/${parcelA}`],
      ['DELETE', `/api/parcels/${parcelA}`],
      ['GET', `/api/parcels/${parcelA}/observations`],
      ['POST', `/api/parcels/${parcelA}/observations`],
      ['GET', `/api/observations/${obsA}/photo`],
      ['DELETE', `/api/observations/${obsA}`],
    ] as const) {
      const r = await app.inject({ method, url, headers: bruno.headers, payload: method === 'PATCH' ? { name: 'x' } : method === 'POST' ? {} : undefined });
      expect([400, 404], `${method} ${url}`).toContain(r.statusCode);
      expect(r.body).not.toContain('Chacra de Alice');
    }
  });

  it('las preferencias que devuelve la API son solo las propias', async () => {
    await app.inject({ method: 'PUT', url: `/api/communities/${communityId}/preferences`, headers: bruno.headers, payload: { coins: { ...coins, income: 3, forage: 0, organicMatter: 0 }, constraints, vetoes: [] } });
    const a = await app.inject({ method: 'GET', url: `/api/communities/${communityId}/preferences`, headers: alice.headers });
    expect(a.json().vetoes).toEqual(['tarwi']);
    expect(a.json().coins.income).toBe(1);
  });

  it('un no-miembro no ve nada de la comunidad', async () => {
    for (const url of [`/api/communities/${communityId}`, `/api/communities/${communityId}/preferences`, `/api/communities/${communityId}/my-parcels`, `/api/communities/${communityId}/readiness`]) {
      const r = await app.inject({ method: 'GET', url, headers: carla.headers });
      expect(r.statusCode, url).toBe(403);
    }
  });

  it('sin sesión todo responde 401', async () => {
    const r = await app.inject({ method: 'GET', url: `/api/communities/${communityId}` });
    expect(r.statusCode).toBe(401);
  });
});

describe('datos listos para el cerebro', () => {
  it('enviar marca al agricultor y el EngineInput solo trae a quienes enviaron', async () => {
    const s = await app.inject({ method: 'POST', url: `/api/communities/${communityId}/submit`, headers: alice.headers });
    expect(s.statusCode).toBe(200);
    expect(s.json().submittedAt).not.toBeNull();

    const input = await buildEngineInput(communityId);
    expect(input.participants).toHaveLength(1);
    const p = input.participants[0]!;
    expect(p.preferences?.vetoes).toEqual(['tarwi']);
    expect(p.parcels[0]!.observations[0]!.provenance).toBe('observed');
    expect(p.parcels[0]!.areaHa).toBeGreaterThan(0.05);
    // B está a ~10 m de A → vecinos
    const all = await buildEngineInput(communityId, { includeUnsubmitted: true });
    expect(all.participants).toHaveLength(2);
    expect(all.participants[0]!.parcels[0]!.neighborIds).toHaveLength(1);
  });

  it('editar la parcela obliga a reenviar', async () => {
    await app.inject({ method: 'PATCH', url: `/api/parcels/${parcelA}`, headers: alice.headers, payload: { name: 'Chacra de Alice 2' } });
    const r = await app.inject({ method: 'GET', url: `/api/communities/${communityId}/readiness`, headers: alice.headers });
    expect(r.json().submittedAt).toBeNull();
  });

  it('rechaza un contorno inválido o lejos del valle', async () => {
    const base = { communityId, captureMethod: 'draw', irrigation, currentRotation: ['papa', 'haba', 'cebada'], name: 'x' };
    const bowtie = [[-71.6352, -15.6402], [-71.6349, -15.6399], [-71.6349, -15.6402], [-71.6352, -15.6399]];
    const r1 = await app.inject({ method: 'POST', url: '/api/parcels', headers: alice.headers, payload: { ...base, ring: bowtie } });
    expect(r1.statusCode).toBe(400);
    const lima = [[-77.03, -12.04], [-77.029, -12.04], [-77.029, -12.039]];
    const r2 = await app.inject({ method: 'POST', url: '/api/parcels', headers: alice.headers, payload: { ...base, ring: lima } });
    expect(r2.statusCode).toBe(400);
  });
});
