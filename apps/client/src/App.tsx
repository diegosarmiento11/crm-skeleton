import { Suspense, lazy, type ComponentType } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { RequireArea } from '@/auth/RequireArea';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LoginPage } from '@/pages/LoginPage';
import { CrmProfilesProvider } from '@/components/crm/CrmProfiles';

/**
 * Carga perezosa con un reintento: tras un despliegue, el chunk viejo ya no
 * existe y el import falla; se recarga UNA vez la página para tomar el nuevo.
 */
function lazyWithReload<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem('chunk-reload');
      return mod;
    } catch (err) {
      if (!sessionStorage.getItem('chunk-reload')) {
        sessionStorage.setItem('chunk-reload', '1');
        location.reload();
      }
      throw err;
    }
  });
}

const PipelinePage = lazyWithReload(() => import('@/pages/crm/PipelinePage').then((m) => ({ default: m.PipelinePage })));
const PeopleListPage = lazyWithReload(() => import('@/pages/crm/PeopleListPage').then((m) => ({ default: m.PeopleListPage })));
const CompaniesListPage = lazyWithReload(() => import('@/pages/crm/CompaniesListPage').then((m) => ({ default: m.CompaniesListPage })));
const FunnelPage = lazyWithReload(() => import('@/pages/crm/FunnelPage').then((m) => ({ default: m.FunnelPage })));
const TeamPage = lazyWithReload(() => import('@/pages/team/TeamPage').then((m) => ({ default: m.TeamPage })));

function Fallback() {
  return (
    <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
    </div>
  );
}

// Cada ruta lleva el MISMO área/roles que declara config/nav.ts.
export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireArea area="crm">
                <CrmProfilesProvider>
                  <DashboardLayout />
                </CrmProfilesProvider>
              </RequireArea>
            }
          >
            <Route path="/" element={<Navigate to="/crm/pipeline" replace />} />
            <Route path="/crm" element={<Navigate to="/crm/pipeline" replace />} />
            <Route path="/crm/pipeline" element={<PipelinePage />} />
            <Route path="/crm/people" element={<PeopleListPage />} />
            <Route path="/crm/companies" element={<CompaniesListPage />} />
            <Route
              path="/crm/funnel"
              element={
                <RequireArea area="crm" roles={['GERENTE']}>
                  <FunnelPage />
                </RequireArea>
              }
            />
            <Route
              path="/team"
              element={
                <RequireArea area="equipo">
                  <TeamPage />
                </RequireArea>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
