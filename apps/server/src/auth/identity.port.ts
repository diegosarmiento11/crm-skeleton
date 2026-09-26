import type { Request } from 'express';

/** Lo que el CRM necesita saber de quien llama, venga de donde venga. */
export interface VerifiedIdentity {
  /** Correo verificado por el proveedor (se normaliza a minúscula). */
  email: string;
  /** Nombre para mostrar, si el proveedor lo trae. */
  name?: string | null;
}

/**
 * Puerto de identidad: la frontera entre "quién eres" (proveedor: Firebase, Auth0,
 * Cognito, un JWT propio…) y "qué puedes hacer" (rol y áreas, que viven en
 * `team_users` y en ROLE_AREAS). El guard solo conoce esta interfaz.
 *
 * Para producción se registra una implementación que verifique el `Authorization:
 * Bearer <token>` contra el proveedor elegido y devuelva el correo verificado (o
 * lance UnauthorizedException). `HeaderIdentityProvider` es el seam de desarrollo.
 */
export interface IdentityProvider {
  verify(req: Request): Promise<VerifiedIdentity>;
}

export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');
