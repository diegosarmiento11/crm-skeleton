import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Lead,
  LeadListResponse,
  CreateLeadInput,
  UpdateLeadInput,
  MoveLeadInput,
  PipelineAnalytics,
  PipelinePerformance,
  LeadStageHistory,
  CrmInsights,
  CrmGoal,
  PipelineStage,
  StageListResponse,
  CreatePipelineStageInput,
  UpdatePipelineStageInput,
  ReorderStagesInput,
  Company,
  CompanyDetail,
  CompanyListResponse,
  CompanyFacets,
  CreateCompanyInput,
  UpdateCompanyInput,
  Person,
  PersonDetail,
  PersonListResponse,
  PeopleFacets,
  CreatePersonInput,
  UpdatePersonInput,
  ImportPeopleResult,
} from '@crm/shared';
import { api } from '@/lib/api';

// Un hook por dominio y las claves como constantes: las mutaciones invalidan por
// PREFIJO (`['crm']`, `LEADS_KEY`), nunca clave por clave repartida por el archivo.
export const CRM_KEY = ['crm'] as const;
export const STAGES_KEY = ['crm', 'stages'] as const;
export const LEADS_KEY = ['crm', 'leads'] as const;
export const PEOPLE_KEY = ['crm', 'people'] as const;
export const COMPANIES_KEY = ['crm', 'companies'] as const;
export const ANALYTICS_KEY = ['crm', 'analytics'] as const;

export type CrmEntity = 'person' | 'company' | 'lead';

export interface LeadFilters {
  stage_id?: string;
  owner?: string;
  q?: string;
}

const csv = (v?: string[]) => (v?.length ? v.join(',') : undefined);

// ───────────────────────────── Etapas ─────────────────────────────

export function useStages() {
  return useQuery<StageListResponse>({
    queryKey: STAGES_KEY,
    staleTime: 60_000,
    queryFn: async () => (await api.get<StageListResponse>('/crm/stages')).data,
  });
}

export function useCreateStage() {
  const qc = useQueryClient();
  return useMutation<PipelineStage, Error, CreatePipelineStageInput>({
    mutationFn: async (input) => (await api.post<PipelineStage>('/crm/stages', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: STAGES_KEY }),
  });
}

export function useUpdateStage() {
  const qc = useQueryClient();
  return useMutation<PipelineStage, Error, { id: string; data: UpdatePipelineStageInput }>({
    mutationFn: async ({ id, data }) => (await api.patch<PipelineStage>(`/crm/stages/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: STAGES_KEY }),
  });
}

export function useReorderStages() {
  const qc = useQueryClient();
  return useMutation<StageListResponse, Error, ReorderStagesInput>({
    mutationFn: async (input) => (await api.patch<StageListResponse>('/crm/stages/reorder', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: STAGES_KEY }),
  });
}

export function useDeleteStage() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: async (id) => (await api.delete(`/crm/stages/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CRM_KEY }),
  });
}

// ───────────────────────────── Analítica ─────────────────────────────

export interface DateRange {
  from?: string;
  to?: string;
}

export function usePipelineAnalytics(range?: DateRange, enabled = true) {
  const params = { ...(range?.from ? { from: range.from } : {}), ...(range?.to ? { to: range.to } : {}) };
  return useQuery<PipelineAnalytics>({
    queryKey: [...ANALYTICS_KEY, 'funnel', params],
    enabled,
    queryFn: async () => (await api.get<PipelineAnalytics>('/crm/pipeline/analytics', { params })).data,
  });
}

export function usePipelinePerformance(range?: DateRange, enabled = true) {
  const params = { ...(range?.from ? { from: range.from } : {}), ...(range?.to ? { to: range.to } : {}) };
  return useQuery<PipelinePerformance>({
    queryKey: [...ANALYTICS_KEY, 'performance', params],
    enabled,
    queryFn: async () => (await api.get<PipelinePerformance>('/crm/pipeline/performance', { params })).data,
  });
}

export function useCrmInsights(enabled = true) {
  return useQuery<CrmInsights>({
    queryKey: [...ANALYTICS_KEY, 'insights'],
    enabled,
    queryFn: async () => (await api.get<CrmInsights>('/crm/insights')).data,
  });
}

export function useCrmGoal() {
  return useQuery<CrmGoal>({
    queryKey: [...ANALYTICS_KEY, 'goal'],
    queryFn: async () => (await api.get<CrmGoal>('/crm/settings/goal')).data,
  });
}

export function useSetCrmGoal() {
  const qc = useQueryClient();
  return useMutation<CrmGoal, Error, CrmGoal>({
    mutationFn: async (data) => (await api.patch<CrmGoal>('/crm/settings/goal', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ANALYTICS_KEY }),
  });
}

// ───────────────────────────── Leads ─────────────────────────────

export function useLeads(filters: LeadFilters = {}) {
  return useQuery<LeadListResponse>({
    queryKey: [...LEADS_KEY, filters],
    queryFn: async () => (await api.get<LeadListResponse>('/crm/leads', { params: filters })).data,
  });
}

export function useLead(id: string | undefined) {
  return useQuery<Lead>({
    queryKey: [...LEADS_KEY, 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<Lead>(`/crm/leads/${id}`)).data,
  });
}

