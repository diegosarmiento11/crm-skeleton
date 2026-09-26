import { AxiosError } from 'axios';
import { createApiClient } from '@/lib/apiFactory';
import { session } from '@/auth/session';

/**
 * Cliente HTTP único. La identidad viaja en cada petición:
 *  - con un proveedor real: `Authorization: Bearer <token>` (session.token);
 *  - en desarrollo (AUTH_ENABLED=false en el servidor): `X-Team-Email`.
 * Y el seam de QA `X-Impersonate-Role`, que el servidor solo honra a un GERENTE.
 */
const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8082/api/v1';

export const api = createApiClient({
  baseURL,
  tokenHolder: {
    get: () => session.token.get(),
    set: (t) => (t ? session.token.set(t) : session.token.clear()),
  },
  fallbackHeaders: () => ({ 'X-Team-Email': session.email.get() }),
  extraHeaders: () => ({ 'X-Impersonate-Role': session.impersonation.get() }),
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    // Solo se fuerza el re-login cuando una credencial fue rechazada de verdad.
    if (err.response?.status === 401 && session.hasCredential() && location.pathname !== '/login') {
      session.clear();
      location.href = '/login';
    }
    return Promise.reject(err);
  },
);

/** El mensaje que escribió el servidor, no el genérico de axios. Nest manda `message` (string o lista con Zod). */
export function apiErrorMessage(err: unknown): string {
  const data = (err as AxiosError<{ message?: string | string[] }>).response?.data;
  const message = data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message || (err as Error).message;
}
