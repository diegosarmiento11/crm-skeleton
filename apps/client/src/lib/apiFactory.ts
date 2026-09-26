import axios, { type AxiosInstance } from 'axios';

/**
 * Holder module-level del token de sesión (Firebase ID token). El provider de
 * auth lo mantiene fresco; el interceptor de axios lo lee para el header
 * Authorization. Vive aparte para evitar el ciclo de imports api ⇄ provider.
 */
export interface TokenHolder {
  get(): string | null;
  set(token: string | null): void;
}

export function createTokenHolder(): TokenHolder {
  let current: string | null = null;
  return {
    get: () => current,
    set: (token) => {
      current = token;
    },
  };
}

export interface ApiClientOptions {
  baseURL: string;
  /** De dónde sale el bearer token (y dónde se cachea el refrescado). */
  tokenHolder: TokenHolder;
  /**
   * Mint/refresh del token por request (p.ej. Firebase getIdToken(), que
   * refresca transparentemente cerca de expirar). Si devuelve un token se usa
   * y se cachea en el holder; si devuelve null o lanza, se usa el cacheado.
   */
  refreshToken?: () => Promise<string | null>;
  /**
   * Headers que se envían SOLO cuando no hay bearer token (seams de dev/mock:
   * X-Spencer-Key + X-Team-Email en el cockpit, X-Client-Email en el portal).
   * Los valores null/undefined/'' se omiten.
   */
  fallbackHeaders?: () => Record<string, string | null | undefined>;
  /**
   * Headers enviados SIEMPRE (con o sin bearer token), a diferencia de
   * fallbackHeaders. Se usa para el seam de impersonation (X-Impersonate-Role),
   * que debe viajar también sobre requests autenticadas con Firebase. Los
   * valores null/undefined/'' se omiten.
   */
  extraHeaders?: () => Record<string, string | null | undefined>;
}

/**
 * Fábrica compartida app ⇄ portal: instancia axios (timeout 15s) con el
 * interceptor de request que adjunta `Authorization: Bearer <token>` o, en su
 * defecto, los headers de fallback. Los interceptores de response específicos
 * (p.ej. retry en 401 del cockpit) se agregan sobre la instancia devuelta.
 */
export function createApiClient(options: ApiClientOptions): AxiosInstance {
  const { baseURL, tokenHolder, refreshToken, fallbackHeaders, extraHeaders } = options;
  const client = axios.create({ baseURL, timeout: 15_000 });

  client.interceptors.request.use(async (config) => {
    let token = tokenHolder.get();
    if (refreshToken) {
      try {
        const fresh = await refreshToken();
        if (fresh) {
          token = fresh;
          tokenHolder.set(fresh);
        }
      } catch {
        // Fall back to the cached token below.
      }
    }
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else if (fallbackHeaders) {
      for (const [name, value] of Object.entries(fallbackHeaders())) {
        if (value) config.headers.set(name, value);
      }
    }
    if (extraHeaders) {
      for (const [name, value] of Object.entries(extraHeaders())) {
        if (value) config.headers.set(name, value);
      }
    }
    return config;
  });

  return client;
}
