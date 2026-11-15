import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SessionProvider, useSession } from './lib/session.tsx';
import { Loading, Page } from './components/ui.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { CommunitiesPage } from './pages/CommunitiesPage.tsx';
import { CommunityLandingPage } from './pages/CommunityLandingPage.tsx';
import { CommunityPage } from './pages/CommunityPage.tsx';
import { ParcelNewPage } from './pages/ParcelNewPage.tsx';
import { ParcelDetailPage } from './pages/ParcelDetailPage.tsx';
import { ObservationPage } from './pages/ObservationPage.tsx';
import { PrioritiesPage } from './pages/PrioritiesPage.tsx';

function Private({ children }: { children: ReactNode }) {
  const { me, loading } = useSession();
  const loc = useLocation();
  if (loading) return <Page title="Qullqa"><Loading /></Page>;
  if (!me) return <Navigate to={`/ingresar?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/ingresar" element={<AuthPage />} />
          <Route path="/comunidad/:slug" element={<CommunityLandingPage />} />
          <Route path="/unirse/*" element={<Navigate to="/comunidades" replace />} />
          <Route path="/comunidades" element={<Private><CommunitiesPage /></Private>} />
          <Route path="/" element={<Private><HomePage /></Private>} />
          <Route path="/c/:cid" element={<Private><CommunityPage /></Private>} />
          <Route path="/c/:cid/prioridades" element={<Private><PrioritiesPage /></Private>} />
          <Route path="/c/:cid/parcela/nueva" element={<Private><ParcelNewPage /></Private>} />
          <Route path="/c/:cid/p/:pid" element={<Private><ParcelDetailPage /></Private>} />
          <Route path="/c/:cid/p/:pid/obs/:type" element={<Private><ObservationPage /></Private>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
