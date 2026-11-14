import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.ts';
import { useSession } from '../lib/session.tsx';
import { Card, ErrorMsg, Field, InstallBanner, Page } from '../components/ui.tsx';

export function AuthPage() {
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/';
  const [mode, setMode] = useState<'register' | 'login'>(params.get('modo') === 'ingresar' ? 'login' : 'register');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { refresh } = useSession();
  const nav = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') await api('/auth/register', { method: 'POST', json: { name, phone, pin } });
      else await api('/auth/login', { method: 'POST', json: { phone, pin } });
      await refresh();
      nav(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Qullqa">
      <p className="lead">Decidamos juntos qué sembrar, con datos de la NASA y lo que tú ves en tu chacra.</p>
      <InstallBanner />
      <div className="tabs">
        <button className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>Soy nuevo</button>
        <button className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Ya tengo cuenta</button>
      </div>
      <Card>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <Field label="Tu nombre">
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} />
            </Field>
          )}
          <Field label="Número de celular">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="987 654 321" required />
          </Field>
          <Field label="PIN de 4 números" hint={mode === 'register' ? 'Lo usarás para entrar. No lo compartas.' : undefined}>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} pattern="\d{4}" required />
          </Field>
          <ErrorMsg error={error} />
          <button type="submit" disabled={busy}>{busy ? 'Un momento…' : mode === 'register' ? 'Crear mi cuenta' : 'Entrar'}</button>
        </form>
      </Card>
    </Page>
  );
}
