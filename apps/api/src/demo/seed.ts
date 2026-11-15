import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import type { Coins, Constraints, ObservationValue } from '@qullqa/shared';
import { sql } from '../db.ts';
import { hashPin } from '../security.ts';

/**
 * Comunidad DEMO (simulada) para probar el cerebro de punta a punta: 10 familias SINTÉTICAS con 20 parcelas
 * en 5 sectores de andenes reales (puntos con cultivo según ESA WorldCover, altura NASA SRTM; ver parcels.json).
 * Todo queda marcado is_demo: no entra en las estadísticas reales, nadie puede ingresar con estas cuentas
 * (el teléfono no es válido) y solo un administrador puede «ver como» una de estas familias.
 */
export const DEMO_SLUG = 'demo-colca';

const points = (JSON.parse(readFileSync(new URL('./parcels.json', import.meta.url), 'utf8')) as { points: { lonLat: [number, number]; elevationM: number; slopeDeg: number }[] }).points;

/** Sectores: índice del punto con cultivo en parcels.json. 4 parcelas pegadas por sector (vecinas entre sí). */
const SECTORS = [
  { name: 'Yanque bajo', point: 5, irrigated: true },
  { name: 'Centro del corredor', point: 11, irrigated: true },
  { name: 'Chivay oeste', point: 18, irrigated: true },
  { name: 'Coporaque', point: 8, irrigated: true },
  { name: 'Coporaque alto', point: 12, irrigated: true }, // los andenes del Colca tienen canal; arriba, menos turnos
] as const;

type Rot = [string, string, string];
interface Family {
  name: string;
  coins: Partial<Coins>;
  constraints: Constraints;
  vetoes: string[];
  /** [sector, posición 0–3 en el sector, rotación de las 3 últimas campañas] */
  parcels: [number, number, Rot][];
}

const C = (traction: Constraints['traction'], familyWorkers: number, canGetExtraLabor: boolean, market: Constraints['market'], livestockHeads: number): Constraints =>
  ({ traction, familyWorkers, canGetExtraLabor, market, livestockHeads });

// Perfiles variados a propósito: comerciales, ganaderos, conservacionistas, adversos al riesgo.
// La papa domina (como en el valle real): así se ve el efecto de coordinar sobre plagas y precio.
const FAMILIES: Family[] = [
  { name: 'Familia Quispe', coins: { income: 5, climateRisk: 2, water: 2, pestHealth: 1 }, constraints: C('yunta', 3, true, 'feria_local', 4), vetoes: [],
    parcels: [[0, 0, ['papa', 'haba', 'papa']], [0, 1, ['papa', 'papa', 'cebada']]] },
  { name: 'Familia Mamani', coins: { forage: 4, income: 2, water: 2, organicMatter: 2 }, constraints: C('yunta', 2, true, 'mixto', 14), vetoes: ['olluco'],
    parcels: [[0, 2, ['cebada', 'papa', 'haba']], [1, 0, ['avena_forrajera', 'papa', 'papa']]] },
  { name: 'Familia Huamaní', coins: { erosion: 3, organicMatter: 3, nitrogen: 2, water: 2 }, constraints: C('manual', 2, false, 'autoconsumo', 3), vetoes: [],
    parcels: [[0, 3, ['papa', 'haba', 'descanso']], [1, 1, ['quinua', 'papa', 'haba']]] },
  { name: 'Familia Condori', coins: { climateRisk: 4, water: 3, income: 2, pestHealth: 1 }, constraints: C('yunta', 4, true, 'autoconsumo', 6), vetoes: [],
    parcels: [[1, 2, ['papa', 'papa', 'haba']], [1, 3, ['maiz_amilaceo', 'papa', 'papa']]] },
  { name: 'Familia Cutipa', coins: { income: 6, pestHealth: 2, water: 2 }, constraints: C('tractor', 2, true, 'intermediario', 0), vetoes: ['tarwi'],
    parcels: [[2, 0, ['papa', 'papa', 'papa']], [2, 1, ['papa', 'haba', 'papa']]] },
  { name: 'Familia Ccama', coins: { income: 2, climateRisk: 2, water: 2, organicMatter: 2, forage: 2 }, constraints: C('yunta', 3, true, 'mixto', 8), vetoes: [],
    parcels: [[2, 2, ['maiz_amilaceo', 'haba', 'papa']], [2, 3, ['haba', 'papa', 'cebada']]] },
  { name: 'Familia Choque', coins: { climateRisk: 3, water: 3, nitrogen: 2, organicMatter: 2 }, constraints: C('manual', 1, false, 'autoconsumo', 2), vetoes: ['maiz_amilaceo'],
    parcels: [[3, 0, ['papa', 'oca', 'haba']], [3, 1, ['olluco', 'papa', 'haba']]] },
  { name: 'Familia Taco', coins: { income: 4, water: 2, erosion: 2, forage: 2 }, constraints: C('yunta', 2, true, 'feria_local', 5), vetoes: [],
    parcels: [[3, 2, ['papa', 'haba', 'papa']], [3, 3, ['cebada', 'papa', 'papa']]] },
  { name: 'Familia Huaracha', coins: { forage: 5, climateRisk: 3, erosion: 2 }, constraints: C('yunta', 3, true, 'autoconsumo', 20), vetoes: [],
    parcels: [[4, 0, ['papa', 'cebada', 'descanso']], [4, 1, ['avena_forrajera', 'papa', 'cebada']]] },
  { name: 'Familia Llica', coins: { pestHealth: 4, income: 3, water: 3 }, constraints: C('manual', 3, true, 'feria_local', 4), vetoes: [],
    parcels: [[4, 2, ['papa', 'haba', 'papa']], [4, 3, ['oca', 'papa', 'papa']]] },
];