export function useLeadStageHistory(id: string | undefined, enabled = true) {
  return useQuery<LeadStageHistory>({
    queryKey: [...LEADS_KEY, 'stage-history', id],
    enabled: Boolean(id) && enabled,
    queryFn: async () => (await api.get<LeadStageHistory>(`/crm/leads/${id}/stage-history`)).data,
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation<Lead, Error, CreateLeadInput>({
    mutationFn: async (input) => (await api.post<Lead>('/crm/leads', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CRM_KEY }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation<Lead, Error, { id: string; data: UpdateLeadInput }>({
    mutationFn: async ({ id, data }) => (await api.patch<Lead>(`/crm/leads/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CRM_KEY }),
  });
}

export function useMoveLead() {
  const qc = useQueryClient();
  return useMutation<Lead, Error, { id: string; data: MoveLeadInput }>({
    mutationFn: async ({ id, data }) => (await api.patch<Lead>(`/crm/leads/${id}/move`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: LEADS_KEY }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: async (id) => (await api.delete(`/crm/leads/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CRM_KEY }),
  });
}

// ──────────────────────────── Empresas ────────────────────────────

export interface CompaniesQuery {
  q?: string;
  industry?: string[];
  city?: string[];
  source?: string[];
  domain?: string[]; // 'with' | 'without'
  page?: number;
  limit?: number;
}

export function useCompanies(params: CompaniesQuery = {}, enabled = true) {
  const { q, industry, city, source, domain, page = 1, limit = 100 } = params;
  return useQuery<CompanyListResponse>({
    queryKey: [...COMPANIES_KEY, { q: q ?? '', industry, city, source, domain, page, limit }],
    enabled,
    placeholderData: (prev) => prev, // mantiene la página anterior mientras carga la siguiente
    queryFn: async () =>
      (
        await api.get<CompanyListResponse>('/crm/companies', {
          params: { q: q || undefined, industry: csv(industry), city: csv(city), source: csv(source), domain: csv(domain), page, limit },
        })
      ).data,
  });
}

export function useCompanyFacets() {
  return useQuery<CompanyFacets>({
    queryKey: [...COMPANIES_KEY, 'facets'],
    staleTime: 60_000,
    queryFn: async () => (await api.get<CompanyFacets>('/crm/companies/facets')).data,
  });
}

export function useCompany(id: string | undefined) {
  return useQuery<CompanyDetail>({
    queryKey: [...COMPANIES_KEY, 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<CompanyDetail>(`/crm/companies/${id}`)).data,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation<Company, Error, CreateCompanyInput>({
    mutationFn: async (input) => (await api.post<Company>('/crm/companies', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANIES_KEY }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation<Company, Error, { id: string; data: UpdateCompanyInput }>({
    mutationFn: async ({ id, data }) => (await api.patch<Company>(`/crm/companies/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CRM_KEY }),
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: async (id) => (await api.delete(`/crm/companies/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CRM_KEY }),
  });
}

// ───────────────────────────── Personas ─────────────────────────────

export interface PeopleQuery {
  q?: string;
  company_id?: string;
  source?: string[];
  location?: string[];
  cargo?: string[];
  industry?: string[];
  contacted?: 'yes' | 'no';
  page?: number;
  limit?: number;
}

export function usePeople(filters: PeopleQuery = {}, enabled = true) {
  return useQuery<PersonListResponse>({
    queryKey: [...PEOPLE_KEY, filters],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async () =>
      (
        await api.get<PersonListResponse>('/crm/people', {
          params: {
            q: filters.q || undefined,
            company_id: filters.company_id,
            source: csv(filters.source),
            location: csv(filters.location),
            cargo: csv(filters.cargo),
            industry: csv(filters.industry),
            contacted: filters.contacted,
            page: filters.page,
            limit: filters.limit,
          },
        })
      ).data,
  });
}

export function usePeopleFacets(filters: Pick<PeopleQuery, 'source' | 'location' | 'cargo' | 'industry' | 'contacted'> = {}) {
  return useQuery<PeopleFacets>({
    // Conteos contextuales: dependen de los filtros activos.
    queryKey: [...PEOPLE_KEY, 'facets', filters],
    staleTime: 60_000,
    queryFn: async () =>
      (
        await api.get<PeopleFacets>('/crm/people/facets', {
          params: {
            source: csv(filters.source),
            location: csv(filters.location),
            cargo: csv(filters.cargo),
            industry: csv(filters.industry),
            contacted: filters.contacted,
          },
        })
      ).data,
  });
}

export function usePerson(id: string | undefined) {
  return useQuery<PersonDetail>({
    queryKey: [...PEOPLE_KEY, 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<PersonDetail>(`/crm/people/${id}`)).data,
  });
}

export function useCreatePerson() {
  const qc = useQueryClient();
  return useMutation<Person, Error, CreatePersonInput>({
    mutationFn: async (input) => (await api.post<Person>('/crm/people', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }),
  });
}

export function useUpdatePerson() {
  const qc = useQueryClient();
  return useMutation<Person, Error, { id: string; data: UpdatePersonInput }>({
    mutationFn: async ({ id, data }) => (await api.patch<Person>(`/crm/people/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CRM_KEY }),
  });
}

export function useDeletePerson() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: async (id) => (await api.delete(`/crm/people/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: CRM_KEY }),
  });
}

export function useImportPeople() {
  const qc = useQueryClient();
  return useMutation<ImportPeopleResult, Error, { file: File; source?: string }>({
    mutationFn: async ({ file, source }) => {
      const form = new FormData();
      form.append('file', file);
      return (await api.post<ImportPeopleResult>('/crm/people/import', form, { params: source ? { source } : {} })).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CRM_KEY }),
  });
}

export function useFormatPersonNames() {
  const qc = useQueryClient();
  return useMutation<{ scanned: number; updated: number }, Error, void>({
    mutationFn: async () => (await api.post('/crm/people/format-names')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }),
  });
}

export function useMatchPeopleDomains() {
  const qc = useQueryClient();
  return useMutation<{ scanned: number; linked: number; ambiguous: number }, Error, void>({
    mutationFn: async () => (await api.post('/crm/people/match-domains')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }),
  });
}
