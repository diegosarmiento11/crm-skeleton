import { z } from 'zod';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { STAGE_COLORS, STAGE_KINDS } from '../enums';

const isoDate = z.string().datetime({ offset: true });

// Estado de contacto: si se puede hacer outreach a esta persona/empresa.
//   CONTACTAR     se puede contactar
//   NO_CONTACTAR  pidió que no (decisión humana)
//   DE_BAJA       baja / rebote duro / queja de spam → bloqueo duro de envío. Lo
//                 pone el sistema al recibir el evento; editable a mano para revertir.
// Cualquier sistema de envío (correo, WhatsApp) DEBE respetarlo. Espejo del enum Prisma.
export const ContactStatusSchema = z.enum(['CONTACTAR', 'NO_CONTACTAR', 'DE_BAJA']);
export type ContactStatus = z.infer<typeof ContactStatusSchema>;

// Los teléfonos se guardan en E.164 (+código país + dígitos, sin espacios), p. ej.
// "+573001234567". Se validan por país con libphonenumber-js en el formulario (cliente)
// y en el DTO (servidor): UNA sola fuente de verdad.
export const PhoneE164Schema = z
  .string()
  .refine((v) => isValidPhoneNumber(v), 'Teléfono inválido (usa código de país + número)');

// ─────────────────────────── Etapas del pipeline ───────────────────────────

export const StageKindSchema = z.enum(STAGE_KINDS);
export const StageColorSchema = z.enum(STAGE_COLORS);

export const PipelineStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  position: z.number().int(),
  kind: StageKindSchema,
  created_at: isoDate,
  updated_at: isoDate,
});
export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export const CreatePipelineStageSchema = z.object({
  name: z.string().min(1).max(60),
  color: StageColorSchema.default('slate'),
  kind: StageKindSchema.default('OPEN'),
});
export type CreatePipelineStageInput = z.infer<typeof CreatePipelineStageSchema>;

export const UpdatePipelineStageSchema = CreatePipelineStageSchema.partial();
export type UpdatePipelineStageInput = z.infer<typeof UpdatePipelineStageSchema>;

export const ReorderStagesSchema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), position: z.number().int().min(0) })),
});
export type ReorderStagesInput = z.infer<typeof ReorderStagesSchema>;

export const StageListResponseSchema = z.object({ items: z.array(PipelineStageSchema) });
export type StageListResponse = z.infer<typeof StageListResponseSchema>;

// ──────────────────────────────── Leads ────────────────────────────────

// Referencia ligera de persona embebida en un Lead (contactos asociados).
export const LeadPersonRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email_addresses: z.array(z.string()).default([]),
});
export type LeadPersonRef = z.infer<typeof LeadPersonRefSchema>;

export const LeadHealthBandSchema = z.enum(['hot', 'warm', 'cold', 'at_risk']);

export const LeadSchema = z.object({
  id: z.string().uuid(),
  // Nombre del negocio tal como se ve en el tablero (suele ser la empresa).
  company: z.string(),
  stage_id: z.string().uuid(),
  position: z.number().int(),
  target_service: z.string().nullable(),
  sector: z.string().nullable(),
  source: z.string().nullable(),
  // Entero en la moneda de CRM_CURRENCY (sin centavos).
  estimated_value: z.number().int().nullable(),
  // Responsable: id estable del miembro (su correo en minúscula). null = sin asignar.
  owner: z.string().nullable(),
  company_id: z.string().uuid().nullable(),
  // Por qué se perdió: se captura al mover el lead a la etapa LOST.
  lost_reason: z.string().nullable().optional(),
  // Cuándo entró a la etapa actual (para tiempo-en-etapa).
  stage_changed_at: isoDate,
  // Personas asociadas, ordenadas. Se llenan en list/detail.
  persons: z.array(LeadPersonRefSchema).default([]),
  person_ids: z.array(z.string().uuid()).default([]),
  created_at: isoDate,
  updated_at: isoDate,
  // ── Derivados (calculados en el servidor, no se guardan) ──
  notes_count: z.number().int().optional(),
  last_activity_at: isoDate.nullable().optional(),
  health: LeadHealthBandSchema.nullable().optional(),
  health_reason: z.string().optional(),
  next_task: z
    .object({ id: z.string().uuid(), title: z.string(), due_date: isoDate.nullable() })
    .nullable()
    .optional(),
});
export type Lead = z.infer<typeof LeadSchema>;
export type LeadHealthBand = z.infer<typeof LeadHealthBandSchema>;

