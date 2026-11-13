# Qullqa — Arquitectura del sistema

Objetivo: que mañana funcione como producto real. Cualquier persona, desde cualquier red (datos móviles incluidos), abre un enlace o escanea un QR, instala la app, entra a su comunidad, registra sus parcelas y datos, y recibe del servidor un plan calculado por el cerebro. Nada de demos que solo funcionan en la red local.

Supuesto: hay internet (no construimos el modo offline del punto 12.1 de la especificación; queda en la hoja de ruta).

---

## 1. Vista general

```
   Celular del agricultor (PWA instalada)            Proyector / jurado
   ┌──────────────────────────────┐                 ┌───────────────────┐
   │ GPS · cámara (ExG local)     │                 │ Vista comunidad   │
   │ Mi parcela · Comunidad       │                 │ mapa · curva coop │
   └──────────────┬───────────────┘                 └─────────┬─────────┘
                  │ HTTPS  https://<dominio>                  │
                  ▼                                           ▼
        ┌───────────────────────── túnel (ngrok / Cloudflare) ──────────────┐
        │                     Caddy (un solo origen)                         │
        │        /            → PWA estática (apps/web/dist)                 │
        │        /api/*       → Fastify (apps/api)                           │
        │        /api/events  → SSE (avisos "tu plan está listo")            │
        └───────────────┬────────────────────────────────────────────────────┘
                        │
         ┌──────────────▼─────────────┐      cola (pg-boss)     ┌──────────────────────┐
         │  API (carcasa)             │ ──────────────────────► │  WORKER (cerebro)    │
         │  auth, comunidades,        │                         │  packages/data       │
         │  parcelas, observaciones,  │ ◄────── resultados ──── │  packages/engine     │
         │  restricciones, corridas   │                         │  snapshots           │
         └──────────────┬─────────────┘                         └──────────┬───────────┘
                        │                                                  │
                        ▼                                                  ▼
             ┌────────────────────────────────────────────┐     ┌──────────────────────┐
             │ PostgreSQL 16 + PostGIS                     │     │ APIs externas        │
             │ usuarios, comunidades, parcelas (polígonos),│     │ NASA POWER (diario)  │
             │ observaciones, datasets del valle, corridas │     │ MODIS ORNL (NDVI)    │
             └────────────────────────────────────────────┘     │ SoilGrids, SRTM      │
                                                                └──────────────────────┘
```

Todo corre en una sola máquina con `docker compose` (tu laptop o un VPS) y sale a internet por **un solo dominio HTTPS**. Un solo origen implica un solo túnel, cero problemas de CORS, y que GPS y cámara funcionen (exigen HTTPS).

---

## 2. Decisiones y por qué

| Decisión | Elección | Por qué |
|---|---|---|
| App del agricultor | **PWA** (React + Vite + vite-plugin-pwa) | Se instala desde un enlace o QR sin tienda; GPS, cámara y canvas (para ExG) funcionan en el navegador; el mismo código sirve para el proyector. Si quieren un APK «descargable», se envuelve con Capacitor después, sin reescribir. |
| Lenguaje | **TypeScript en todo** | La especificación ya está escrita con firmas TS y vitest; los tipos (`Provenance`, `CropCard`) se comparten entre motor, API y app. |
| API | **Fastify + zod** | Rápido, validación con los mismos esquemas de `shared`. |
| Base de datos | **PostgreSQL + PostGIS** | Polígonos de parcelas, área real (`ST_Area`), vecinos (`ST_DWithin`/`ST_Touches`) para plagas y para el grafo de erosión ladera abajo. |
| Cola de trabajos | **pg-boss** (sobre Postgres) | La optimización tarda segundos o minutos: no puede ir dentro de una petición HTTP. pg-boss evita sumar Redis. |
| Avisos al celular | **SSE** + estado en BD; Web Push opcional | SSE es suficiente con la app abierta; Web Push queda como extra si sobra tiempo. |
| Proxy | **Caddy** | Sirve la PWA, enruta `/api`, y su configuración ocupa 5 líneas. |
| Salida a internet | **ngrok con dominio estático** (o Cloudflare Tunnel) | Ver sección 8. |

