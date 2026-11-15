import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { OBSERVATION_META, cropName, type CommunityView, type Parcel, type Readiness } from '@qullqa/shared';
import { api } from '../api.ts';
import { useSession } from '../lib/session.tsx';
import { useApi } from '../lib/hooks.ts';
import { Card, Check, ErrorMsg, LinkButton, Loading, Page } from '../components/ui.tsx';
import { MapView } from '../components/MapView.tsx';

export function CommunityPage() {
  const { cid = '' } = useParams();
  const nav = useNavigate();
  const community = useApi<CommunityView>(`/communities/${cid}`);
  const parcels = useApi<Parcel[]>(`/communities/${cid}/my-parcels`);
  const readiness = useApi<Readiness>(`/communities/${cid}/readiness`);
  const [qr, setQr] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const { refresh } = useSession();

  const c = community.data;
  const r = readiness.data;
  const inviteUrl = c?.slug ? `${location.origin}/comunidad/${c.slug}` : '';

  useEffect(() => {
    if (showInvite && inviteUrl) void QRCode.toDataURL(inviteUrl, { width: 480, margin: 1 }).then(setQr);
  }, [showInvite, inviteUrl]);

  async function share() {
    if (navigator.share && c) {
      try {
        await navigator.share({ title: `Qullqa — ${c.name}`, text: `Únete a ${c.name} en Qullqa para decidir juntos qué sembrar.`, url: inviteUrl });
        return;
      } catch {
        /* cancelado: mostramos el QR */
      }
    }
    setShowInvite((v) => !v);
  }

  async function leave() {
    if (!confirmLeave) return setConfirmLeave(true);
    setBusy(true);
    try {
      await api(`/communities/${cid}/leave`, { method: 'POST' });
      await refresh();
      nav('/', { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      readiness.setData(await api<Readiness>(`/communities/${cid}/submit`, { method: 'POST' }));
      void community.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (community.error) return <Page title="Comunidad" back="/"><ErrorMsg error={community.error} /></Page>;
  if (!c || !r) return <Page title="Comunidad" back="/"><Loading /></Page>;

  const obsCount = r.observationTypes.length;
  const allParcels = c.parcels;

  return (
    <Page title={c.name} back="/">
      <p className="lead">
        {c.district && c.province ? `Distrito de ${c.district}, ${c.province}` : 'Comunidad'}
        {' · '}
        {c.hasValleyData ? <span className="badge green">Datos NASA del valle listos</span> : <span className="badge gray">Datos del valle en preparación</span>}
      </p>
      <Card title="Mis datos para el plan" className={r.submittedAt ? 'ok' : ''}>
        <ul className="checklist">
          <Check ok={r.hasParcel}>
            <Link to={`/c/${cid}/parcela/nueva`}>Registrar al menos una parcela</Link> (contorno, riego y qué sembraste)
          </Check>
          <Check ok={r.preferencesSaved}>
            <Link to={`/c/${cid}/prioridades`}>Mis prioridades y recursos</Link> (privado: nadie más lo ve)
          </Check>
          <Check ok={obsCount >= 3} optional>
            Observaciones de campo: {obsCount} de {Object.keys(OBSERVATION_META).length} tipos (recomendado: foto de cobertura, puño y pendiente)
          </Check>
        </ul>
        {r.submittedAt ? (
          <p className="success">
            ✓ Datos enviados el {new Date(r.submittedAt).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}. Quedan listos para el
            cálculo de la comunidad. Si cambias algo, vuelve a enviarlos.
          </p>
        ) : (
          <button onClick={submit} disabled={!r.canSubmit || busy}>
            {busy ? 'Enviando…' : r.canSubmit ? 'Enviar mis datos a la comunidad' : 'Completa lo que falta para enviar'}
          </button>
        )}
        <ErrorMsg error={error} />
      </Card>

      <Card title="Mis parcelas">
        {parcels.loading && <Loading />}
        {parcels.data?.length === 0 && <p className="muted">Aún no registras parcelas.</p>}
        <ul className="list">
          {parcels.data?.map((p) => (
            <li key={p.id}>
              <Link to={`/c/${cid}/p/${p.id}`}>
                <strong>{p.name}</strong>
                <small>
                  {p.areaHa.toFixed(2)} ha · ahora: {cropName(p.currentRotation[2])} · {p.observationCount} observaciones
                </small>
              </Link>
            </li>
          ))}
        </ul>
        <LinkButton to={`/c/${cid}/parcela/nueva`} variant="secondary">+ Agregar parcela</LinkButton>
      </Card>

      <Card title="La comunidad">
        <p className="stats">
          <span><strong>{c.memberCount}</strong> agricultores</span>
          <span><strong>{c.submittedCount}</strong> enviaron datos</span>
          <span><strong>{allParcels.length}</strong> parcelas</span>
        </p>
        <MapView
          center={c.center}
          parcels={allParcels}
          fitTo={allParcels.length ? allParcels.flatMap((p) => p.ring) : undefined}
          onParcelClick={(id) => allParcels.find((p) => p.id === id)?.mine && nav(`/c/${cid}/p/${id}`)}
          height="260px"
        />
        <p className="muted small">Amarillo: tus parcelas. Blanco: las de tus vecinos (solo se ve el contorno).</p>
        {inviteUrl && (
          <>
            <button className="secondary" onClick={share}>{showInvite ? 'Ocultar invitación' : 'Invitar a mis vecinos'}</button>
            {showInvite && (
              <div className="invite">
                {qr && <img src={qr} alt={`Código QR para unirse a ${c.name}`} />}
                <p className="small muted break">{inviteUrl}</p>
                <p className="small muted">Al escanearlo, tu vecino crea su cuenta y elige {c.name}. No necesita código.</p>
              </div>
            )}
          </>
        )}
      </Card>

      <Card title="Salir de la comunidad">
        <p className="small muted">
          Si sales, se borran tus parcelas, observaciones y prioridades de {c.name}. Los planes ya calculados no cambian.
        </p>
        <button className="danger" onClick={leave} disabled={busy}>{confirmLeave ? 'Sí, salir y borrar mis datos aquí' : `Salir de ${c.name}`}</button>
        {confirmLeave && <button className="link" onClick={() => setConfirmLeave(false)}>No, quedarme</button>}
      </Card>
    </Page>
  );
}
