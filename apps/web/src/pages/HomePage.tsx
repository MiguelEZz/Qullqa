import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.ts';
import { useSession } from '../lib/session.tsx';
import { Card, ErrorMsg, Field, InstallBanner, Page } from '../components/ui.tsx';

export function HomePage() {
  const { me, refresh, logout } = useSession();
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function join(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const c = await api<{ id: string }>('/communities/join', { method: 'POST', json: { code } });
      await refresh();
      nav(`/c/${c.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const c = await api<{ id: string }>('/communities', { method: 'POST', json: { name } });
      await refresh();
      nav(`/c/${c.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Page title={`Hola, ${me?.name.split(' ')[0] ?? ''}`} actions={<button className="link" onClick={logout}>Salir</button>}>
      <InstallBanner />
      {me && me.communities.length > 0 && (
        <Card title="Mis comunidades">
          <ul className="list">
            {me.communities.map((c) => (
              <li key={c.id}>
                <Link to={`/c/${c.id}`}>
                  <strong>{c.name}</strong>
                  <small>{c.role === 'coordinator' ? 'Coordinador(a)' : 'Miembro'}</small>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Unirme a una comunidad">
        <form onSubmit={join}>
          <Field label="Código de 6 letras" hint="Te lo da el coordinador, o escanea su código QR.">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} className="code" autoCapitalize="characters" required minLength={6} />
          </Field>
          <button type="submit">Unirme</button>
        </form>
      </Card>

      {showCreate ? (
        <Card title="Crear una comunidad">
          <form onSubmit={create}>
            <Field label="Nombre" hint="Por ejemplo: Comunidad campesina de Yanque">
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} />
            </Field>
            <button type="submit">Crear y ser coordinador(a)</button>
          </form>
        </Card>
      ) : (
        <button className="secondary" onClick={() => setShowCreate(true)}>Soy coordinador(a): crear comunidad</button>
      )}
      <ErrorMsg error={error} />
    </Page>
  );
}
