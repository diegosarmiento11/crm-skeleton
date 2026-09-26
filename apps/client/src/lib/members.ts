import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TeamMember, TeamMemberListResponse, TeamRole } from '@crm/shared';
import { api } from '@/lib/api';

/**
 * Miembro del equipo como responsable / asignado / mencionable. El id estable es
 * el correo en minúscula (lo mismo que guarda el servidor en owner/assignees).
 * Los PENDIENTE se excluyen (no tienen rol); los inactivos se conservan para que
 * sus asignaciones históricas sigan resolviendo, marcados con `active: false`.
 */
export interface Member {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  active: boolean;
}

export const MEMBERS_KEY = ['team', 'members'] as const;

/** Id canónico de miembro: correo en minúscula. */
export function normalizeMemberId(id: string | null | undefined): string {
  return (id ?? '').trim().toLowerCase();
}

// Registro nombre-por-id a nivel de módulo, para que el helper síncrono
// `resolveMemberName` funcione en cualquier sitio (tarjetas, actividad) sin
// enhebrar la query del equipo por todas partes. Lo mantiene al día useMembers().
const nameRegistry = new Map<string, string>();

export function resolveMemberName(id: string | null | undefined): string {
  if (!id) return '—';
  return nameRegistry.get(normalizeMemberId(id)) ?? id;
}

/** Sin fotos en el esqueleto: el avatar siempre son iniciales. */
export function memberPhoto(_id: string | null | undefined): string | undefined {
  return undefined;
}

/** Hasta dos iniciales en mayúscula (o la primera letra de un correo). */
export function memberInitials(nameOrEmail: string): string {
  const base = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] : nameOrEmail;
  const parts = base.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toMember(u: TeamMember): Member {
  return { id: u.email.toLowerCase(), name: u.name || u.email, email: u.email, role: u.role, active: u.is_active };
}

export function useMembers() {
  const { data, isLoading } = useQuery<TeamMemberListResponse>({
    queryKey: MEMBERS_KEY,
    queryFn: async () => (await api.get<TeamMemberListResponse>('/team/members')).data,
    staleTime: 5 * 60_000,
  });
  return useMemo(() => {
    const all = (data?.items ?? [])
      .filter((u) => u.role !== 'PENDIENTE')
      .map(toMember)
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
    for (const m of all) nameRegistry.set(m.id, m.name);
    return {
      members: all,
      activeMembers: all.filter((m) => m.active),
      byId: new Map(all.map((m) => [m.id, m])),
      isLoading,
    };
  }, [data, isLoading]);
}

export function findMember(members: Member[], id: string | null | undefined): Member | undefined {
  if (!id) return undefined;
  const key = normalizeMemberId(id);
  return members.find((m) => m.id === key);
}