export const CreateLeadSchema = z.object({
  company: z.string().min(1).max(160),
  stage_id: z.string().uuid(),
  target_service: z.string().max(80).nullish(),
  sector: z.string().max(80).nullish(),
  source: z.string().max(120).nullish(),
  estimated_value: z.number().int().min(0).nullish(),
  owner: z.string().max(120).nullish(),
  company_id: z.string().uuid().nullish(),
  person_ids: z.array(z.string().uuid()).default([]),
});
export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;

export const UpdateLeadSchema = CreateLeadSchema.partial().extend({
  lost_reason: z.string().max(120).nullish(),
});
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;

// Razones canónicas de pérdida: selección única al mover un lead a LOST. El orden
// aquí ES el orden del reporte de pérdidas del embudo.
export const LOST_REASONS = [
  'Presupuesto / Precio',
  'Falta de fit (servicio vs. necesidad)',
  'Sin respuesta',
  'Tiempos / Prioridad del cliente',
  'Competencia',
] as const;

// Valores legados o escritos a mano → categoría canónica (para que el reporte no se
// fragmente). Los desconocidos se conservan tal cual.
const LOST_REASON_SYNONYMS: Record<string, string> = {
  precio: 'Presupuesto / Precio',
  'sin presupuesto': 'Presupuesto / Precio',
  presupuesto: 'Presupuesto / Precio',
  'no calificado': 'Falta de fit (servicio vs. necesidad)',
  'falta de fit': 'Falta de fit (servicio vs. necesidad)',
  ghosting: 'Sin respuesta',
  'no respondio': 'Sin respuesta',
  timing: 'Tiempos / Prioridad del cliente',
  tiempos: 'Tiempos / Prioridad del cliente',
  competencia: 'Competencia',
};

export function canonicalLostReason(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  const key = v.toLowerCase();
  const exact = LOST_REASONS.find((r) => r.toLowerCase() === key);
  return exact ?? LOST_REASON_SYNONYMS[key] ?? v;
}

export const MoveLeadSchema = z.object({
  stage_id: z.string().uuid(),
  position: z.number().int().min(0),
});
export type MoveLeadInput = z.infer<typeof MoveLeadSchema>;

export const LeadListResponseSchema = z.object({
  items: z.array(LeadSchema),
  total: z.number().int().nonnegative(),
});
export type LeadListResponse = z.infer<typeof LeadListResponseSchema>;

// ─────────────────────────── Analítica del embudo ───────────────────────────

export const FunnelStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  position: z.number().int(),
  kind: StageKindSchema,
  current_count: z.number().int(), // leads que están HOY en la etapa
  current_value: z.number().int(), // Σ estimated_value de los que están hoy
  reached_count: z.number().int(), // leads distintos que ALGUNA VEZ entraron
  conversion_from_prev: z.number().nullable(), // reached[i] / reached[i-1], 0..1
  avg_days_in_stage: z.number().nullable(), // edad promedio de los que están hoy
  // Histórico real (log lead_stage_events): días promedio que pasaron en la etapa
  // los leads que YA salieron de ella, y cuántas estadías sustentan el promedio.
  hist_avg_days: z.number().nullable(),
  hist_n: z.number().int(),
});
export type FunnelStage = z.infer<typeof FunnelStageSchema>;