---

## 3. Monorepo

```
qullqa/
├─ apps/
│  ├─ web/            PWA
│  │  └─ src/
│  │     ├─ features/auth, community, parcel, observations, priorities, results
│  │     ├─ field/    gps.ts (trazar polígono caminando), exg.ts (ExG + Otsu en canvas),
│  │     │            inclinometer.ts (DeviceOrientation)
│  │     └─ views/    MyParcel, Community, Projector (mapa, curva de cooperación, deslizadores)
│  ├─ api/            Fastify
│  │  └─ src/routes/  auth, communities, parcels, observations, preferences, runs, events
│  └─ worker/
│     └─ src/jobs/    ingestValley, ingestParcel, runCommunity, whatIf
├─ packages/
│  ├─ shared/         tipos + esquemas zod (Provenance de 4 valores, DTOs)
│  ├─ engine/         el cerebro puro (ver sección 5)
│  ├─ data/           clientes de fuentes de datos → ValleyDataset / ParcelContext
│  │  └─ fixtures/    datos reales de Colca ya descargados (para tests y por si falla la red)
│  └─ catalog/        crops/*.json (10 cultivos, con fuente citada) + assumptions.json
├─ infra/             docker-compose.yml, Caddyfile, tunnel.sh, seed.ts
└─ docs/
```

---

## 4. Modelo de datos (Postgres)

```
users            id, name, phone, pin_hash, created_at
communities      id, name, join_code (6 caracteres), center geography(Point), valley_dataset_id,
                 water_supply_mm_by_decade jsonb, market_params jsonb
memberships      user_id, community_id, role ('member'|'coordinator')
parcels          id, community_id, owner_id, name, polygon geography(Polygon), area_ha,
                 elevation_m, slope_deg, aspect_deg, soil jsonb (+provenance),
                 current_rotation text[3], irrigation boolean, irrigation_mm
observations     id, parcel_id, user_id, type (green_cover|residue|slope|phenology|frost|
                 wilting|soil_moisture|erosion|harvest), value jsonb, photo_thumb_url,
                 lat, lon, observed_at, provenance='observed'
preferences      user_id, community_id, coins jsonb (8 indicadores, suma 10),
                 constraints jsonb (agua, yunta, mano de obra, mercado), vetoes text[], pinned text[]
                 ← PRIVADO: solo lo lee su dueño y el worker
valley_datasets  id, community_id, version, daily jsonb/zst, ndvi jsonb, coverage jsonb, fetched_at
runs             id, community_id, round (1..3), status, seed, snapshot jsonb (inmutable),
                 result jsonb, created_at, finished_at
run_responses    run_id, user_id, decision ('accept'|'pin'|'veto'), detail jsonb
```

Autenticación simple pero real: nombre + teléfono + PIN de 4 dígitos, sesión con JWT en cookie httpOnly. Para unirse a una comunidad se ingresa o escanea un `join_code`.

---

## 5. El cerebro (`packages/engine` + `packages/data` + `apps/worker`)

### 5.1 Pipeline de datos (`packages/data`) — se ejecuta al crear la comunidad o la parcela

| Fuente | Cómo se obtiene | Auth | Salida |
|---|---|---|---|
| NASA POWER diario 1981→hoy | `power.larc.nasa.gov/api/temporal/daily/point` con T2M, T2M_MAX, T2M_MIN, RH2M, WS2M, ALLSKY_SFC_SW_DWN, PRECTOTCORR, GWETROOT | no | serie diaria del valle + elevación de la celda (`z_celda`) |
| MODIS MOD13Q1 NDVI 2000→hoy | ORNL DAAC MODIS Web Service (subset por punto, 250 m) | no | serie de 16 días por parcela con máscara de calidad |
| SoilGrids 250 m | `rest.isric.org` (consulta por punto) | no | arcilla, arena, pH, carbono → Saxton & Rawls → θ_FC, θ_WP |
| Elevación SRTM 30 m | OpenTopoData (`srtm30m`) | no | elevación; pendiente y orientación con 4 vecinos |
| GPM IMERG | GES DISC | **Earthdata** | opcional; POWER ya trae PRECTOTCORR |

