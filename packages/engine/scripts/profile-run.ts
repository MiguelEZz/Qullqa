/** Mide la corrida completa con una entrada exportada: tsx scripts/profile-run.ts <engine-input.json> <valley.json> */
import { readFileSync } from 'node:fs';
import { ASSUMPTIONS, CROPS } from '@qullqa/catalog';
import { makeSnapshot, runCommunity } from '../src/index.ts';
const input = JSON.parse(readFileSync(process.argv[2]!, 'utf8'));
const valley = JSON.parse(readFileSync(process.argv[3]!, 'utf8'));
const origNow = performance.now.bind(performance);
const t0 = origNow();
const r = runCommunity(makeSnapshot(input, valley, CROPS, ASSUMPTIONS, 7));
console.log('total', ((origNow() - t0) / 1000).toFixed(1), 's · shapley', r.community.shapleyMethod, '· anneal', r.community.anneal);
