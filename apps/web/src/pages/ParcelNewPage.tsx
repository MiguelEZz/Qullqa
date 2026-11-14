import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CommunityView, LonLat, Parcel } from '@qullqa/shared';
import { api } from '../api.ts';
import { useApi } from '../lib/hooks.ts';
import { areaM2, distanceM, formatArea, getFix, gpsError, thin } from '../field/gps.ts';
import { Card, ErrorMsg, Loading, Page } from '../components/ui.tsx';
import { MapView } from '../components/MapView.tsx';
import { ParcelForm } from '../components/ParcelForm.tsx';

const MIN_STEP_M = 3; // registrar un punto cada 3 m caminados
const MAX_ACCURACY_M = 25; // descartar lecturas con error mayor

export function ParcelNewPage() {
  const { cid = '' } = useParams();
  const nav = useNavigate();
  const community = useApi<CommunityView>(`/communities/${cid}`);
  const [mode, setMode] = useState<'walk' | 'draw' | null>(null);
  const [ring, setRing] = useState<LonLat[]>([]);
  const [me, setMe] = useState<LonLat | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [altitude, setAltitude] = useState<number | null>(null);
  const [walking, setWalking] = useState(false);
  const [step, setStep] = useState<'trace' | 'details'>('trace');
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const [fit, setFit] = useState<LonLat[] | undefined>();

  // Ubicarse al entrar: centra el mapa donde está el agricultor
  useEffect(() => {
    getFix()
      .then((f) => {
        setMe([f.lon, f.lat]);
        setAccuracy(f.accuracy);
        setAltitude(f.altitude);
        setFit([[f.lon, f.lat]]);
      })
      .catch(() => {});
    return () => stopWalk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startWalk() {
    setMode('walk');
    setRing([]);
    setError(null);
    setWalking(true);
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const pt: LonLat = [p.coords.longitude, p.coords.latitude];
        setMe(pt);
        setAccuracy(p.coords.accuracy);
        if (p.coords.altitude != null) setAltitude(p.coords.altitude);
        if (p.coords.accuracy > MAX_ACCURACY_M) return;
        setRing((r) => (r.length === 0 || distanceM(r[r.length - 1]!, pt) >= MIN_STEP_M ? [...r, pt] : r));
      },
      (e) => setError(gpsError(e)),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    );
  }

  function stopWalk() {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setWalking(false);
  }

  async function create(v: Parameters<Parameters<typeof ParcelForm>[0]['onSubmit']>[0]) {
    const p = await api<Parcel>('/parcels', {
      method: 'POST',
      json: { ...v, communityId: cid, ring: thin(ring), captureMethod: mode ?? 'draw', gps: { altitudeM: altitude, accuracyM: accuracy } },
    });
    nav(`/c/${cid}/p/${p.id}`, { replace: true });
  }

  const c = community.data;
  if (!c) return <Page title="Nueva parcela" back={`/c/${cid}`}>{community.error ? <ErrorMsg error={community.error} /> : <Loading />}</Page>;

  const area = areaM2(ring);
  const neighbours = c.parcels;

  if (step === 'details')
    return (
      <Page title="Datos de la parcela" back={`/c/${cid}`}>
        <Card>
          <p className="muted">Contorno: {ring.length} puntos · {formatArea(area)} {mode === 'walk' ? '(caminado con GPS)' : '(dibujado en el mapa)'}</p>
          <button className="link" onClick={() => setStep('trace')}>← Volver a trazar</button>
        </Card>
        <Card>
          <ParcelForm submitLabel="Guardar parcela" onSubmit={create} />
        </Card>
      </Page>
    );

  return (
    <Page title="Nueva parcela" back={`/c/${cid}`}>
      <Card title="1. Marca el borde de tu parcela">
        {!mode && (
          <div className="choices">
            <button type="button" className="choice" onClick={startWalk}>
              <strong>🚶 Caminar el borde</strong>
              <small>Camina alrededor de la parcela con el celular. Lo más exacto.</small>
            </button>
            <button type="button" className="choice" onClick={() => { setMode('draw'); setRing([]); }}>
              <strong>✏️ Dibujar en el mapa</strong>
              <small>Toca las esquinas de tu parcela sobre la imagen satelital.</small>
            </button>
          </div>
        )}
        {mode === 'walk' && (
          <p className="muted">
            {walking ? 'Caminando… ' : ''}
            {ring.length} puntos · {formatArea(area)}
            {accuracy != null && ` · señal GPS ±${Math.round(accuracy)} m`}
            {accuracy != null && accuracy > MAX_ACCURACY_M && ' (débil: espera a que mejore)'}
          </p>
        )}
        {mode === 'draw' && <p className="muted">Toca cada esquina en orden. {ring.length} puntos · {formatArea(area)}</p>}
      </Card>

      <MapView
        center={me ?? c.center}
        parcels={neighbours}
        draft={ring}
        me={me}
        fitTo={fit}
        zoom={17}
        height="55vh"
        onMapClick={mode === 'draw' ? (p) => setRing((r) => [...r, p]) : undefined}
      />

      <ErrorMsg error={error} />
      {mode && (
        <div className="row actions">
          {mode === 'walk' && walking && <button className="secondary" onClick={stopWalk}>Pausar</button>}
          {mode === 'walk' && !walking && <button className="secondary" onClick={startWalk}>Reiniciar</button>}
          {mode === 'draw' && <button className="secondary" onClick={() => setRing((r) => r.slice(0, -1))} disabled={!ring.length}>Deshacer</button>}
          <button className="secondary" onClick={() => { stopWalk(); setMode(null); setRing([]); }}>Cambiar modo</button>
        </div>
      )}
      {mode && (
        <button
          disabled={ring.length < 3}
          onClick={() => {
            stopWalk();
            setStep('details');
          }}
        >
          {ring.length < 3 ? 'Faltan puntos (mínimo 3)' : 'Listo, siguiente'}
        </button>
      )}
    </Page>
  );
}
