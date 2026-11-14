import { z } from 'zod';
import { SeasonUse } from './crops.ts';

export * from './crops.ts';
export * from './observations.ts';
export * from './preferences.ts';
export * from './engineInput.ts';
export type * from './valley.ts';

/**
 * Procedencia de cada valor (spec 15.1). Ningún número llega a la UI sin ella.
 * - observed:  medición directa o registro verificable (cosecha pesada, reporte de helada)
 * - estimated: producto de un modelo o satélite (POWER, NDVI, SoilGrids, Tmin ajustada)
 * - simulated: salida del motor (Yrel, estrés hídrico)
 * - assumed:   parámetro sin evidencia suficiente, usado para explorar (elasticidad, crédito de N)
 */
export const Provenance = z.enum(['observed', 'estimated', 'simulated', 'assumed']);
export type Provenance = z.infer<typeof Provenance>;

/** Un valor con su procedencia y fuente (producto + productor + vía de acceso). */
export const Traced = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value, provenance: Provenance, source: z.string() });

export const DISCLAIMER =
  'Esta herramienta apoya la decisión; no reemplaza su experiencia ni la de un técnico agrícola.';

// ───────────────────────── Salud ─────────────────────────
export const HealthResponse = z.object({
  ok: z.boolean(),
  service: z.literal('qullqa-api'),
  db: z.object({ ok: z.boolean(), postgis: z.string().nullable() }),
  time: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

// ───────────────────────── Auth ─────────────────────────
export const Phone = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^\+?\d{9,12}$/, 'Número de celular no válido'));
export const Pin = z.string().regex(/^\d{4}$/, 'El PIN son 4 números');

export const RegisterBody = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre').max(60),
  phone: Phone,
  pin: Pin,
});
export type RegisterBody = z.infer<typeof RegisterBody>;

export const LoginBody = z.object({ phone: Phone, pin: Pin });
export type LoginBody = z.infer<typeof LoginBody>;

export const Me = z.object({
  id: z.string().uuid(),
  name: z.string(),
  communities: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      role: z.enum(['member', 'coordinator']),
    }),
  ),
});
export type Me = z.infer<typeof Me>;

// ───────────────────────── Geometría ─────────────────────────
/** [lon, lat] en WGS84 (orden GeoJSON). */
export const LonLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export type LonLat = z.infer<typeof LonLat>;

/** Anillo exterior de un polígono, sin repetir el primer punto al final. */
export const Ring = z.array(LonLat).min(3, 'Se necesitan al menos 3 puntos').max(500);
export type Ring = z.infer<typeof Ring>;

// ───────────────────────── Comunidad ─────────────────────────
export const CreateCommunityBody = z.object({
  name: z.string().trim().min(3).max(80),
  /** Centro aproximado; por defecto, el piloto Chivay–Yanque–Coporaque. */
  center: LonLat.optional(),
});
export type CreateCommunityBody = z.infer<typeof CreateCommunityBody>;

export const JoinBody = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/, 'El código tiene 6 caracteres'),
});

/** Vista pública de la comunidad: solo agregados y geometrías; nunca preferencias de nadie. */
export const CommunityView = z.object({
  id: z.string().uuid(),
  name: z.string(),
  joinCode: z.string(),
  center: LonLat,
  myRole: z.enum(['member', 'coordinator']),
  memberCount: z.number().int(),
  submittedCount: z.number().int(),
  parcels: z.array(
    z.object({
      id: z.string().uuid(),
      ring: Ring,
      areaHa: z.number(),
      mine: z.boolean(),
    }),
  ),
});
export type CommunityView = z.infer<typeof CommunityView>;

// ───────────────────────── Parcela ─────────────────────────
export const WaterSource = z.enum(['none', 'canal', 'spring', 'well', 'reservoir']);
export const WATER_SOURCE_LABEL: Record<z.infer<typeof WaterSource>, string> = {
  none: 'Sin riego (solo lluvia)',
  canal: 'Canal / acequia',
  spring: 'Manantial (puquio)',
  well: 'Pozo',
  reservoir: 'Reservorio / qocha',
};

export const Irrigation = z.object({
  source: WaterSource,
  /** Turnos de riego al mes en temporada seca (0 si no hay). */
  turnsPerMonth: z.number().int().min(0).max(31),
  /** Horas por turno. */
  hoursPerTurn: z.number().min(0).max(48),
});
export type Irrigation = z.infer<typeof Irrigation>;

export const GpsFix = z.object({
  altitudeM: z.number().nullable(),
  accuracyM: z.number().nullable(),
});

export const ParcelBody = z.object({
  communityId: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  ring: Ring,
  captureMethod: z.enum(['walk', 'draw']),
  gps: GpsFix.optional(),
  irrigation: Irrigation,
  /** Tres temporadas: [hace 2 campañas, campaña pasada, campaña actual]. */
  currentRotation: z.tuple([SeasonUse, SeasonUse, SeasonUse]),
});
export type ParcelBody = z.infer<typeof ParcelBody>;

export const ParcelPatch = ParcelBody.omit({ communityId: true }).partial();

export const Parcel = ParcelBody.extend({
  id: z.string().uuid(),
  areaHa: z.number(),
  observationCount: z.number().int(),
  createdAt: z.string(),
});
export type Parcel = z.infer<typeof Parcel>;

// ───────────────────────── Estado «datos listos» ─────────────────────────
export const Readiness = z.object({
  hasParcel: z.boolean(),
  rotationsComplete: z.boolean(),
  preferencesSaved: z.boolean(),
  /** Recomendado, no obligatorio. */
  observationTypes: z.array(z.string()),
  canSubmit: z.boolean(),
  submittedAt: z.string().nullable(),
});
export type Readiness = z.infer<typeof Readiness>;
