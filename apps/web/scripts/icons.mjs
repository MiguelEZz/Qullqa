// Genera los íconos de la app (hongo) y el logotipo (Qullqa) a partir de brand/*.png
//   pnpm -F @qullqa/web icons
import sharp from 'sharp';

const src = (n) => new URL(`../brand/${n}`, import.meta.url).pathname;
const out = (n) => new URL(`../public/${n}`, import.meta.url).pathname;
const WHITE = '#ffffff';

/** Hongo ladrillo centrado sobre un cuadrado blanco (con esquinas redondeadas o lleno para «maskable»). */
async function icon(size, { fill = 0.62, radius = 0.22, full = false } = {}) {
  const inner = await sharp(src('mushroom.png')).resize(Math.round(size * fill), Math.round(size * fill), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const r = full ? 0 : Math.round(size * radius);
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${WHITE}"/></svg>`);
  return sharp(bg).composite([{ input: inner, gravity: 'center' }]).png();
}

await (await icon(192)).toFile(out('icon-192.png'));
await (await icon(512)).toFile(out('icon-512.png'));
await (await icon(512, { full: true, fill: 0.5 })).toFile(out('icon-512-maskable.png'));
await (await icon(180, { full: true, fill: 0.6 })).toFile(out('apple-touch-icon.png'));
await (await icon(64, { fill: 0.74, radius: 0.18 })).toFile(out('favicon.png'));
// Logotipo para la cabecera: 2× la altura mostrada (≈ 40 px)
await sharp(src('wordmark.png')).resize({ height: 96 }).png({ compressionLevel: 9 }).toFile(out('logo-qullqa.png'));
await sharp(src('wordmark.png')).resize({ height: 240 }).png({ compressionLevel: 9 }).toFile(out('logo-qullqa-lg.png'));
await sharp(src('mushroom.png')).resize({ height: 160 }).png({ compressionLevel: 9 }).toFile(out('hongo.png'));
console.log('icons ok');
