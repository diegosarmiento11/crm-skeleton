import { z } from 'zod';
import { TEAM_ROLES } from '../enums';

const isoDate = z.string().datetime({ offset: true });

export const TeamRoleSchema = z.enum(TEAM_ROLES);

// Miembro del equipo tal como lo ve el directorio (cualquier autenticado).
export const TeamMemberSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: TeamRoleSchema,
  is_active: z.boolean(),
  last_login_at: isoDate.nullable().optional(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const TeamMemberListResponseSchema = z.object({ items: z.array(TeamMemberSchema) });
export type TeamMemberListResponse = z.infer<typeof TeamMemberListResponseSchema>;

// Quién soy: identidad + rol efectivo + áreas que alcanza. El cliente gatea rutas con esto.
export const TeamMeSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: TeamRoleSchema,
  areas: z.array(z.string()),
  // Presente solo mientras un GERENTE impersona otro rol (seam de QA).
  impersonator_role: TeamRoleSchema.optional(),
  last_login_at: isoDate.nullable().optional(),
});
export type TeamMe = z.infer<typeof TeamMeSchema>;

// Solo GERENTE: asignar rol / activar / desactivar a un miembro.
export const UpdateTeamMemberSchema = z.object({
  role: TeamRoleSchema.optional(),
  is_active: z.boolean().optional(),
  name: z.string().min(1).max(120).optional(),
});
export type UpdateTeamMemberInput = z.infer<typeof UpdateTeamMemberSchema>;