const fullCoins = (c: Partial<Coins>): Coins => ({ water: 0, climateRisk: 0, organicMatter: 0, nitrogen: 0, erosion: 0, pestHealth: 0, income: 0, forage: 0, ...c });

/** Rectángulo de ~60 × 50 m (0,3 ha); 4 por sector en una cuadrícula 2 × 2 que se toca. */
function parcelRing([lon, lat]: [number, number], pos: number): [number, number][] {
  const w = 60 / (111_320 * Math.cos((lat * Math.PI) / 180)), h = 50 / 110_574;
  const x0 = lon + (pos % 2 === 0 ? -w : 0), y0 = lat + (pos < 2 ? 0 : -h);
  return [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h], [x0, y0]];
}

/** Observaciones de campo sintéticas pero plausibles (heladas más arriba, cosechas, prueba del puño, pendiente). */
function observationsFor(sector: number, pos: number, rot: Rot, f: number): { value: ObservationValue; daysAgo: number }[] {
  const pt = points[SECTORS[sector]!.point]!;
  const out: { value: ObservationValue; daysAgo: number }[] = [];
  out.push({ value: { type: 'slope', slopeDeg: Math.round((pt.slopeDeg + (pos - 1.5) * 0.8) * 10) / 10 + 2, aspectDeg: 180 + pos * 15 }, daysAgo: 20 + pos });
  out.push({ value: { type: 'soil_moisture', fistTest: SECTORS[sector]!.irrigated ? (pos % 2 ? 'humedo' : 'seco') : 'seco' }, daysAgo: 3 + f });
  if (rot[2] !== 'descanso' && (f + pos) % 2 === 0) {
    const tha: Record<string, number> = { papa: 11, haba: 2.2, cebada: 2.4, maiz_amilaceo: 2.6, quinua: 1.6, oca: 7, olluco: 6, avena_forrajera: 9 };
    const kgHa = (tha[rot[2]] ?? 3) * 1000 * (sector === 4 ? 0.75 : 1) * (0.85 + ((f * 7 + pos * 3) % 10) / 33);
    out.push({ value: { type: 'harvest', crop: rot[2] as never, kg: Math.round(kgHa * 0.3), areaM2: 3000, harvestDate: '2026-05-20' }, daysAgo: 178 });
  }
  if (sector >= 3) out.push({ value: { type: 'frost', severity: sector === 4 ? 'moderada' : 'leve', minTempC: sector === 4 ? -4.5 : -2, damagedCrop: rot[2] === 'descanso' ? null : (rot[2] as never) }, daysAgo: 230 + pos });
  if (sector === 4 && pos >= 2) out.push({ value: { type: 'erosion', level: 1 }, daysAgo: 40 });
  if (pos === 0) out.push({ value: { type: 'green_cover', fraction: 0.18 + sector * 0.04, otsuThreshold: 21, method: 'ExG+Otsu' }, daysAgo: 6 });
  return out;
}

