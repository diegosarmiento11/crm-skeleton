import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { TEAM_ROLES, TEAM_ROLE_LABELS, type TeamMember, type TeamMemberListResponse, type TeamRole } from '@crm/shared';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { useUpdateTeamMember } from '@/hooks/useTeam';
import { PageHeader } from '@/components/layout/PageHeader';
import { MemberAvatar } from '@/components/team/MemberAvatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { relativeTime } from '@/lib/crm';
import { cn } from '@/lib/utils';

// El directorio de `useMembers()` excluye a los PENDIENTE (no tienen rol); aquí
// hacen falta TODOS, que es justo lo que administra esta pantalla.
const ALL_MEMBERS_KEY = ['team', 'members', 'all'] as const;

// El listado no envía todavía la fecha de último acceso; si el servidor la añade
// (ya existe en la base), la columna se llena sola.
type MemberRow = TeamMember & { last_login_at?: string | null };

export function TeamPage() {
  const { me, hasRole } = useAuth();
  const canManage = hasRole('GERENTE');
  const { data, isLoading, isError, error } = useQuery<TeamMemberListResponse>({
    queryKey: ALL_MEMBERS_KEY,
    queryFn: async () => (await api.get<TeamMemberListResponse>('/team/members')).data,
  });
  const update = useUpdateTeamMember();

  // Los PENDIENTE primero: son los que esperan una decisión del gerente.
  const rows = useMemo<MemberRow[]>(
    () =>
      [...(data?.items ?? [])].sort(
        (a, b) =>
          Number(b.role === 'PENDIENTE') - Number(a.role === 'PENDIENTE') ||
          Number(b.is_active) - Number(a.is_active) ||
          a.name.localeCompare(b.name),
      ),
    [data],
  );
  const pendingCount = rows.filter((r) => r.role === 'PENDIENTE').length;

  function save(id: string, patch: { role?: TeamRole; is_active?: boolean }, okMessage: string) {
    update.mutate(
      { id, data: patch },
      {
        onSuccess: () => toast.success(okMessage),
        onError: (e) => toast.error(`No se pudo guardar: ${apiErrorMessage(e)}`),
      },
    );
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Equipo"
        description="Un correo nuevo del dominio entra como Pendiente, sin acceso, hasta que un gerente le asigne rol."
      >
        {pendingCount > 0 ? (
          <Badge variant="secondary" className="rounded-full">
            {pendingCount} {pendingCount === 1 ? 'cuenta espera rol' : 'cuentas esperan rol'}
          </Badge>
        ) : null}
      </PageHeader>

      <div className="px-4 py-4 md:px-6">
        {!canManage ? (
          <p className="mb-3 text-sm text-muted-foreground">Solo lectura: los cambios de rol y de acceso los hace un gerente.</p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando equipo…
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No se pudo cargar el equipo: {apiErrorMessage(error)}. Recarga la página o intenta más tarde.
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Todavía no hay miembros. Pide al equipo que inicie sesión con su correo del dominio y aparecerán aquí.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Miembro</TableHead>
                  <TableHead className="hidden md:table-cell">Correo</TableHead>
                  <TableHead className="w-44">Rol</TableHead>
                  <TableHead className="w-24">Activo</TableHead>
                  <TableHead className="hidden w-40 sm:table-cell">Último acceso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => {
                  const isMe = me?.email.toLowerCase() === m.email.toLowerCase();
                  // Nadie se quita a sí mismo el rol ni el acceso: evita dejar el
                  // equipo sin gerente por un click.
                  const editable = canManage && !isMe;
                  const lockHint = isMe ? 'No puedes cambiar tu propio rol ni tu acceso' : undefined;
                  return (
                    <TableRow key={m.id} className={cn(!m.is_active && 'opacity-60')}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MemberAvatar seed={m.email} name={m.name} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {m.name || m.email}
                              {isMe ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(tú)</span> : null}
                            </div>
                            <div className="truncate text-xs text-muted-foreground md:hidden">{m.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{m.email}</TableCell>
                      <TableCell>
                        {editable ? (
                          <Select
                            value={m.role}
                            onValueChange={(v) => save(m.id, { role: v as TeamRole }, `${m.name || m.email}: ahora es ${TEAM_ROLE_LABELS[v as TeamRole]}`)}
                            disabled={update.isPending}
                          >
                            <SelectTrigger className="h-8" aria-label={`Rol de ${m.name || m.email}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TEAM_ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {TEAM_ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span title={lockHint}>
                            <Badge variant={m.role === 'PENDIENTE' ? 'outline' : 'secondary'} className="rounded-full">
                              {TEAM_ROLE_LABELS[m.role]}
                            </Badge>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span title={lockHint} className="inline-flex">
                          <Checkbox
                            checked={m.is_active}
                            disabled={!editable || update.isPending}
                            onCheckedChange={(v) =>
                              save(m.id, { is_active: v === true }, v === true ? `${m.name || m.email}: acceso activado` : `${m.name || m.email}: acceso desactivado`)
                            }
                            aria-label={`Acceso de ${m.name || m.email}`}
                          />
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {m.last_login_at ? relativeTime(m.last_login_at) : 'Sin registro'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
