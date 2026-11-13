import { useEffect, useState } from 'react';
import { DISCLAIMER, type HealthResponse } from '@qullqa/shared';
import { api } from './api.ts';

type InstallEvent = Event & { prompt: () => Promise<void> };

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installEvt, setInstallEvt] = useState<InstallEvent | null>(null);
  const [gps, setGps] = useState<string>('');

  useEffect(() => {
    api<HealthResponse>('/health').then(setHealth).catch((e) => setError(String(e)));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const testGps = () => {
    setGps('Buscando señal…');
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setGps(
          `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}` +
            (p.coords.altitude != null ? ` · ${Math.round(p.coords.altitude)} m` : '') +
            ` (±${Math.round(p.coords.accuracy)} m)`,
        ),
      (e) => setGps(`No se pudo: ${e.message}`),
      { enableHighAccuracy: true, timeout: 20000 },
    );
  };

  return (
    <main>
      <header>
        <h1>Qullqa</h1>
        <p className="sub">Gemelo digital comunitario · sierra de Arequipa</p>
      </header>

      <section className="card">
        <h2>Estado del sistema</h2>
        {error && <p className="bad">Sin conexión con el servidor: {error}</p>}
        {!health && !error && <p>Conectando…</p>}
        {health && (
          <ul>
            <li className={health.ok ? 'good' : 'bad'}>API: {health.ok ? 'en línea' : 'con problemas'}</li>
            <li className={health.db.ok ? 'good' : 'bad'}>
              Base de datos: {health.db.ok ? `PostGIS ${health.db.postgis}` : 'sin conexión'}
            </li>
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Probar el celular</h2>
        <button onClick={testGps}>Probar GPS</button>
        {gps && <p>{gps}</p>}
        {installEvt && (
          <button className="secondary" onClick={() => installEvt.prompt()}>
            Instalar Qullqa en este teléfono
          </button>
        )}
      </section>

      <footer>{DISCLAIMER}</footer>
    </main>
  );
}
