import { useMemo, useState } from 'react';
import { Loader2, Plus, Settings2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MemberFilter } from '@/components/team/MemberFilter';
import { PillSelect } from '@/components/common/PillSelect';
import { MultiPillSelect } from '@/components/common/MultiPillSelect';
import { useLeads, useStages } from '@/hooks/useCrm';
import { normalizeMemberId } from '@/lib/members';
import { useAuth } from '@/auth/AuthContext';
import { PipelineBoard } from '@/components/crm/PipelineBoard';
import { LeadDialog } from '@/components/crm/LeadDialog';
import { StagesManagerDialog } from '@/components/crm/StagesManagerDialog';
import { useCrmProfiles } from '@/components/crm/CrmProfiles';
import { distinct } from '@/components/crm/pipelineLogic';
import { PageHeader } from '@/components/layout/PageHeader';
import { usePersistentString, usePersistentStringArray } from '@/hooks/useLocalStorageState';

const ALL = '__all__';

export function PipelinePage() {
  const { openLead } = useCrmProfiles();
  const { hasRole } = useAuth();
  const canManageStages = hasRole('GERENTE');
  const { data: stagesData, isLoading: stagesLoading } = useStages();
  const stages = stagesData?.items ?? [];
  const { data, isLoading } = useLeads();
  const leads = useMemo(() => data?.items ?? [], [data]);

  const [defaultStageId, setDefaultStageId] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);
  // Filtros persistentes (localStorage) para no re-filtrar en cada visita.
  const [owner, setOwner] = usePersistentString('crm.pipeline.owner', ALL);
  const [industry, setIndustry] = usePersistentStringArray('crm.pipeline.industries', []);
  const [service, setService] = usePersistentString('crm.pipeline.service', ALL);

  // Opciones de filtro a partir de los leads cargados (valores distintos).
  const industries = useMemo(() => distinct(leads.map((l) => l.sector)), [leads]);
  const services = useMemo(() => distinct(leads.map((l) => l.target_service)), [leads]);

  const filtered = useMemo(
    () =>
      leads.filter(
        (l) =>
          (owner === ALL || normalizeMemberId(l.owner) === owner) &&
          (industry.length === 0 || industry.includes(l.sector ?? '')) &&
          (service === ALL || l.target_service === service),
      ),
    [leads, owner, industry, service],
  );

  const hasFilters = owner !== ALL || industry.length > 0 || service !== ALL;
  const industryOptions = industries.map((i) => ({ value: i, label: i }));
  const serviceOptions = [{ value: ALL, label: 'Todos los servicios' }, ...services.map((s) => ({ value: s, label: s }))];

  function clearFilters() {
    setOwner(ALL);
    setIndustry([]);
    setService(ALL);
  }

  function openNew(stageId?: string) {
    setDefaultStageId(stageId);
    setCreateOpen(true);
  }

  return (
    <>
      <PageHeader title="Pipeline" description="Arrastra los leads entre etapas para avanzar el negocio.">
        <Button size="sm" variant="outline" onClick={() => setStagesOpen(true)}>
          <Settings2 className="h-4 w-4" /> {canManageStages ? 'Gestionar etapas' : 'Ver etapas'}
        </Button>
        <Button size="sm" onClick={() => openNew()} disabled={stages.length === 0}>
          <Plus className="h-4 w-4" /> Nuevo lead
        </Button>
      </PageHeader>

      <div className="px-4 py-6 md:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <MemberFilter
            value={owner === ALL ? null : owner}
            onChange={(v) => setOwner(v ?? ALL)}
            presentIds={leads.map((l) => l.owner ?? '').filter(Boolean)}
          />
          <MultiPillSelect
            values={industry}
            onChange={setIndustry}
            options={industryOptions}
            allLabel="Todas las industrias"
            searchPlaceholder="Buscar industria…"
          />
          <PillSelect value={service} onChange={setService} options={serviceOptions} searchPlaceholder="Buscar servicio…" />
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Limpiar
            </Button>
          ) : null}

          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} de {leads.length} leads
          </span>
        </div>

        {isLoading || stagesLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : stages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {canManageStages
              ? 'Todavía no hay etapas. Crea la primera desde "Gestionar etapas".'
              : 'Todavía no hay etapas. Pide a un gerente que configure el pipeline.'}
          </div>
        ) : (
          <PipelineBoard leads={filtered} stages={stages} onEditLead={(lead) => openLead(lead.id)} onAddLead={openNew} />
        )}

        <LeadDialog open={createOpen} onOpenChange={setCreateOpen} stages={stages} lead={null} defaultStageId={defaultStageId} />
        <StagesManagerDialog open={stagesOpen} onOpenChange={setStagesOpen} />
      </div>
    </>
  );
}
