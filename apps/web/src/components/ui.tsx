import { useEffect, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DISCLAIMER } from '@qullqa/shared';
import { useInstallPrompt } from '../lib/hooks.ts';

export function Page({ title, back, children, actions, hideTitle }: { title: string; back?: string; children: ReactNode; actions?: ReactNode; hideTitle?: boolean }) {
  const nav = useNavigate();
  const { standalone } = useInstallPrompt();
  useEffect(() => {
    document.title = title === 'Qullqa' ? 'Qullqa — Decidir juntos qué sembrar' : `${title} · Qullqa`;
  }, [title]);
  return (
    <main>
      <header className="bar">
        {back && (
          <button className="icon" aria-label="Volver" onClick={() => nav(back)}>
            ←
          </button>
        )}
        <Link to="/" className="brand" aria-label="Qullqa, ir al inicio">
          <img src="/logo-qullqa.png" alt="Qullqa" width={84} height={38} />
        </Link>
        <div className="actions">
          {!standalone && <Link to="/descargar" className="getapp">Descargar app</Link>}
          {actions}
        </div>
      </header>
      {!hideTitle && <h1 className="pagetitle">{title}</h1>}
      {children}
      <SiteFooter />
    </main>
  );
}

export function SiteFooter() {
  return (
    <footer className="site">
      <nav aria-label="Información">
        <Link to="/como-funciona">Cómo funciona</Link>
        <Link to="/terminos">Términos y condiciones</Link>
        <Link to="/privacidad">Privacidad</Link>
        <Link to="/ayuda">Ayuda</Link>
        <Link to="/descargar">Descargar app</Link>
      </nav>
      <p>{DISCLAIMER}</p>
      <p>© 2026 Qullqa · Datos climáticos y satelitales de NASA y otras fuentes citadas</p>
    </footer>
  );
}

export function Card({ title, children, className = '' }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

export function ErrorMsg({ error }: { error: string | null }) {
  return error ? <p className="error" role="alert">{error}</p> : null;
}

export function Loading() {
  return <p className="muted">Cargando…</p>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Choice<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T | null;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="choices">
      {options.map((o) => (
        <button type="button" key={String(o.value)} className={`choice ${value === o.value ? 'on' : ''}`} onClick={() => onChange(o.value)}>
          <strong>{o.label}</strong>
          {o.hint && <small>{o.hint}</small>}
        </button>
      ))}
    </div>
  );
}

export function LinkButton({ to, children, variant = 'primary' }: { to: string; children: ReactNode; variant?: 'primary' | 'secondary' }) {
  return (
    <Link className={`btn ${variant}`} to={to}>
      {children}
    </Link>
  );
}

export function InstallBanner() {
  const { canInstall, install, standalone } = useInstallPrompt();
  if (standalone) return null;
  return (
    <div className="install">
      <img src="/icon-192.png" alt="" width={40} height={40} />
      <span>Instala Qullqa en tu celular para abrirla como una app.</span>
      {canInstall ? <button onClick={install}>Instalar</button> : <Link className="btn" to="/descargar">Ver cómo</Link>}
    </div>
  );
}

export function Check({ ok, children, optional }: { ok: boolean; children: ReactNode; optional?: boolean }) {
  return (
    <li className={ok ? 'done' : optional ? 'optional' : 'todo'}>
      <span aria-hidden>{ok ? '✓' : optional ? '○' : '•'}</span> {children}
    </li>
  );
}
