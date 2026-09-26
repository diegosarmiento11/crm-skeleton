// Credenciales de sesión en localStorage. Aquí NO hay secretos de larga vida:
// en desarrollo es solo el correo del miembro (el servidor confía en él con
// AUTH_ENABLED=false); con un proveedor real es el token de corta vida que ese
// proveedor renueva. La impersonación es un seam de QA que solo aplica a GERENTE.

const KEYS = {
  email: 'crm.session.email',
  token: 'crm.session.token',
  impersonation: 'crm.session.impersonate',
} as const;

function slot(key: string) {
  return {
    get: (): string | null => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* almacenamiento bloqueado (modo privado): la sesión dura lo que dure la pestaña */
      }
    },
    clear: () => {
      try {
        localStorage.removeItem(key);
      } catch {
        /* idem */
      }
    },
  };
}

export const session = {
  email: slot(KEYS.email),
  token: slot(KEYS.token),
  impersonation: slot(KEYS.impersonation),
  hasCredential(): boolean {
    return Boolean(this.email.get() || this.token.get());
  },
  clear() {
    this.email.clear();
    this.token.clear();
    this.impersonation.clear();
  },
};