// Reporte de fugas: dónde se pierde el valor. Agrupa los leads perdidos por la etapa
// en la que estaban al perderse (by_stage) o por la razón (reasons).
export const LossRowSchema = z.object({
  key: z.string(), // nombre de etapa o razón ("Sin razón" cuando no hay dato)
  color: z.string().nullable(), // color de la etapa (null en razones)
  count: z.number().int(),
  value: z.number().int(),
});
export type LossRow = z.infer<typeof LossRowSchema>;

// SLA de seguimiento: lead que lleva más del umbral en una etapa vigilada
// (QUALIFY / PROPOSAL) sin registrar actividad.
export const SlaBreachSchema = z.object({
  lead_id: z.string().uuid(),
  company: z.string(),
  owner: z.string().nullable(),
  stage_id: z.string().uuid(),
  stage_name: z.string(),
  days_in_stage: z.number().int(),
  days_since_activity: z.number().int().nullable(), // null = nunca registró actividad
});
export type SlaBreach = z.infer<typeof SlaBreachSchema>;

export const PipelineAnalyticsSchema = z.object({
  stages: z.array(FunnelStageSchema),
  totals: z.object({
    open_count: z.number().int(),
    open_value: z.number().int(),
    weighted_value: z.number().int(), // Σ valor abierto × probabilidad por etapa
    won_count: z.number().int(),
    won_value: z.number().int(),
    win_rate: z.number().nullable(), // ganados / cerrados
    avg_cycle_days: z.number().nullable(), // creación → etapa ganada
  }),
  loss: z.object({
    by_stage: z.array(LossRowSchema),
    reasons: z.array(LossRowSchema),
  }),
  // Etapa abierta donde los leads llevan más tiempo (peor velocidad).
  bottleneck: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      avg_days_in_stage: z.number().nullable(),
      conversion_from_prev: z.number().nullable(),
      current_count: z.number().int(),
    })
    .nullable(),
  sla: z.object({
    days: z.number().int(), // umbral del playbook
    stages: z.array(z.object({ id: z.string().uuid(), name: z.string() })), // vigiladas
    items: z.array(SlaBreachSchema),
  }),
});
export type PipelineAnalytics = z.infer<typeof PipelineAnalyticsSchema>;

// ─────────────────────────── Recorrido por etapas (por lead) ───────────────────────────

export const StageStaySchema = z.object({
  stage_id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  entered_at: isoDate,
  left_at: isoDate.nullable(), // null = etapa actual (sigue corriendo)
  days: z.number(),
});
export type StageStay = z.infer<typeof StageStaySchema>;

export const LeadStageHistorySchema = z.object({
  segments: z.array(StageStaySchema), // cronológico; una etapa puede repetirse
  totals: z.array(
    z.object({ stage_id: z.string().uuid(), name: z.string(), color: z.string(), days: z.number() }),
  ),
});
export type LeadStageHistory = z.infer<typeof LeadStageHistorySchema>;

// ─────────────────────────── Desempeño por persona ───────────────────────────

export const OwnerPerformanceSchema = z.object({
  owner: z.string().nullable(), // id del miembro (correo); null = sin responsable / equipo
  prospected: z.number().int(), // leads movidos a QUALIFY en el periodo
  proposals: z.number().int(), // leads movidos a PROPOSAL en el periodo
  won: z.number().int(),
  lost: z.number().int(),
  win_rate: z.number().nullable(), // won / (won + lost)
  won_value: z.number().int(),
  avg_ticket: z.number().int().nullable(), // won_value / won
  avg_cycle_days: z.number().nullable(), // creación → ganado
  open_count: z.number().int(), // abiertos asignados AHORA
  open_value: z.number().int(),
  forecast: z.number().int(), // Σ open_value × prob por etapa
  stalled: z.number().int(), // abiertos sin moverse > umbral
});
export type OwnerPerformance = z.infer<typeof OwnerPerformanceSchema>;

