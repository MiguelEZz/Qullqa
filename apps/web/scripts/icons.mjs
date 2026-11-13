// Genera los PNG del manifiesto a partir de public/icon.svg
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url));
const out = (n) => new URL(`../public/${n}`, import.meta.url).pathname;
await sharp(svg).resize(192, 192).png().toFile(out('icon-192.png'));
await sharp(svg).resize(512, 512).png().toFile(out('icon-512.png'));
// maskable: el ícono ocupa el 80% central sobre fondo sólido
const inner = await sharp(svg).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#3d6b35' } })
  .composite([{ input: inner, gravity: 'center' }]).png().toFile(out('icon-512-maskable.png'));
console.log('icons ok');
