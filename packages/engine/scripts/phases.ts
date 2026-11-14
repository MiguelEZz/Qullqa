import { readFileSync } from 'node:fs';
import { ASSUMPTIONS as a, CROP_BY_ID, FALLOW } from '@qullqa/catalog';
import { assessAptitude, buildCommunity, buildParcel, enumerateRotations, soloPlans, anneal, type Player } from '../src/index.ts';
import { DEMO_INPUT } from '../test/demoInput.ts';
const valley = JSON.parse(readFileSync(process.argv[2]!, 'utf8'));
let t = performance.now();
const lap = (m: string) => { const n = performance.now(); console.log(m, ((n - t) / 1000).toFixed(2), 's'); t = n; };
const players: Player[] = DEMO_INPUT.participants.map((p) => ({ userId: p.userId, coins: p.preferences!.coins as never, constraints: p.preferences!.constraints, vetoes: p.preferences!.vetoes, parcels: p.parcels.map((x) => buildParcel(valley, x, p.userId, CROP_BY_ID, a)) }));
lap('parcelas');
const cands = new Map();
for (const pl of players) for (const m of pl.parcels) {
  const allowed = [FALLOW.id, ...Object.values(m.crops).map((c) => assessAptitude(m, c)).filter((r) => r.aptitude !== 'notApt').map((r) => r.crop)];
  cands.set(m.id, enumerateRotations(allowed)); console.log('  ', m.name, allowed.length, 'cultivos →', allowed.length ** 3, 'rotaciones');
}
lap('aptitud');
const c = buildCommunity(players, cands, a);
const s = soloPlans(c); lap('solo');
const r = anneal(c, s.plan, s.Usolo, 1, 500); lap('anneal 500');
