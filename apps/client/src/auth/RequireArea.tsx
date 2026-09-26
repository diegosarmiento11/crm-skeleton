import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { TEAM_ROLE_LABELS, type CrmArea, type TeamRole } from '@crm/shared';
import { Button } from '@/components/ui/button';
import { useAuth } from './AuthContext';

interface Props {
  area: CrmArea;
  /** Además del área, restringe a estos roles (espejo de @RequireRole en el servidor). */
  roles?: TeamRole[];
  children: ReactNode;
}

/**
 * Gatea un subárbol por área (y opcionalmente por rol). Sin sesión → /login;
 * con sesión pero sin permiso → aviso 403 en el sitio. El gating del cliente
 * evita pantallas rotas: los datos los protege el servidor.
 */
export function RequireArea({ area, roles, children }: Props) {
  const { canArea, hasRole, isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando tu sesión…
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!canArea(area) || (roles && !hasRole(...roles))) {
    return (
      <div className="container max-w-md space-y-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <div>
          <h1 className="text-xl font-semibold">Acceso restringido</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {role === 'PENDIENTE'
              ? 'Tu cuenta existe pero aún no tiene rol. Pide a un gerente que te asigne uno.'
              : `Tu rol actual${role ? ` (${TEAM_ROLE_LABELS[role]})` : ''} no tiene permiso para esta sección.`}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/">Volver al inicio</Link>
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
