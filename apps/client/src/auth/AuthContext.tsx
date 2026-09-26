import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CrmArea, TeamMe, TeamRole } from '@crm/shared';
import { api } from '@/lib/api';
import { session } from './session';

interface AuthValue {
  me: TeamMe | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: TeamRole | null;
  /** ¿El rol efectivo alcanza esta área? Mismo criterio que el servidor (ROLE_AREAS). */
  canArea: (area: CrmArea) => boolean;
  hasRole: (...roles: TeamRole[]) => boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => void;
  impersonate: (role: TeamRole | null) => void;
}

const AuthContext = createContext<AuthValue | null>(null);
export const ME_KEY = ['me'] as const;

/**
 * Sesión del equipo. El servidor es quien manda: `/me` devuelve rol y áreas y
 * el cliente solo las usa para no pintar pantallas rotas. Un 401/403 aquí
 * significa "sin sesión" o "sin rol todavía" (PENDIENTE).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const hasCredential = session.hasCredential();
  const { data, isLoading } = useQuery<TeamMe>({
    queryKey: ME_KEY,
    enabled: hasCredential,
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async () => (await api.get<TeamMe>('/me')).data,
  });

  const signIn = useCallback(
    async (email: string) => {
      session.email.set(email.trim().toLowerCase());
      await qc.invalidateQueries({ queryKey: ME_KEY });
    },
    [qc],
  );

  const signOut = useCallback(() => {
    session.clear();
    qc.clear();
    location.href = '/login';
  }, [qc]);

  const impersonate = useCallback(
    (role: TeamRole | null) => {
      if (role) session.impersonation.set(role);
      else session.impersonation.clear();
      qc.clear();
      location.reload();
    },
    [qc],
  );

  const value = useMemo<AuthValue>(() => {
    const me = data ?? null;
    return {
      me,
      isLoading: hasCredential && isLoading,
      isAuthenticated: Boolean(me),
      role: me?.role ?? null,
      canArea: (area) => Boolean(me?.areas.includes(area)),
      hasRole: (...roles) => Boolean(me && roles.includes(me.role)),
      signIn,
      signOut,
      impersonate,
    };
  }, [data, hasCredential, isLoading, signIn, signOut, impersonate]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
