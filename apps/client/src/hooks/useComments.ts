import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CrmNote,
  CrmTask,
  CreateCrmNoteInput,
  UpdateCrmNoteInput,
  CreateCrmTaskInput,
  UpdateCrmTaskInput,
  NoteListResponse,
  TaskListResponse,
  PendingTasksResponse,
} from '@crm/shared';
import { api } from '@/lib/api';
import { LEADS_KEY, type CrmEntity } from '@/hooks/useCrm';

// Notas y tareas de un registro del CRM. Cambiar una nota o una tarea también
// refresca los leads: la tarjeta muestra el contador de notas, la salud (que
// depende de la última actividad) y la próxima tarea.
export const NOTES_KEY = ['crm', 'notes'] as const;
export const TASKS_KEY = ['crm', 'tasks'] as const;

export interface EntityRef {
  entity_type: CrmEntity;
  entity_id: string;
}

export function useNotes(ref: EntityRef | null) {
  return useQuery<NoteListResponse>({
    queryKey: [...NOTES_KEY, ref?.entity_type, ref?.entity_id],
    enabled: Boolean(ref),
    queryFn: async () => (await api.get<NoteListResponse>('/crm/notes', { params: ref })).data,
  });
}

function useInvalidateActivity() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: NOTES_KEY });
    qc.invalidateQueries({ queryKey: TASKS_KEY });
    qc.invalidateQueries({ queryKey: LEADS_KEY });
  };
}

export function useCreateNote() {
  const invalidate = useInvalidateActivity();
  return useMutation<CrmNote, Error, CreateCrmNoteInput>({
    mutationFn: async (input) => (await api.post<CrmNote>('/crm/notes', input)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateNote() {
  const invalidate = useInvalidateActivity();
  return useMutation<CrmNote, Error, { id: string; data: UpdateCrmNoteInput }>({
    mutationFn: async ({ id, data }) => (await api.patch<CrmNote>(`/crm/notes/${id}`, data)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteNote() {
  const invalidate = useInvalidateActivity();
  return useMutation<unknown, Error, string>({
    mutationFn: async (id) => (await api.delete(`/crm/notes/${id}`)).data,
    onSuccess: invalidate,
  });
}

export function useTasks(ref: EntityRef | null) {
  return useQuery<TaskListResponse>({
    queryKey: [...TASKS_KEY, ref?.entity_type, ref?.entity_id],
    enabled: Boolean(ref),
    queryFn: async () => (await api.get<TaskListResponse>('/crm/tasks', { params: ref })).data,
  });
}

export function usePendingTasks(all = false) {
  return useQuery<PendingTasksResponse>({
    queryKey: [...TASKS_KEY, 'pending', all],
    queryFn: async () =>
      (await api.get<PendingTasksResponse>('/crm/tasks/pending', { params: all ? { all: 1 } : {} })).data,
  });
}

export function useCreateTask() {
  const invalidate = useInvalidateActivity();
  return useMutation<CrmTask, Error, CreateCrmTaskInput>({
    mutationFn: async (input) => (await api.post<CrmTask>('/crm/tasks', input)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateActivity();
  return useMutation<CrmTask, Error, { id: string; data: UpdateCrmTaskInput }>({
    mutationFn: async ({ id, data }) => (await api.patch<CrmTask>(`/crm/tasks/${id}`, data)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateActivity();
  return useMutation<unknown, Error, string>({
    mutationFn: async (id) => (await api.delete(`/crm/tasks/${id}`)).data,
    onSuccess: invalidate,
  });
}
