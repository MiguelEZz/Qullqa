import { Link } from 'react-router-dom';
import { useSession } from '../lib/session.tsx';
import { Card, InstallBanner, LinkButton, Page } from '../components/ui.tsx';
import { Icon } from '../components/Icon.tsx';
import { CommunitySearch } from '../components/CommunitySearch.tsx';

export function HomePage() {
  const { me } = useSession();
  const first = me?.name.split(' ')[0] ?? '';
  const mine = me?.communities ?? [];

  return (
    <Page title={`Hola, ${first}`} variant="hero" kicker="Bienvenido">
      <InstallBanner />
      {mine.length > 0 ? (
        <>
          <Card title="Tu comunidad" icon="users">
            <ul className="navlist">
              {mine.map((c) => (
                <li key={c.id}>
                  <Link to={`/c/${c.id}`}>
                    <span className="ico-tile"><Icon name="pin" size={22} /></span>
                    <span className="txt"><strong>{c.name}</strong><small>Tus parcelas y tus datos</small></span>
                    <Icon name="chevron" />
                  </Link>
                </li>
              ))}
              {mine[0] && (
                <li>
                  <Link to={`/c/${mine[0].id}/plan`}>
                    <span className="ico-tile"><Icon name="sprout" size={22} /></span>
                    <span className="txt"><strong>Mi plan de siembra</strong><small>Qué te conviene sembrar</small></span>
                    <Icon name="chevron" />
                  </Link>
                </li>
              )}
            </ul>
          </Card>
          <LinkButton to="/comunidades" variant="secondary" icon="search">Unirme a otra comunidad</LinkButton>
        </>
      ) : (
        <>
          <p className="lead center">Para empezar, busca tu comunidad. Te unirás a los vecinos que ya marcaron sus chacras ahí.</p>
          <Card title="Busca tu comunidad" icon="search">
            <CommunitySearch autoFocus />
          </Card>
        </>
      )}
      {me?.isAdmin && <LinkButton to="/admin" variant="secondary" icon="chart">Panel de administración</LinkButton>}
    </Page>
  );
}
