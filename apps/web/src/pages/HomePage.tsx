import { Link } from 'react-router-dom';
import { useSession } from '../lib/session.tsx';
import { Card, InstallBanner, LinkButton, Page } from '../components/ui.tsx';
import { CommunitySearch } from '../components/CommunitySearch.tsx';

export function HomePage() {
  const { me } = useSession();
  const first = me?.name.split(' ')[0] ?? '';
  const mine = me?.communities ?? [];

  return (
    <Page title={`Hola, ${first}`} actions={<Link to="/cuenta" className="badge gray" aria-label="Mi cuenta">Mi cuenta</Link>}>
      <InstallBanner />
      {me?.isAdmin && <LinkButton to="/admin" variant="secondary">Panel de administración</LinkButton>}
      {mine.length > 0 ? (
        <>
          <p className="lead">Elige tu comunidad para ver tus parcelas y el plan.</p>
          <Card title="Mis comunidades">
            <ul className="list">
              {mine.map((c) => (
                <li key={c.id}>
                  <Link to={`/c/${c.id}`}>
                    <strong>{c.name}</strong>
                    <small>Ver mis parcelas, datos y plan →</small>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <LinkButton to="/comunidades" variant="secondary">Unirme a otra comunidad</LinkButton>
        </>
      ) : (
        <>
          <p className="lead">Para empezar, busca tu comunidad. Te unirás a los vecinos que ya marcaron sus parcelas ahí.</p>
          <Card>
            <CommunitySearch autoFocus />
          </Card>
        </>
      )}
    </Page>
  );
}
