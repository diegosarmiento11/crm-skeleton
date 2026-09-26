import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ViewPref, ViewPrefConfig } from '@crm/shared';
import { api } from '@/lib/api';

const KEY = (entity: string) => ['crm', 'view-prefs', entity] as const;

/** The current user's saved table config for an entity (people | companies). */
export function useViewPref(entity: string) {
  return useQuery<ViewPref>({
    queryKey: KEY(entity),
    queryFn: async () => (await api.get<ViewPref>(`/crm/view-prefs/${entity}`)).data,
  });
}

export function useSaveViewPref(entity: string) {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, ViewPrefConfig>({
    mutationFn: async (config) =>
      (await api.put<{ ok: true }>(`/crm/view-prefs/${entity}`, { config })).data,
    // Optimistic: keep the local copy so the UI never flickers back to default.
    onMutate: (config) => {
      qc.setQueryData<ViewPref>(KEY(entity), { entity, config });
    },
  });
}
