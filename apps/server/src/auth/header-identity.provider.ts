import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { IdentityProvider, VerifiedIdentity } from './identity.port';

/**
 * Seam de desarrollo y pruebas (AUTH_ENABLED=false): la identidad viene en la
 * cabecera `X-Team-Email`, sin verificar. Sirve para trabajar en local y para los
 * e2e sin un proveedor real. `validateEnv` impide que llegue a producción.
 */
@Injectable()
export class HeaderIdentityProvider implements IdentityProvider {
  async verify(req: Request): Promise<VerifiedIdentity> {
    const email = req.get('x-team-email')?.trim().toLowerCase();
    if (!email) {
      throw new UnauthorizedException('Falta la cabecera X-Team-Email (AUTH_ENABLED=false)');
    }
    return { email, name: req.get('x-team-name') ?? null };
  }
}

/**
 * Marcador para producción: obliga a registrar un proveedor real. Se deja aquí a
 * propósito para que un despliegue con AUTH_ENABLED=true y sin proveedor falle
 * en la primera petición con un mensaje claro, no en silencio.
 */
@Injectable()
export class UnconfiguredIdentityProvider implements IdentityProvider {
  async verify(): Promise<VerifiedIdentity> {
    throw new UnauthorizedException(
      'No hay IdentityProvider configurado: registra uno en AuthModule (ver auth/identity.port.ts)',
    );
  }
}
