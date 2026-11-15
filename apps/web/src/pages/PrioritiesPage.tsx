import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CROPS, INDICATORS, type Coins, type Constraints, type CropId, type IndicatorId, type PreferencesView } from '@qullqa/shared';
import { api } from '../api.ts';
import { useApi } from '../lib/hooks.ts';
import { Card, Choice, ErrorMsg, Field, Loading, Page } from '../components/ui.tsx';

const EMPTY_COINS = Object.fromEntries(INDICATORS.map((i) => [i.id, 0])) as Coins;
const DEFAULT_CONSTRAINTS: Constraints = { traction: 'yunta', familyWorkers: 2, canGetExtraLabor: true, market: 'mixto', livestockHeads: 0 };

export function PrioritiesPage() {
  const { cid = '' } = useParams();
  const nav = useNavigate();
  const saved = useApi<PreferencesView | null>(`/communities/${cid}/preferences`);
  const [coins, setCoins] = useState<Coins>(EMPTY_COINS);
  const [constraints, setConstraints] = useState<Constraints>(DEFAULT_CONSTRAINTS);
  const [vetoes, setVetoes] = useState<CropId[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (saved.data) {
      setCoins(saved.data.coins);
      setConstraints(saved.data.constraints);
      setVetoes(saved.data.vetoes);
    }
  }, [saved.data]);

  const used = Object.values(coins).reduce((a, b) => a + b, 0);
  const left = 10 - used;
  const add = (id: IndicatorId, d: number) => setCoins((c) => ({ ...c, [id]: Math.max(0, Math.min(10, c[id] + d)) }));
  const setC = <K extends keyof Constraints>(k: K) => (v: Constraints[K]) => setConstraints((c) => ({ ...c, [k]: v }));

  async function save() {
    if (left !== 0) return setError(left > 0 ? `Te faltan repartir ${left} monedas.` : 'Repartiste más de 10 monedas.');
    setBusy(true);
    setError(null);
    try {
      await api(`/communities/${cid}/preferences`, { method: 'PUT', json: { coins, constraints, vetoes } });
      nav(`/c/${cid}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (saved.loading) return <Page title="Mis prioridades" back={`/c/${cid}`}><Loading /></Page>;

  return (
    <Page title="Mis prioridades" back={`/c/${cid}`}>
      <p className="lead small">🔒 Esto es privado. Tus vecinos no lo ven; solo lo usa el cálculo para buscar un plan que te convenga.</p>

      <Card title="¿Qué es lo más importante para ti?">
        <p className="muted small">Tienes 10 monedas. Pon más monedas en lo que más te importa.</p>
        <p className={`coins-left ${left === 0 ? 'ok' : ''}`}>{left === 0 ? '✓ Repartiste las 10 monedas' : `Te quedan ${left} monedas`}</p>
        <ul className="coins">
          {INDICATORS.map((i) => (
            <li key={i.id}>
              <div>
                <strong>{i.label}</strong>
                <small>{i.hint}</small>
              </div>
              <div className="stepper">
                <button type="button" aria-label={`Quitar moneda a ${i.label}`} onClick={() => add(i.id, -1)} disabled={coins[i.id] === 0}>−</button>
                <span aria-label={`${coins[i.id]} monedas`}>{'●'.repeat(coins[i.id]) || '·'}</span>
                <button type="button" aria-label={`Poner moneda en ${i.label}`} onClick={() => add(i.id, 1)} disabled={left === 0}>+</button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Mis recursos">
        <Field label="¿Con qué preparas la tierra?">
          <Choice value={constraints.traction} onChange={setC('traction')} options={[{ value: 'manual', label: 'A mano' }, { value: 'yunta', label: 'Yunta' }, { value: 'tractor', label: 'Tractor' }]} />
        </Field>
        <div className="row">
          <Field label="Personas de tu familia que trabajan la chacra">
            <input type="number" inputMode="numeric" min={0} max={30} value={constraints.familyWorkers} onChange={(e) => setC('familyWorkers')(Number(e.target.value))} />
          </Field>
          <Field label="Animales (cabezas)" hint="vacas, ovejas, alpacas…">
            <input type="number" inputMode="numeric" min={0} max={1000} value={constraints.livestockHeads} onChange={(e) => setC('livestockHeads')(Number(e.target.value))} />
          </Field>
        </div>
        <Field label="¿Puedes conseguir más mano de obra (peones, ayni, mink'a)?">
          <Choice value={constraints.canGetExtraLabor ? 'si' : 'no'} onChange={(v) => setC('canGetExtraLabor')(v === 'si')} options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]} />
        </Field>
        <Field label="¿A dónde va tu cosecha?">
          <Choice value={constraints.market} onChange={setC('market')} options={[{ value: 'autoconsumo', label: 'Para la casa' }, { value: 'feria_local', label: 'Feria local' }, { value: 'intermediario', label: 'Intermediario' }, { value: 'mixto', label: 'Un poco de todo' }]} />
        </Field>
      </Card>

      <Card title="Cultivos que NO quieres sembrar">
        <div className="chips">
          {CROPS.map((c) => {
            const on = vetoes.includes(c.id);
            return (
              <button type="button" key={c.id} className={`chip ${on ? 'on' : ''}`} onClick={() => setVetoes((v) => (on ? v.filter((x) => x !== c.id) : [...v, c.id]))}>
                {on ? '✕ ' : ''}{c.name}
              </button>
            );
          })}
        </div>
      </Card>

      <ErrorMsg error={error} />
      <button onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar mis prioridades'}</button>
    </Page>
  );
}
