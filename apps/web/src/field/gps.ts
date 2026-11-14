import type { LonLat } from '@qullqa/shared';

export type Fix = { lon: number; lat: number; altitude: number | null; accuracy: number };

export function getFix(timeout = 20000): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Este teléfono no tiene GPS disponible'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lon: p.coords.longitude, lat: p.coords.latitude, altitude: p.coords.altitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(gpsError(e))),
      { enableHighAccuracy: true, timeout, maximumAge: 5000 },
    );
  });
}

export function gpsError(e: GeolocationPositionError): string {
  if (e.code === e.PERMISSION_DENIED) return 'Necesitamos permiso de ubicación. Actívalo en los ajustes del navegador.';
  if (e.code === e.TIMEOUT) return 'El GPS tardó mucho. Sal a cielo abierto e intenta de nuevo.';
  return 'No se pudo obtener la ubicación.';
}

/** Distancia en metros (haversine). */
export function distanceM(a: LonLat, b: LonLat): number {
  const R = 6371000, toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad, dLon = (b[0] - a[0]) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Área aproximada en m² (proyección local equirectangular), para mostrar mientras se traza. */
export function areaM2(ring: LonLat[]): number {
  if (ring.length < 3) return 0;
  const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180);
  const mx = 111320 * Math.cos(lat0), my = 110540;
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!, q = ring[(i + 1) % ring.length]!;
    s += p[0] * mx * (q[1] * my) - q[0] * mx * (p[1] * my);
  }
  return Math.abs(s) / 2;
}

/** Reduce un recorrido largo a ≤ max puntos conservando la forma general. */
export function thin(ring: LonLat[], max = 300): LonLat[] {
  if (ring.length <= max) return ring;
  const step = ring.length / max;
  return Array.from({ length: max }, (_, i) => ring[Math.floor(i * step)]!);
}

export function formatArea(m2: number): string {
  return m2 >= 10000 ? `${(m2 / 10000).toFixed(2)} ha` : `${Math.round(m2)} m²`;
}
