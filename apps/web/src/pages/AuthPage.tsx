import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { AuthResult } from '@qullqa/shared';
import { api } from '../api.ts';
import { useSession } from '../lib/session.tsx';
import { Card, ErrorMsg, Field, InstallBanner, Page } from '../components/ui.tsx';
import { RecoveryCodeNotice } from '../components/RecoveryCode.tsx';

export function AuthPage() {
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/';
  const [mode, setMode] = useState<'register' | 'login'>(params.get('modo') === 'ingresar' ? 'login' : 'register');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const { refresh } = useSession();
  const nav = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'register' && pin !== pin2) return setError('Los dos PIN no coinciden');
    setBusy(true);
    try {
      if (mode === 'register') {
        const r = await api<AuthResult>('/auth/register', { method: 'POST', json: { name, phone, pin, acceptTerms: terms } });
        setCode(r.recoveryCode ?? null);
        if (!r.recoveryCode) await finish();
      } else {
        await api('/auth/login', { method: 'POST', json: { phone, pin } });
        await finish();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    await refresh();
    nav(next, { replace: true });
  }

  if (code) {
    return (
      <Page title="Guarda tu código">
        <Card className="accent">
          <RecoveryCodeNotice code={code} onDone={() => void finish()} />
        </Card>
      </Page>
    );
  }

  return (
    <Page title={mode === 'register' ? 'Crea tu cuenta' : 'Ingresa a Qullqa'}>
      <p className="lead">Decidamos juntos qué sembrar, con datos de la NASA y lo que tú ves en tu chacra.</p>
      <InstallBanner />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>Soy nuevo</button>
        <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Ya tengo cuenta</button>
      </div>
      <Card>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <Field label="Tu nombre" hint="Así te verán tus vecinos en tu comunidad.">
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={60} />
            </Field>
          )}
          <Field label="Número de celular">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="987 654 321" required />
          </Field>
          <Field label="PIN de 4 números" hint={mode === 'register' ? 'Lo usarás para entrar. No lo compartas.' : undefined}>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} pattern="\d{4}" required />
          </Field>
          {mode === 'register' && (
            <>
              <Field label="Repite tu PIN">
                <input value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" type="password" autoComplete="new-password" pattern="\d{4}" required />
              </Field>
              <label className="check">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
                <span>
                  Acepto los <Link to="/terminos" target="_blank">términos y condiciones</Link> y la{' '}
                  <Link to="/privacidad" target="_blank">política de privacidad</Link>.
                </span>
              </label>
            </>
          )}
          <ErrorMsg error={error} />
          <button type="submit" disabled={busy || (mode === 'register' && !terms)}>
            {busy ? 'Un momento…' : mode === 'register' ? 'Crear mi cuenta' : 'Entrar'}
          </button>
          {mode === 'login' && (
            <p className="center small" style={{ marginTop: 14 }}>
              <Link to={`/recuperar${phone ? `?tel=${encodeURIComponent(phone)}` : ''}`}>¿Olvidaste tu PIN?</Link>
            </p>
          )}
        </form>
      </Card>
    </Page>
  );
}