/** Borra y vuelve a crear la comunidad demo con todos sus datos enviados. Devuelve su id. */
export async function seedDemoCommunity(now = new Date()): Promise<string> {
  const center = points[SECTORS[1]!.point]!.lonLat;
  return sql.begin(async (tx) => {
    await tx`delete from communities where slug = ${DEMO_SLUG}`;
    await tx`delete from users where is_demo`;
    const [c] = await tx<{ id: string }[]>`
      insert into communities (slug, name, district, province, region, altitude_m, valley_id, listed, is_demo, center)
      values (${DEMO_SLUG}, 'Demo: andenes Chivay–Coporaque (simulada)', 'Chivay', 'Caylloma', 'Arequipa', 3500,
              'colca-chivay-yanque-coporaque', false, true, ST_SetSRID(ST_MakePoint(${center[0]}, ${center[1]}), 4326)::geography)
      returning id`;
    const cid = c!.id;
    for (const [f, fam] of FAMILIES.entries()) {
      // Teléfono inválido a propósito: nadie puede iniciar sesión con estas cuentas
      const [u] = await tx<{ id: string }[]>`
        insert into users (name, phone, pin_hash, is_demo, terms_accepted_at, terms_version)
        values (${`${fam.name} (demo)`}, ${`demo-${String(f + 1).padStart(2, '0')}`}, ${await hashPin(randomBytes(8).toString('hex'))}, true, now(), 'demo')
        returning id`;
      const uid = u!.id;
      await tx`insert into memberships (user_id, community_id, joined_at, submitted_at) values (${uid}, ${cid}, ${now}, ${now})`;
      await tx`insert into preferences (user_id, community_id, coins, constraints, vetoes)
               values (${uid}, ${cid}, ${tx.json(fullCoins(fam.coins))}, ${tx.json(fam.constraints)}, ${fam.vetoes})`;
      for (const [k, [sector, pos, rot]] of fam.parcels.entries()) {
        const s = SECTORS[sector]!;
        const pt = points[s.point]!;
        const geo = JSON.stringify({ type: 'Polygon', coordinates: [parcelRing(pt.lonLat, pos)] });
        const irrigation = s.irrigated ? { source: 'canal', turnsPerMonth: sector === 4 ? 1 + (pos % 2) : 2 + ((f + pos) % 3), hoursPerTurn: 3 } : { source: 'none', turnsPerMonth: 0, hoursPerTurn: 0 };
        const [p] = await tx<{ id: string }[]>`
          insert into parcels (community_id, owner_id, name, polygon, capture_method, gps_altitude_m, irrigation, current_rotation)
          values (${cid}, ${uid}, ${`${s.name} ${k + 1}`}, ST_SetSRID(ST_GeomFromGeoJSON(${geo}), 4326)::geography, 'draw',
                  ${pt.elevationM + (pos < 2 ? 4 : -4)}, ${tx.json(irrigation)}, ${rot})
          returning id`;
        for (const o of observationsFor(sector, pos, rot, f)) {
          const at = new Date(now.getTime() - o.daysAgo * 86_400_000);
          await tx`insert into observations (parcel_id, user_id, type, value, lat, lon, observed_at)
                   values (${p!.id}, ${uid}, ${o.value.type}, ${tx.json(o.value as never)}, ${pt.lonLat[1]}, ${pt.lonLat[0]}, ${at})`;
        }
      }
    }
    return cid;
  });
}
