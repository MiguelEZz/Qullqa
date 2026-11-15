import { LinkButton, Page } from '../components/ui.tsx';

export function NotFoundPage() {
  return (
    <Page title="Página no encontrada">
      <div className="center">
        <img src="/hongo.png" alt="" width={110} style={{ opacity: 0.85, margin: '16px 0' }} />
        <p className="lead">El enlace no existe o cambió. Vuelve al inicio para seguir.</p>
      </div>
      <LinkButton to="/">Ir al inicio</LinkButton>
    </Page>
  );
}
