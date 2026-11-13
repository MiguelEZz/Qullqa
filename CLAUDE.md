# CLAUDE.md — Qullqa

Qullqa es un gemelo digital comunitario para agricultores andinos (piloto: valle del Colca). Proyecto para NASA Space Apps (hackathon de 48 h, desde 2026-11-14).

**Zona: sierra de Arequipa** (valle del Colca y pisos altoandinos, ~2 800–4 200 m). Solo cultivos andinos de sierra: papa, olluco, oca, haba, tarwi, arveja, quinua, cebada, avena forrajera, maíz amiláceo (p. ej. Cabanita). Nada de costa (arroz, ají, cebolla de valle bajo, etc.). Valores de cultivos: INIA/fuentes peruanas prevalecen sobre FAO cuando difieren. Ayuda a una comunidad a decidir **qué plantar, cuándo y coordinado con sus vecinos**, usando datos NASA + observaciones de campo tomadas con el celular.

- Especificación del motor (fuente de verdad científica): `Qullqa — Motor de decisión especificación completa para Claude CodeFinal.pdf`. **Las correcciones de la sección 15 prevalecen sobre las secciones 1–14.**
- Arquitectura del sistema: `docs/ARCHITECTURE.md`.
- Lo que no está en la especificación no se construye todavía.

## Regla de oro (no negociable)

> «Qullqa nunca convierte una estimación en un hecho, ni una correlación en una causalidad, ni una simulación en una predicción comprobada.»

Consecuencias concretas en el código:
- Todo valor que sale del motor lleva `provenance`: `'observed' | 'estimated' | 'simulated' | 'assumed'` (4 tipos, sec. 15.1). Ningún número llega a la interfaz sin ella.
- Cada fuente declara su cobertura real de años (POWER ~1981, MODIS/IMERG 2000, SMAP 2015). Nunca decir «40 años de datos»; decir «40 años de clima» o «25 años de vegetación».
- La foto del celular produce **cobertura verde (ExG)**, nunca «NDVI». No se fusiona con NDVI.
- Plagas = **índice de continuidad de hospederos**, no SIR.
- Crédito de N = rango marcado como supuesto (`nCredit_estimated_kgha: [min, max]`).
- Todo parámetro editable (umbrales, elasticidad, pesos de normalización) vive en un archivo de supuestos, no en constantes sueltas.
- Aviso fijo en la UI: «Esta herramienta apoya la decisión; no reemplaza su experiencia ni la de un técnico agrícola.»

## Las dos mitades

1. **Carcasa** (`apps/web`, `apps/api`): app del agricultor (PWA instalable), comunidades, captura de datos de campo, entrega de resultados.
2. **Cerebro** (`packages/engine`, `packages/data`, `apps/worker`): pipeline de datos NASA, aptitud, simulación histórica, optimización comunitaria, Shapley. **Es lo importante. La carcasa nunca contiene lógica agronómica.**

## Estructura del monorepo (pnpm workspaces, TypeScript en todo)

```
apps/
  web/        PWA React + Vite (agricultor y vista comunidad)
  api/        Fastify: auth, comunidades, parcelas, observaciones, disparo de corridas
  worker/     Consume trabajos (pg-boss) y ejecuta el cerebro
packages/
  shared/     Tipos y esquemas zod compartidos (Provenance, CropCard, Parcel, DTOs)
  engine/     Motor puro: funciones sin I/O, deterministas con semilla
  data/       Clientes NASA POWER, MODIS (ORNL), SoilGrids, elevación → ValleyDataset
  catalog/    Fichas de cultivos (JSON) + supuestos editables, con fuente citada
infra/        docker-compose, Caddy, scripts de túnel
docs/         ARCHITECTURE.md y notas
```

## Reglas para `packages/engine`

- **Puro**: nada de `fetch`, base de datos, `Date.now()` ni `Math.random()`. El azar entra por un PRNG con semilla (p. ej. `mulberry32(seed)`).
- Balance hídrico **diario**, FAO-56 completo (TAW, RAW, Dr, Ks, raíz que crece). La década (36/año) es solo para resumir y visualizar.
- Ky **por etapa**; `Yrel = Π_j (1 − Ky_j·(1 − ETa_j/ETc_j))`, presentado como estimación.
- Indicadores positivos: `0.6·media + 0.4·p20`. Negativos: `0.6·media + 0.4·p80`.
- Normalización con umbrales agronómicos fijos (supuestos editables), **nunca min-max del conjunto**.
- Racionalidad individual (`U_i,com ≥ U_i,solo`) es **restricción dentro del recocido**, no chequeo posterior.
- Shapley exacto hasta 10 parcelas; muestreo por permutaciones con más.
- Cada corrida guarda un **snapshot inmutable**: versión del dataset, catálogo, supuestos, entradas de cada participante, semilla, resultado.
- Cada recomendación incluye: por qué, evidencia, beneficios, qué información falta, riesgos a revisar localmente, nivel de confianza (alta/media/baja + qué falta para subir).

## Pruebas (vitest) — obligatorias en el motor

- Balance de agua cierra: entrada − salida − Δalmacenamiento = 0 ± 1e-6.
- 0 ≤ Yrel ≤ 1; erosión ≥ 0; sin NaN/Infinity en ninguna salida.
- Toda variable de salida tiene provenance.
- Determinismo: misma entrada + misma semilla ⇒ salida idéntica.
- Usar fixtures reales de Colca en `packages/data/fixtures/` (no llamar a la red en tests).

## Privacidad

- Restricciones y las 10 monedas de cada agricultor son **privadas**: la API nunca las devuelve a otros miembros. La vista comunitaria muestra solo agregados y el plan.
- Las fotos se procesan en el teléfono (ExG en canvas); al servidor sube el índice y, opcionalmente, una miniatura.

## Comandos

```bash
pnpm install
pnpm dev                     # api + worker + web en paralelo
pnpm -F @qullqa/engine test  # pruebas del motor
pnpm -F @qullqa/data fetch:colca   # descarga y cachea datos NASA del valle
docker compose -f infra/docker-compose.yml up -d   # Postgres/PostGIS + Caddy
./infra/tunnel.sh            # expone Caddy por el dominio estático de ngrok
```

## Infraestructura local (puertos fijos)

- Postgres + PostGIS (docker `qullqa-db-1`): `localhost:5434` (5432/5433 los usa otro proyecto).
- API Fastify: `:3000` · Caddy: `:8080` (sirve `apps/web/dist` + proxy `/api/*`).
- Público: `https://obsession-savior-dry.ngrok-free.dev` (ngrok gratis, dominio estático). Plan: migrar a Cloudflare Tunnel con dominio propio (`PUBLIC_TUNNEL=cloudflare`). Solo cambia `.env`, nunca el código.
- ngrok gratis muestra una página de aviso a navegadores en la primera visita; `apps/web/src/api.ts` envía `ngrok-skip-browser-warning` en cada fetch.
- Secretos en `.env` (no se commitea); `EARTHDATA_TOKEN` para GPM IMERG/SMAP.
- Tras cambiar la PWA: `pnpm build:web` (Caddy sirve el build; el service worker solo existe en build).

## Convenciones

- Idioma: código e identificadores en inglés; textos de UI y explicaciones al agricultor en español claro, sin jerga sin explicar (tooltip para cada término técnico).
- Validar toda entrada de la API con zod (esquemas en `packages/shared`).
- Un solo origen público: Caddy sirve `/` (PWA) y `/api/*` (Fastify). Nada de URLs de localhost en el frontend.
- No marcar nada como «observado» si viene de un modelo o satélite.
