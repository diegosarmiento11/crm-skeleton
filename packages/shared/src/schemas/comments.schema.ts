import { z } from 'zod';

const isoDate = z.string().datetime({ offset: true });

// Notas (comentarios y puntos de contacto) y tareas de seguimiento sobre entidades
// del CRM. El motor es genérico (entity_type/entity_id): otros módulos pueden
// colgar comentarios de sus propias entidades sin depender del CRM.

export const CrmEntityType = z.enum(['person', 'company', 'lead']);
export type CrmEntityTypeValue = z.infer<typeof CrmEntityType>;

// Tipo de entrada en la actividad: un comentario libre o un punto de contacto
// registrado. Los puntos de contacto (email/whatsapp/call) son los que cuentan
// como "actividad" para la salud del lead y como "contactado" para una persona.
export const CrmNoteKind = z.enum(['comment', 'email', 'whatsapp', 'call']);
export type CrmNoteKindType = z.infer<typeof CrmNoteKind>;
export const TOUCHPOINT_KINDS = ['email', 'whatsapp', 'call'] as const;

export const CrmNoteSchema = z.object({
  id: z.string().uuid(),
  entity_type: CrmEntityType,
  entity_id: z.string().uuid(),
  kind: CrmNoteKind,
  body: z.string(),
  // Nombre para mostrar de quien escribió (tal como llegó).
  author: z.string().nullable(),
  // Identidad estable (correo en minúscula) de quien escribió; la pone el servidor.
  author_id: z.string().nullable(),
  // Un nivel de hilo: la nota raíz a la que responde (null = entrada de primer nivel).
  parent_id: z.string().uuid().nullable(),
  created_at: isoDate,
});
export type CrmNote = z.infer<typeof CrmNoteSchema>;

export const CreateCrmNoteSchema = z.object({
  entity_type: CrmEntityType,
  entity_id: z.string().uuid(),
  kind: CrmNoteKind.default('comment'),
  body: z.string().min(1).max(5000),
  author: z.string().max(80).nullish(),
  parent_id: z.string().uuid().nullish(),
});
export type CreateCrmNoteInput = z.infer<typeof CreateCrmNoteSchema>;

export const UpdateCrmNoteSchema = z.object({ body: z.string().min(1).max(5000) });
export type UpdateCrmNoteInput = z.infer<typeof UpdateCrmNoteSchema>;

export const NoteListResponseSchema = z.object({ items: z.array(CrmNoteSchema) });
export type NoteListResponse = z.infer<typeof NoteListResponseSchema>;

// Tareas de seguimiento ligadas a un registro del CRM.
export const CrmTaskSchema = z.object({
  id: z.string().uuid(),
  entity_type: CrmEntityType,
  entity_id: z.string().uuid(),
  title: z.string(),
  done: z.boolean(),
  due_date: isoDate.nullable(),
  // Responsables (ids de miembro = correo). Si se omite en una tarea de lead, el
  // servidor pone al responsable del lead.
  assignees: z.array(z.string()).default([]),
  created_at: isoDate,
});
export type CrmTask = z.infer<typeof CrmTaskSchema>;

export const CreateCrmTaskSchema = z.object({
  entity_type: CrmEntityType,
  entity_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  due_date: isoDate.nullish(),
  assignees: z.array(z.string().max(120)).max(10).optional(),
});
export type CreateCrmTaskInput = z.infer<typeof CreateCrmTaskSchema>;

export const UpdateCrmTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  done: z.boolean().optional(),
  due_date: isoDate.nullish(),
  assignees: z.array(z.string().max(120)).max(10).optional(),
});
export type UpdateCrmTaskInput = z.infer<typeof UpdateCrmTaskSchema>;

export const TaskListResponseSchema = z.object({ items: z.array(CrmTaskSchema) });
export type TaskListResponse = z.infer<typeof TaskListResponseSchema>;

/** Tarea pendiente enriquecida con el nombre del registro al que pertenece. */
export const PendingCrmTaskSchema = CrmTaskSchema.extend({ entity_label: z.string().nullable() });
export type PendingCrmTask = z.infer<typeof PendingCrmTaskSchema>;

export const PendingTasksResponseSchema = z.object({ items: z.array(PendingCrmTaskSchema) });
export type PendingTasksResponse = z.infer<typeof PendingTasksResponseSchema>;
