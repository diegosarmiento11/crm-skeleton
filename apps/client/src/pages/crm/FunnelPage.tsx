import { useCallback, useMemo } from 'react';
import { CalendarRange, Loader2, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/layout/PageHeader';
import { PillSelect } from '@/components/common/PillSelect';
import { DatePicker } from '@/components/common/DatePicker';
import { useCrmProfiles } from '@/components/crm/CrmProfiles';
import { FunnelChart } from '@/components/crm/FunnelChart';
import { CardTitleRow, FunnelBottleneck, FunnelGoal, FunnelTotals } from '@/components/crm/FunnelCards';
import { FunnelLoss, FunnelPerformance, FunnelSla, FunnelStageTable } from '@/components/crm/FunnelTables';
import { FunnelIcp, FunnelSignals, type OpenProfile } from '@/components/crm/FunnelSignals';
import { useCrmInsights, usePipelineAnalytics, usePipelinePerformance, type CrmEntity } from '@/hooks/useCrm';
import { usePersistentString } from '@/hooks/useLocalStorageState';
import { apiErrorMessage } from '@/lib/api';
import { FUNNEL_PRESETS, customRange, isFunnelPreset, rangeForPreset, type FunnelPreset } from './funnelLogic';

const PRESET_KEY = 'crm.funnel.preset';
const FROM_KEY = 'crm.funnel.from';
const TO_KEY = 'crm.funnel.to';

/**
 * Analítica del embudo (solo GERENTE, ver App.tsx / nav.ts). El rango de fechas
 * acota la cohorte de leads creados en el periodo; el SLA y las señales son
 * siempre "hoy", sin importar el rango.
 */
export function FunnelPage() {
  const [storedPreset, setStoredPreset] = usePersistentString(PRESET_KEY, '90d');
  const preset: FunnelPreset = isFunnelPreset(storedPreset) ? storedPreset : '90d';
  const [from, setFrom] = usePersistentString(FROM_KEY, '');
  const [to, setTo] = usePersistentString(TO_KEY, '');

  const range = useMemo(() => (preset === 'custom' ? customRange(from || null, to || null) : rangeForPreset(preset)), [preset, from, to]);
  const rangeLabel = FUNNEL_PRESETS.find((p) => p.value === preset)?.label ?? 'Periodo';

  const { data, isLoading, error } = usePipelineAnalytics(range);
  const { data: perf } = usePipelinePerformance(range);
  const { data: insights } = useCrmInsights();
  const profiles = useCrmProfiles();

  const openProfile = useCallback<OpenProfile>(
    (type: CrmEntity, id: string) => {
      if (type === 'lead') profiles.openLead(id);
      else if (type === 'person') profiles.openPerson(id);
      else profiles.openCompany(id);
    },
    [profiles],
  );

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <PillSelect
        value={preset}
        onChange={setStoredPreset}
        options={[...FUNNEL_PRESETS]}
        icon={CalendarRange}
        searchable={false}
        align="end"
      />
      {preset === 'custom' ? (
        <>
          <DatePicker value={from} onChange={(v) => setFrom(v ?? '')} clearable presets={false} modal={false} placeholder="Desde" className="h-9 w-auto rounded-full text-xs" />
          <DatePicker value={to} onChange={(v) => setTo(v ?? '')} clearable presets={false} modal={false} placeholder="Hasta" className="h-9 w-auto rounded-full text-xs" />
        </>
      ) : null}
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <PageHeader title="Embudo" description="Conversión por etapa, pérdidas, seguimiento y desempeño del equipo.">
        {filters}
      </PageHeader>
      <div className="space-y-6 px-4 py-6 md:px-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando el embudo…
          </div>
        ) : error || !data ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            No se pudo cargar la analítica{error ? `: ${apiErrorMessage(error)}` : ''}. Recarga la página o cambia el rango.
          </p>
        ) : (
          <>
            <FunnelTotals totals={data.totals} />

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <FunnelGoal wonValue={data.totals.won_value} rangeLabel={rangeLabel} />
              </div>
              <div className="lg:col-span-2">{data.bottleneck ? <FunnelBottleneck bottleneck={data.bottleneck} /> : null}</div>
            </div>

            <div className="grid gap-4 xl:grid-cols-5">
              <Card className="min-w-0 xl:col-span-2">
                <CardContent className="p-4">
                  <CardTitleRow icon={TrendingUp}>Embudo por etapa</CardTitleRow>
                  <FunnelChart stages={data.stages} />
                </CardContent>
              </Card>
              <div className="min-w-0 xl:col-span-3">
                <FunnelStageTable stages={data.stages} />
              </div>
            </div>

            <FunnelLoss loss={data.loss} />

            <FunnelSla sla={data.sla} onOpenLead={profiles.openLead} />

            <FunnelPerformance perf={perf} />

            {insights ? (
              <>
                <FunnelSignals signals={insights.signals} onOpen={openProfile} />
                <FunnelIcp industry={insights.icp_industry} city={insights.icp_city} />
              </>
            ) : null}

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              El embudo sigue la cohorte de leads creados en el periodo; la conversión es alcanzados de la etapa ÷ alcanzados de la anterior. El valor ponderado multiplica el
              abierto por la probabilidad de cada etapa. El desempeño atribuye prospección y cierres al responsable del lead. El SLA y las señales miran el estado de hoy.
            </p>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
