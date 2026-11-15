/**
 * Elige 20 puntos de cultivo reales (ESA WorldCover clase 40) entre Chivay y Coporaque para la comunidad DEMO,
 * con altura y pendiente SRTM. Escribe ../../apps/api/src/demo/parcels.json. Se corre una vez:
 *   pnpm -F @qullqa/data exec tsx scripts/find-demo-parcels.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { landCoverAt } from '../src/worldcover.ts';
import { fetchTerrain } from '../src/elevation.ts';

// Rejilla cada ~220 m sobre los andenes al norte del río (Coporaque) y al sur (Chivay–Yanque)
const cands: [number, number][] = [];
for (let lon = -71.66; lon <= -71.60; lon += 0.002) for (let lat = -15.655; lat <= -15.618; lat += 0.002) cands.push([+lon.toFixed(5), +lat.toFixed(5)]);
console.log('candidatos', cands.length);
const lc = await landCoverAt(cands, 0);
const crop = lc.filter((r) => r.cover.class === 40 && r.cover.cropFraction250m >= 0.5);
console.log('con cultivo', crop.length);
// 20 puntos repartidos: ordenar por longitud y tomar a intervalos, en grupos de 2 vecinos (dos parcelas por familia)
crop.sort((a, b) => a.point[0] - b.point[0] || a.point[1] - b.point[1]);
const step = Math.max(1, Math.floor(crop.length / 20));
const chosen = Array.from({ length: Math.min(20, crop.length) }, (_, i) => crop[Math.min(crop.length - 1, i * step)]!.point);
const terr = await fetchTerrain(chosen);
const out = chosen.map((p, i) => ({ lonLat: p, elevationM: Math.round(terr[i]!.elevationM), slopeDeg: Math.round(terr[i]!.slopeDeg * 10) / 10, cropFraction: lc.find((r) => r.point === p)?.cover.cropFraction250m }));
const dir = fileURLToPath(new URL('../../../apps/api/src/demo/', import.meta.url));
mkdirSync(dir, { recursive: true });
writeFileSync(dir + 'parcels.json', JSON.stringify({ source: 'ESA WorldCover 2021 v200 (no NASA) vía Planetary Computer + NASA SRTM 30 m vía OpenTopoData', points: out }, null, 1));
console.table(out.map((o) => ({ lon: o.lonLat[0], lat: o.lonLat[1], m: o.elevationM, pend: o.slopeDeg, cultivo: o.cropFraction })));