export const PipelinePerformanceSchema = z.object({
  from: z.string().nullable(),
  to: z.string().nullable(),
  qualify_stage: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  proposal_stage: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  stalled_days: z.number().int(),
  owners: z.array(OwnerPerformanceSchema),
  team: OwnerPerformanceSchema, // owner=null en el agregado del equipo
});
export type PipelinePerformance = z.infer<typeof PipelinePerformanceSchema>;

// ─────────────────────────── Señales + ICP ───────────────────────────

export const SignalLeadSchema = z.object({
  id: z.string().uuid(),
  company: z.string(),
  owner: z.string().nullable(),
  reason: z.string(),
  days: z.number().int(),
});
export type SignalLead = z.infer<typeof SignalLeadSchema>;

export const OverdueTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  due_date: isoDate.nullable(),
  entity_label: z.string().nullable(),
  entity_type: z.string().nullable(),
  entity_id: z.string().uuid().nullable(),
  days_overdue: z.number().int(),
});
export type OverdueTask = z.infer<typeof OverdueTaskSchema>;

export const IcpRowSchema = z.object({
  key: z.string(), // industria o ciudad
  leads: z.number().int(),
  won: z.number().int(),
  won_value: z.number().int(),
  win_rate: z.number().nullable(),
});
export type IcpRow = z.infer<typeof IcpRowSchema>;

export const CrmInsightsSchema = z.object({
  signals: z.object({
    at_risk: z.array(SignalLeadSchema),
    stuck: z.array(SignalLeadSchema),
    overdue_tasks: z.array(OverdueTaskSchema),
  }),
  icp_industry: z.array(IcpRowSchema),
  icp_city: z.array(IcpRowSchema),
});
export type CrmInsights = z.infer<typeof CrmInsightsSchema>;

// ─────────────────────────── Meta mensual (equipo) ───────────────────────────

export const CrmGoalSchema = z.object({ monthly_goal: z.number().int().min(0).nullable() });
export type CrmGoal = z.infer<typeof CrmGoalSchema>;

// ─────────────────────────── Empresas ───────────────────────────

const socialFields = {
  domain: z.string().nullable(),
  description: z.string().nullable(),
  industry: z.string().nullable(),
  primary_location: z.string().nullable(),
  linkedin: z.string().nullable(),
  instagram: z.string().nullable(),
  facebook: z.string().nullable(),
  twitter: z.string().nullable(),
};

export const CompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  contact_status: ContactStatusSchema,
  email_addresses: z.array(z.string()),
  phone_numbers: z.array(z.string()),
  ...socialFields,
  // Origen del dato (provenance), slug. null = sin origen declarado.
  source: z.string().nullish(),
  created_at: isoDate,
  updated_at: isoDate,
});
export type Company = z.infer<typeof CompanySchema>;

export const CreateCompanySchema = z.object({
  name: z.string().min(1).max(200),
  contact_status: ContactStatusSchema.default('CONTACTAR'),
  email_addresses: z.array(z.string().email()).default([]),
  phone_numbers: z.array(PhoneE164Schema).default([]),
  domain: z.string().max(200).nullish(),
  description: z.string().max(2000).nullish(),
  industry: z.string().max(120).nullish(),
  primary_location: z.string().max(200).nullish(),
  linkedin: z.string().max(300).nullish(),
  instagram: z.string().max(300).nullish(),
  facebook: z.string().max(300).nullish(),
  twitter: z.string().max(300).nullish(),
  source: z.string().max(120).nullish(),
});
export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;

export const UpdateCompanySchema = CreateCompanySchema.partial();
export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;

