import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.ts';
import { useSession } from '../lib/session.tsx';
import { ErrorMsg, LinkButton, Loading, Page } from '../components/ui.tsx';

/** Destino del QR: /unirse/ABC123 */
export function JoinLinkPage() {
  const { code = '' } = useParams();
  const { me, refresh } = useSession();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    api<{ id: string }>('/communities/join', { method: 'POST', json: { code } })
      .then(async (c) => {
        await refresh();
        nav(`/c/${c.id}`, { replace: true });
      })
      .catch((e) => setError((e as Error).message));
  }, [me, code, nav, refresh]);

  if (!me) return <Navigate to={`/ingresar?next=${encodeURIComponent(`/unirse/${code}`)}`} replace />;
  return (
    <Page title="Uniéndote…">
      {error ? (
        <>
          <ErrorMsg error={error} />
          <LinkButton to="/">Volver al inicio</LinkButton>
        </>
      ) : (
        <Loading />
      )}
    </Page>
  );
}