Cada fuente se descarga **una vez por comunidad** y se cachea en `valley_datasets` (versionado). Antes del hackathon se descarga Colca y se guarda en `fixtures/`, por si el wifi del evento falla.

### 5.2 Motor (`packages/engine`) — funciones puras, en capas

```
harmonize/   DailyRecord[] → corrección de Tmin por altitud y δ_posición → agregación a década
water/       et0PenmanMonteith, et0Hargreaves, FAO-56 diario (TAW, RAW, Dr, Ks, raíz que crece)
diagnosis/   seasonProfiles, percentiles, mannKendall+Sen, clusterYears (k-means con semilla), stressMoments
aptitude/    assessAptitude → apt | marginal | notApt + motivos legibles
simulate/    rotación(3 temporadas) × año → Yrel por etapa, helada, N (rango), RUSLE, continuidad de hospederos
indicators/  8 indicadores → distribuciones → score (p20 / p80) → normalización con umbrales fijos
community/   utilidad U_i (10 monedas), recocido simulado de W con racionalidad individual como restricción,
             efectos compartidos (plagas, agua por décadas, precio con elasticidad, erosión cuenca abajo)
fairness/    Shapley exacto (≤10) / por permutaciones; compensación en ayni (suma cero)
explain/     tarjetas: por qué, evidencia, beneficios, qué falta, riesgos, confianza
whatif/      lluvia ±30 %, temperatura +1/+2 °C, brote en parcela X
```

### 5.3 Una corrida comunitaria (job `runCommunity`)

1. El coordinador pulsa «Calcular plan» (o se dispara cuando todos enviaron datos).
2. La API encola `{communityId, round, seed}`.
3. El worker arma un **snapshot** (dataset, catálogo, supuestos, parcelas, observaciones y preferencias de todos, semilla) y lo guarda tal cual.
4. Se ejecuta: aptitud → simulación por parcela → mejor plan individual `U_i,solo` → recocido comunitario → Shapley → ayni → tarjetas.
5. Se guarda `result` y se emite un evento SSE a cada miembro.
6. Cada agricultor ve **solo** su tarjeta completa (actual / individual / comunitario + compensación) y la vista comunitaria agregada.
7. Responde aceptar, fijar o vetar → ronda 2 (máximo 3).

Los deslizadores «qué pasa si» llaman a `POST /api/runs/:id/whatif`, que encola un job liviano que reutiliza el snapshot. Si hace falta latencia baja en el proyector, la simulación de una parcela puede correr en el navegador, porque el motor es TS puro.

---

## 6. La carcasa: pantallas

**Agricultor (celular)**
1. Registro / ingreso → «Unirme a comunidad» (código o QR).
2. Mis parcelas → «Trazar caminando» (GPS) o dibujar en el mapa → rotación actual, riego.
3. Mis prioridades: 10 monedas entre 8 indicadores + restricciones + vetos (privado).
4. Campo: foto de cobertura verde (ExG calculado en el teléfono), rastrojo, pendiente (inclinómetro), etapa, helada, marchitez, prueba del puño, erosión, cosecha.
5. Mi plan: 3 tarjetas, calendario, ganancia frente a lo actual, compensación; aceptar, fijar o vetar.

**Comunidad / proyector**
- Mapa del valle (parcelas por cultivo, riesgo o aptitud) sobre relieve.
- Mapa de calor décadas × años.
- Curva de cooperación y métricas de beneficio mutuo.
- Deslizadores qué pasa si; prueba retrospectiva con El Niño 2015-16 y 2023-24.

Librerías: MapLibre GL (mapa), Recharts o visx (gráficos), TanStack Query (datos).

---

## 7. API (resumen)

