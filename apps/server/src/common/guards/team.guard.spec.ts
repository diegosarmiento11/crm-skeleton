import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { CrmArea, TeamRole } from '@crm/shared';
import { TeamGuard } from './team.guard';
import { REQUIRE_AREA_KEY, REQUIRE_ROLE_KEY } from '../../auth/auth-context';
import type { AppConfigService } from '../../config/config.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { IdentityProvider } from '../../auth/identity.port';

// Autorización por área: un rol solo alcanza los endpoints cuya @RequireArea está
// en su ROLE_AREAS. El proveedor de identidad se sustituye: aquí se prueba la
// autorización, no la verificación del token.
describe('TeamGuard — área, rol e impersonación', () => {
  function makeContext(impersonateRole?: string): ExecutionContext {
    const headers: Record<string, string> = {};
    if (impersonateRole) headers['x-impersonate-role'] = impersonateRole;
    const req = {
      headers,
      get(name: string) {
        return this.headers[name.toLowerCase()];
      },
    };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  }

  function makeGuard(
    role: TeamRole,
    email = 'alguien@example.com',
    opts: { isActive?: boolean; known?: boolean; identityFails?: boolean } = {},
  ) {
    const config = {
      auth: { enabled: true, teamEmailDomain: 'example.com' },
    } as unknown as AppConfigService;
    const row = { id: 't', email, name: 'X', role, is_active: opts.isActive ?? true };
    const prisma = {
      teamUser: {
        findUnique: jest.fn().mockResolvedValue(opts.known === false ? null : row),
        update: jest.fn().mockResolvedValue(row),
        create: jest.fn().mockResolvedValue({ ...row, role: 'PENDIENTE' }),
      },
    } as unknown as PrismaService;
    const identity: IdentityProvider = {
      verify: opts.identityFails
        ? jest.fn().mockRejectedValue(new UnauthorizedException('sin token'))
        : jest.fn().mockResolvedValue({ email, name: 'X' }),
    };
    return { guard: new TeamGuard(config, prisma, identity, {} as Reflector), prisma };
  }

  function run(guard: TeamGuard, area?: CrmArea, roles?: TeamRole[], impersonateRole?: string) {
    (guard as unknown as { reflector: Reflector }).reflector = {
      getAllAndOverride: (key: string) =>
        key === REQUIRE_AREA_KEY ? area : key === REQUIRE_ROLE_KEY ? roles : undefined,
    } as unknown as Reflector;
    return guard.canActivate(makeContext(impersonateRole));
  }

  it('deja entrar a COMERCIAL al área crm y le cierra equipo', async () => {
    await expect(run(makeGuard('COMERCIAL').guard, 'crm')).resolves.toBe(true);
    await expect(run(makeGuard('COMERCIAL').guard, 'equipo')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('GERENTE entra a cualquier área; PENDIENTE a ninguna', async () => {
    await expect(run(makeGuard('GERENTE').guard, 'equipo')).resolves.toBe(true);
    await expect(run(makeGuard('PENDIENTE').guard, 'crm')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('sin @RequireArea cualquier autenticado pasa (por eso el área va a nivel de clase)', async () => {
    await expect(run(makeGuard('PENDIENTE').guard, undefined)).resolves.toBe(true);
  });

  it('@RequireRole se aplica ENCIMA del área', async () => {
    await expect(run(makeGuard('GERENTE').guard, 'crm', ['GERENTE'])).resolves.toBe(true);
    await expect(run(makeGuard('COMERCIAL').guard, 'crm', ['GERENTE'])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('una cuenta desactivada no entra aunque exista', async () => {
    await expect(
      run(makeGuard('GERENTE', 'x@example.com', { isActive: false }).guard, 'crm'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un correo desconocido del dominio se auto-provisiona como PENDIENTE (y por eso no entra a crm)', async () => {
    const { guard, prisma } = makeGuard('GERENTE', 'nuevo@example.com', { known: false });
    await expect(run(guard, 'crm')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.teamUser.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'PENDIENTE' }) }),
    );
  });

  it('un correo desconocido de OTRO dominio se rechaza sin crear nada', async () => {
    const { guard, prisma } = makeGuard('GERENTE', 'x@gmail.com', { known: false });
    await expect(run(guard, 'crm')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.teamUser.create).not.toHaveBeenCalled();
  });

  it('si el proveedor de identidad falla, la petición es 401', async () => {
    await expect(
      run(makeGuard('GERENTE', 'x@example.com', { identityFails: true }).guard, 'crm'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe('impersonación (X-Impersonate-Role)', () => {
    it('un GERENTE puede actuar como COMERCIAL y hereda sus límites', async () => {
      await expect(run(makeGuard('GERENTE').guard, 'crm', undefined, 'COMERCIAL')).resolves.toBe(
        true,
      );
      await expect(
        run(makeGuard('GERENTE').guard, 'equipo', undefined, 'COMERCIAL'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('un no-GERENTE no se auto-escala', async () => {
      await expect(
        run(makeGuard('COMERCIAL').guard, 'equipo', undefined, 'GERENTE'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('un valor desconocido se ignora', async () => {
      await expect(run(makeGuard('GERENTE').guard, 'equipo', undefined, 'BOGUS')).resolves.toBe(
        true,
      );
    });
  });
});
