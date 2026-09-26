import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { CrmArea, TeamRole } from '@crm/shared';

/** Identidad del equipo que TeamGuard adjunta a la petición. */
export interface RequestTeamUser {
  id: string;
  /** Correo en minúscula: es el id estable del miembro en todo el CRM. */
  email: string;
  name: string;
  /** Rol efectivo: el impersonado cuando la impersonación está activa. */
  role: TeamRole;
  /**
   * Solo mientras un GERENTE impersona otro rol. Guarda el rol real ('GERENTE');
   * `role` es el impersonado. La identidad (id/email/name) sigue siendo la real.
   */
  impersonatorRole?: TeamRole;
}

declare module 'express' {
  interface Request {
    teamUser?: RequestTeamUser;
  }
}

// Un endpoint anotado con @RequireArea('crm') solo lo alcanzan los roles cuya
// lista en ROLE_AREAS incluye esa área. Va a nivel de clase; sin él, cualquier
// PENDIENTE autenticado entra.
export const REQUIRE_AREA_KEY = 'require_area';
export const RequireArea = (area: CrmArea) => SetMetadata(REQUIRE_AREA_KEY, area);

// Restringe un endpoint a roles concretos, ENCIMA del área. Para acciones de
// dirección (analítica, borrar etapas, administrar el equipo).
export const REQUIRE_ROLE_KEY = 'require_role';
export const RequireRole = (...roles: TeamRole[]) => SetMetadata(REQUIRE_ROLE_KEY, roles);

// Inverso de RequireRole: bloquea roles concretos en un endpoint cuya área comparten.
export const DENY_ROLE_KEY = 'deny_role';
export const DenyRole = (...roles: TeamRole[]) => SetMetadata(DENY_ROLE_KEY, roles);

export const CurrentTeamUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestTeamUser | undefined =>
    ctx.switchToHttp().getRequest().teamUser,
);
