import { readFileSync } from 'node:fs';
import { CROP_BY_ID, ASSUMPTIONS } from '@qullqa/catalog';
import { buildParcel, season } from '../src/index.ts';
import { DEMO_INPUT } from '../test/demoInput.ts';
const valley = JSON.parse(readFileSync(process.argv[2]!, 'utf8'));
const p = DEMO_INPUT.participants[0]!.parcels[0]!;
const m = buildParcel(valley, p, 'x', CROP_BY_ID, ASSUMPTIONS);
console.log('elev', m.elevation.value, 'δ', m.deltaPosition.value.join(' '), 'TAW/m', m.params.hydraulics.tawPerM.toFixed(0), 'riego', JSON.stringify(m.params.irrigation));
for (const crop of (process.argv[3] ?? 'papa,quinua').split(',')) for (const y of [2005, 2010, 2015, 2018]) {
  const s = season(m, crop, y, 'descanso');
  const d = m.climate.days[s.sowIdx]!;
  console.log(crop, y, `siembra ${d.day}/${d.month}`, 'ETc', s.etc.toFixed(0), 'ETa', s.eta.toFixed(0), 'lluvia', s.rain.toFixed(0), 'riego', s.irrigation.toFixed(0), 'Yw', s.yrelWater.toFixed(2), 'helada', s.frostEvents, 'calor', s.heatEvents, 'Y', s.yrel.toFixed(2), 'gdd', s.gdd.toFixed(0),
    s.stages.map((st) => `${st.name}:${(st.eta / st.etc).toFixed(2)}`).join(' '));
}
let e = 0, n = 0; for (let i = 0; i < m.climate.days.length; i++) { e += m.climate.et0[i]!; n++; } console.log('ET0 anual', (e / n * 365).toFixed(0), 'mm');
