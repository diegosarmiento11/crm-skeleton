import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TeamMember, UpdateTeamMemberInput } from '@crm/shared';
import { api } from '@/lib/api';
import { MEMBERS_KEY } from '@/lib/members';

// El directorio se lee con `useMembers()` (lib/members.ts). Aquí solo la
// administración (GERENTE): rol y activación.
export function useUpdateTeamMember() {
  const qc = useQueryClient();
  return useMutation<TeamMember, Error, { id: string; data: UpdateTeamMemberInput }>({
    mutationFn: async ({ id, data }) => (await api.patch<TeamMember>(`/team/members/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: MEMBERS_KEY }),
  });
}
