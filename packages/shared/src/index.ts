import { z } from 'zod';

/**
 * Procedencia de cada valor (spec 15.1). Ningún número llega a la UI sin ella.
 * - observed:  medición directa o registro verificable (cosecha pesada, reporte de helada)
 * - estimated: producto de un modelo o satélite (POWER, NDVI, SoilGrids, Tmin ajustada)
 * - simulated: salida del motor (Yrel, estrés hídrico)
 * - assumed:   parámetro sin evidencia suficiente, usado para explorar (elasticidad, crédito de N)
 */
export const Provenance = z.enum(['observed', 'estimated', 'simulated', 'assumed']);
export type Provenance = z.infer<typeof Provenance>;

/** Un valor con su procedencia y fuente. */
export const Traced = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value,
    provenance: Provenance,
    source: z.string(),
  });

export const HealthResponse = z.object({
  ok: z.boolean(),
  service: z.literal('qullqa-api'),
  db: z.object({ ok: z.boolean(), postgis: z.string().nullable() }),
  time: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export const DISCLAIMER =
  'Esta herramienta apoya la decisión; no reemplaza su experiencia ni la de un técnico agrícola.';
