import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { OBSERVATION_META, cropName, type ObservationType } from '@qullqa/shared';
import { api } from '../api.ts';
import { useApi } from '../lib/hooks.ts';
import { Card, ErrorMsg, Loading, Page } from '../components/ui.tsx';
import { BarList, Columns, Stat, groupOf } from '../components/charts.tsx';

interface Overview {
  totals: Record<'users' | 'users7' | 'communities' | 'submitted' | 'parcels' | 'hectares' | 'observations' | 'runs' | 'runs_failed' | 'run_avg_ms', number>;
  signups: { day: string; n: number }[];
  obsByType: { type: string; n: number }[];
  cropArea: { crop: string; ha: number; parcels: number }[];
  communities: {
    id: string; name: string; province: string | null; is_demo: boolean; has_valley: boolean; members: number; submitted: number;
    parcels: number; hectares: number; observations: number; frosts: number; last_run: string | null; last_status: string | null;
  }[];
}

const fmt = (n: number, d = 0) => n.toLocaleString('es-PE', { maximumFractionDigits: d });

export function AdminPage() {
  const o = useApi<Overview>('/admin/overview');
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function demo() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>('/admin/demo', { method: 'POST' });
      nav(`/admin/c/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (o.error) return <Page title="Panel" back="/"><ErrorMsg error={o.error} /></Page>;
  if (!o.data) return <Page title="Panel" back="/"><Loading /></Page>;
  const { totals: t, signups, obsByType, cropArea, communities } = o.data;
  const demoCommunity = communities.find((c) => c.is_demo);

  return (
    <Page title="Panel de Qullqa" back="/">
      <p className="lead">Datos reales de la app (sin la comunidad demo). Las familias aparecen anónimas.</p>

      <div className="stats-grid">
        <Stat label="agricultores" value={fmt(t.users)} hint={`${t.users7} nuevos en 7 días`} />
        <Stat label="comunidades activas" value={fmt(t.communities)} />
        <Stat label="enviaron datos" value={fmt(t.submitted)} />
        <Stat label="parcelas" value={fmt(t.parcels)} />
        <Stat label="hectáreas" value={fmt(t.hectares, 1)} />
        <Stat label="observaciones" value={fmt(t.observations)} />
        <Stat label="planes calculados" value={fmt(t.runs)} hint={`${t.runs_failed} fallaron`} />
        <Stat label="segundos por cálculo" value={fmt(t.run_avg_ms / 1000, 1)} />
      </div>

      <Card title="Simulación: comunidad demo">
        <p className="small">
          10 familias <strong>sintéticas</strong> con 20 parcelas en andenes reales de Chivay–Coporaque (3 440–3 760 m). Sirve para ver qué recomienda el
          cerebro y cómo lo ve cada familia en su celular. No se mezcla con los datos reales.
        </p>
        <ErrorMsg error={error} />
        {demoCommunity && <Link className="btn" to={`/admin/c/${demoCommunity.id}`}>Ver la comunidad demo</Link>}
        <button className={demoCommunity ? 'secondary' : ''} onClick={demo} disabled={busy}>
          {busy ? 'Creando…' : demoCommunity ? 'Regenerar la demo desde cero' : 'Crear la comunidad demo'}
        </button>
      </Card>

      <Card title="Comunidades">
        {communities.length === 0 && <p className="muted">Todavía nadie se unió a una comunidad.</p>}
        <ul className="list">
          {communities.map((c) => (
            <li key={c.id}>
              <Link to={`/admin/c/${c.id}`}>
                {c.is_demo ? <span className="badge gray">demo</span> : c.has_valley ? <span className="badge green">datos NASA</span> : <span className="badge">sin datos del valle</span>}
                <strong>{c.name}</strong>
                <small>
                  {c.members} familias · {c.submitted} enviaron · {c.parcels} parcelas ({fmt(c.hectares, 1)} ha) · {c.observations} observaciones
                  {c.frosts ? ` · ${c.frosts} heladas reportadas` : ''}
                  {' · '}{c.last_run ? `plan del ${new Date(c.last_run).toLocaleDateString('es-PE')}` : c.last_status ? `plan: ${c.last_status}` : 'sin plan'}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Registros por día (últimos 30 días)">
        <Columns data={signups.map((s) => ({ label: s.day.slice(8), value: s.n, hint: `${s.day}: ${s.n} registros` }))} unit="registros" labelEvery={5} height={130} />
      </Card>

      <div className="two-col">
        <Card title="Qué se siembra hoy (ha)">
          {cropArea.length ? (
            <BarList rows={cropArea.map((c) => ({ label: cropName(c.crop), value: c.ha, color: groupOf(c.crop).color, hint: `${cropName(c.crop)}: ${fmt(c.ha, 2)} ha en ${c.parcels} parcelas` }))} unit="ha" digits={2} />
          ) : <p className="muted small">Sin parcelas todavía.</p>}
          <p className="small muted">Campaña en curso que registró cada familia.</p>
        </Card>
        <Card title="Observaciones de campo">
          {obsByType.length ? (
            <BarList rows={obsByType.map((x) => ({ label: OBSERVATION_META[x.type as ObservationType]?.label ?? x.type, value: x.n }))} color="var(--green)" />
          ) : <p className="muted small">Aún no hay observaciones.</p>}
        </Card>
      </div>
    </Page>
  );
}