export const CompanyListResponseSchema = z.object({
  items: z.array(CompanySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type CompanyListResponse = z.infer<typeof CompanyListResponseSchema>;

const FacetSchema = z.object({ value: z.string(), count: z.number().int() });
export type Facet = z.infer<typeof FacetSchema>;

export const CompanyFacetsSchema = z.object({
  industries: z.array(FacetSchema),
  locations: z.array(FacetSchema),
  sources: z.array(FacetSchema),
  domain: z.array(FacetSchema), // 'with' | 'without'
});
export type CompanyFacets = z.infer<typeof CompanyFacetsSchema>;

// Referencia ligera de persona embebida en CompanyDetail.
export const PersonRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  job_title: z.string().nullable(),
  email_addresses: z.array(z.string()),
});
export type PersonRef = z.infer<typeof PersonRefSchema>;

export const CompanyDetailSchema = CompanySchema.extend({
  people: z.array(PersonRefSchema),
  leads: z.array(LeadSchema),
});
export type CompanyDetail = z.infer<typeof CompanyDetailSchema>;

// ──────────────────────────── Personas ────────────────────────────

export const PersonSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  contact_status: ContactStatusSchema,
  email_addresses: z.array(z.string()),
  phone_numbers: z.array(z.string()),
  description: z.string().nullable(),
  company_id: z.string().uuid().nullable(),
  job_title: z.string().nullable(),
  source: z.string().nullish(),
  // Industria propia (respaldo). Con empresa asociada, el cliente muestra la HEREDADA.
  industry: z.string().nullable(),
  primary_location: z.string().nullable(),
  linkedin: z.string().nullable(),
  instagram: z.string().nullable(),
  facebook: z.string().nullable(),
  twitter: z.string().nullable(),
  created_at: isoDate,
  updated_at: isoDate,
  // Último punto de contacto registrado (nota de tipo email/whatsapp/call). Solo
  // lo devuelve el listado; en create/update/detail viene ausente.
  last_touch_at: isoDate.nullable().optional(),
  last_touch_kind: z.enum(['email', 'whatsapp', 'call']).nullable().optional(),
  // Empresa embebida por el listado (para no cargar TODAS las empresas en el cliente).
  company: z
    .object({ id: z.string().uuid(), name: z.string(), industry: z.string().nullable() })
    .nullish(),
});
export type Person = z.infer<typeof PersonSchema>;

export const CreatePersonSchema = z.object({
  name: z.string().min(1).max(200),
  contact_status: ContactStatusSchema.default('CONTACTAR'),
  email_addresses: z.array(z.string().email()).default([]),
  phone_numbers: z.array(PhoneE164Schema).default([]),
  description: z.string().max(2000).nullish(),
  company_id: z.string().uuid().nullish(),
  job_title: z.string().max(160).nullish(),
  source: z.string().max(120).nullish(),
  industry: z.string().max(120).nullish(),
  primary_location: z.string().max(200).nullish(),
  linkedin: z.string().max(300).nullish(),
  instagram: z.string().max(300).nullish(),
  facebook: z.string().max(300).nullish(),
  twitter: z.string().max(300).nullish(),
});
export type CreatePersonInput = z.infer<typeof CreatePersonSchema>;

export const UpdatePersonSchema = CreatePersonSchema.partial();
export type UpdatePersonInput = z.infer<typeof UpdatePersonSchema>;

export const PersonListResponseSchema = z.object({
  items: z.array(PersonSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type PersonListResponse = z.infer<typeof PersonListResponseSchema>;

export const PeopleFacetsSchema = z.object({
  contact: z.array(FacetSchema), // 'Sin contacto' | 'Contactado'
  sources: z.array(FacetSchema),
  locations: z.array(FacetSchema),
  cargos: z.array(FacetSchema),
  industries: z.array(FacetSchema),
});
export type PeopleFacets = z.infer<typeof PeopleFacetsSchema>;

export const PersonDetailSchema = PersonSchema.extend({
  company: CompanySchema.nullable(),
  leads: z.array(LeadSchema),
});
export type PersonDetail = z.infer<typeof PersonDetailSchema>;

// Resultado de importar un CSV de personas (dedup por correo).
export const ImportPeopleResultSchema = z.object({
  total: z.number().int(),
  created: z.number().int(),
  skipped: z.number().int(),
  linked: z.number().int(), // enlazadas a su empresa por dominio de correo
});
export type ImportPeopleResult = z.infer<typeof ImportPeopleResultSchema>;
