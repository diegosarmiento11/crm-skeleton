import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { roleCanAccess, TEAM_ROLES, type CrmArea, type TeamRole } from '@crm/shared';
import { AppConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IDENTITY_PROVIDER, type IdentityProvider } from '../../auth/identity.port';
import {
  DENY_ROLE_KEY,
  REQUIRE_AREA_KEY,
  REQUIRE_ROLE_KEY,
  type RequestTeamUser,
} from '../../auth/auth-context';

/**
 * Autentica una petición del equipo (vía IdentityProvider), resuelve su fila en
 * `team_users` (auto-provisionando un PENDIENTE la primera vez que entra alguien
 * del dominio del equipo) y, si el endpoint declara @RequireArea / @RequireRole /
 * @DenyRole, autoriza el rol contra ROLE_AREAS.
 *
 * Es el ÚNICO guard de la API de equipo. Un controlador sin él es público.
 */
@Injectable()
export class TeamGuard implements CanActivate {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const teamUser = this.applyImpersonation(req, await this.resolveTeamUser(req));
    req.teamUser = teamUser;

    const area = this.reflector.getAllAndOverride<CrmArea | undefined>(REQUIRE_AREA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (area && !roleCanAccess(teamUser.role, area)) {
      throw new ForbiddenException('No tienes acceso a esta sección');
    }

    const roles = this.reflector.getAllAndOverride<TeamRole[] | undefined>(REQUIRE_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles?.length && !roles.includes(teamUser.role)) {
      throw new ForbiddenException('Acción restringida a Gerencia');
    }

    const denied = this.reflector.getAllAndOverride<TeamRole[] | undefined>(DENY_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (denied?.includes(teamUser.role)) {
      throw new ForbiddenException('No tienes acceso a esta sección');
    }
    return true;
  }

  /**
   * Seam de QA: un GERENTE puede enviar `X-Impersonate-Role` para que todos los
   * guards autoricen como ese rol y ver las pantallas tal como las ve el equipo.
   * Cambia SOLO el rol, nunca la persona: escrituras y autorías siguen siendo suyas.
   * Se ignora para cualquier no-GERENTE (nadie se auto-escala) y para un valor desconocido.
   */
  private applyImpersonation(req: Request, teamUser: RequestTeamUser): RequestTeamUser {
    const header = req.get('x-impersonate-role')?.toUpperCase();
    if (!header || teamUser.role !== 'GERENTE') return teamUser;
    if (!TEAM_ROLES.includes(header as TeamRole)) return teamUser;
    const target = header as TeamRole;
    if (target === 'GERENTE') return teamUser;
    return { ...teamUser, role: target, impersonatorRole: 'GERENTE' };
  }

  private async resolveTeamUser(req: Request): Promise<RequestTeamUser> {
    const identity = await this.identity.verify(req);
    const email = identity.email.toLowerCase();

    const existing = await this.prisma.teamUser.findUnique({ where: { email } });
    if (existing) {
      if (!existing.is_active) throw new ForbiddenException('Tu acceso ha sido desactivado');
      await this.prisma.teamUser.update({ where: { email }, data: { last_login_at: new Date() } });
      return { id: existing.id, email: existing.email, name: existing.name, role: existing.role };
    }

    // Identidad desconocida: solo se auto-provisiona a quien es del dominio del
    // equipo, y entra como PENDIENTE (sin áreas) hasta que un GERENTE le dé rol.
    // Una cuenta externa tiene que ser invitada antes (creada en team_users).
    if (!email.endsWith(`@${this.config.auth.teamEmailDomain}`)) {
      throw new ForbiddenException(
        'Esta aplicación es solo para el equipo o invitados autorizados',
      );
    }
    const row = await this.prisma.teamUser.create({
      data: { email, name: identity.name || email, role: 'PENDIENTE', last_login_at: new Date() },
    });
    return { id: row.id, email: row.email, name: row.name, role: row.role };
  }
}
