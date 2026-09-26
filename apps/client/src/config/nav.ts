import { BarChart3, Building2, KanbanSquare, Users, UsersRound } from 'lucide-react';
import type { CrmArea, TeamRole } from '@crm/shared';

type IconType = typeof KanbanSquare;

export interface NavLeaf {
  to: string;
  label: string;
  icon: IconType;
  end?: boolean;
  /** Área que gatea la entrada (y que App.tsx aplica también a la ruta). */
  area: CrmArea;
  /** Roles que además hacen falta (espejo del @RequireRole del endpoint). */
  roles?: TeamRole[];
  section?: string;
}

/**
 * Única fuente de verdad de la navegación. El sidebar la pinta y `App.tsx`
 * aplica el MISMO `area`/`roles` a cada ruta con <RequireArea>: si aquí una
 * entrada se oculta a un rol, la ruta tampoco se le abre.
 */
export const navItems: NavLeaf[] = [
  { to: '/crm/pipeline', label: 'Pipeline', icon: KanbanSquare, area: 'crm', section: 'CRM' },
  { to: '/crm/people', label: 'Personas', icon: Users, area: 'crm' },
  { to: '/crm/companies', label: 'Empresas', icon: Building2, area: 'crm' },
  { to: '/crm/funnel', label: 'Embudo', icon: BarChart3, area: 'crm', roles: ['GERENTE'] },
  { to: '/team', label: 'Equipo', icon: UsersRound, area: 'equipo', section: 'Administración' },
];