```
POST /api/auth/register | /login | /logout        GET /api/me
POST /api/communities            GET /api/communities/:id     POST /api/communities/join {code}
POST /api/parcels                PATCH /api/parcels/:id       GET /api/communities/:id/parcels (público: polígono, cultivo, nunca preferencias)
POST /api/parcels/:id/observations   (multipart opcional: miniatura)
PUT  /api/preferences/:communityId   (privado)
POST /api/communities/:id/runs   GET /api/runs/:id   GET /api/runs/:id/me   POST /api/runs/:id/respond
POST /api/runs/:id/whatif
GET  /api/events                 (SSE)
GET  /api/datasets/:id/coverage  (qué años cubre cada fuente)
```

---

## 8. Despliegue: cómo llega a cualquier celular

### Opción A — la más rápida: tu laptop + ngrok con dominio estático
- ngrok gratis da **un** dominio estático `algo.ngrok-free.app`. Como todo sale por Caddy en un solo puerto, con uno basta.
- `ngrok http --url=https://<tu-dominio>.ngrok-free.app 8080`
- ⚠️ El plan gratis muestra una página de advertencia de ngrok la primera vez que alguien abre el sitio en el navegador. Las llamadas de la API se libran enviando el header `ngrok-skip-browser-warning: 1` (lo añadimos en el cliente), pero el público que escanee el QR verá esa pantalla una vez y tendrá que pulsar «Visit». Para la demo es tolerable; si molesta, usar la opción B.
- ⚠️ Un dominio propio con ngrok exige plan de pago.

### Opción B — recomendada si tu dominio gratis se puede gestionar desde Cloudflare: Cloudflare Tunnel
- `cloudflared` + tu dominio en DNS de Cloudflare (gratis) → `qullqa.tudominio.xx` sin página de advertencia y con HTTPS.
- Requiere que el dominio acepte cambiar los nameservers a Cloudflare (eu.org, por ejemplo, lo permite; DuckDNS o is-a.dev no).

### Opción C — la más robusta: un VPS
- Oracle Cloud Always Free o un VPS barato; `docker compose up`, Caddy con Let's Encrypt y tu dominio apuntando por registro A. No depende de que tu laptop esté encendida ni del wifi del evento.

En las tres el código es el mismo: solo cambia `PUBLIC_URL`.

---

## 9. Orden de construcción (48 h)

| Bloque | Qué | Prueba de que funciona |
|---|---|---|
| 0 (2 h) | Monorepo, docker compose, Caddy, túnel, PWA vacía instalable | Abres el dominio en un celular con datos móviles y la instalas |
| 1 (4 h) | `packages/data` + fixtures de Colca | `fetch:colca` genera el dataset con la cobertura real de cada fuente |
| 2 (8 h) | Motor: agua, aptitud, simulación, indicadores + tests | vitest en verde (balance cierra, sin NaN, determinista) |
| 3 (6 h) | Carcasa: auth, comunidad, parcela GPS, prioridades, observaciones | 3 celulares distintos en una comunidad con parcelas reales |
| 4 (8 h) | Cerebro comunitario: recocido, Shapley, ayni, tarjetas + worker y SSE | El plan llega solo a cada celular |
| 5 (6 h) | Vista proyector: mapa, mapa de calor, curva, deslizadores, El Niño | Demo de punta a punta |
| 6 (resto) | Seed de comunidad demo, pulido, pitch | Ensayo con QR para el público |

Con el bloque 0 primero, todo lo que se construye después ya está «en producción» desde el minuto uno.

---

## 10. Riesgos conocidos

- **APIs externas lentas o caídas** (SoilGrids suele limitar peticiones) → fixtures precargados y caché en BD; nunca depender de la red durante la demo.
- **Tiempo de cómputo** → acotar rotaciones candidatas con el filtro de aptitud, y en la demo limitar a unas 10–15 parcelas (permite Shapley exacto).
- **Píxel MODIS mayor que la parcela** → reflejarlo en el nivel de confianza, como pide la sección 10 de la especificación.
- **Laptop como servidor** → cargador, desactivar la suspensión, y tener el VPS como plan B.
