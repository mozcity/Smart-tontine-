import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router';
import '@fontsource-variable/inter';
import './styles.css';
import { applyTheme, watchSystemTheme } from './lib/theme';
import { AuthProvider } from './lib/auth';
import { Loading, UiProvider } from './components/ui';
import { PublicLayout } from './components/PublicLayout';
import { RequireAuth } from './components/RequireAuth';
import Home from './pages/public/Home';
import NotFound from './pages/public/NotFound';

// Le site public est chargé tout de suite ; l'espace membre et le portail partenaire à la demande.
const page = (load: () => Promise<{ default: React.ComponentType }>) => {
  const C = lazy(load);
  return <Suspense fallback={<Loading />}><C /></Suspense>;
};
const guarded = (el: React.ReactNode) => <RequireAuth>{el}</RequireAuth>;

const router = createBrowserRouter([
  {
    element: <UiProvider><Outlet /></UiProvider>,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/decouvrir', element: page(() => import('./pages/public/Decouvrir')) },
          { path: '/partenaires', element: page(() => import('./pages/public/Partenaires')) },
          { path: '/partenaires/:id', element: page(() => import('./pages/public/Vitrine')) },
          { path: '/tarifs', element: page(() => import('./pages/public/Tarifs')) },
          { path: '/devenir-partenaire', element: page(() => import('./pages/public/DevenirPartenaire')) },
          { path: '/rejoindre/:code', element: page(() => import('./pages/public/Rejoindre')) },
          { path: '/connexion', element: page(() => import('./pages/public/Connexion')) },
          { path: '/legal', element: page(() => import('./pages/public/Legal')) },
          { path: '*', element: <NotFound /> },
        ],
      },
      { path: '/app/*', element: guarded(page(() => import('./pages/app/MemberApp'))) },
      { path: '/partenaire/*', element: guarded(page(() => import('./pages/partner/PartnerPortal'))) },
    ],
  },
]);

applyTheme();
watchSystemTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider><RouterProvider router={router} /></AuthProvider>
  </StrictMode>,
);
