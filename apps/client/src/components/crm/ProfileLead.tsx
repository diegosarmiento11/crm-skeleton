import { useState } from 'react';
import { toast } from 'sonner';
import { Building2, CalendarClock, Loader2, User } from 'lucide-react';
import type { Lead, LeadStageHistory } from '@crm/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfirm } from '@/components/ConfirmDialog';
import { useDeleteLead, useLead, useLeadStageHistory, useStages } from '@/hooks/useCrm';
import { apiErrorMessage } from '@/lib/api';
import { HEALTH_META, daysSince, formatMoney, fullDate, relativeTime, stageColor } from '@/lib/crm';
import { formatDueLabel, isOverdue } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { LeadDialog } from './LeadDialog';
import { ActivityFeed } from './ActivityFeed';
import {
  Dash,
  EntityIcon,
  Field,
  FieldList,
  HealthBadge,
  OwnerChip,
  ProfileError,
  ProfileFrame,
  ProfileLink,
  ProfileLoading,
  StageBadge,
  TagBadge,
  type ProfileNav,
} from './ProfileShared';

type LeadTab = 'summary' | 'activity' | 'journey';

export function ProfileLead({ id, nav }: { id: string; nav: ProfileNav }) {
  const { data: lead, isLoading, error } = useLead(id);
  const { data: stagesData } = useStages();
  const [tab, setTab] = useState<LeadTab>('summary');
  // El recorrido solo se pide cuando su tab está activa: es una consulta aparte
  // que la mayoría de aperturas del panel no necesita.
  const { data: journey, isLoading: journeyLoading } = useLeadStageHistory(id, tab === 'journey');
  const del = useDeleteLead();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);

  const stages = stagesData?.items ?? [];
  const stage = lead ? stages.find((s) => s.id === lead.stage_id) : undefined;

  async function onDelete() {
    if (!lead) return;
    const ok = await confirm({
      title: `Borrar el negocio "${lead.company}"`,
      description: 'Se borrarán también sus notas y tareas. Esta acción no se puede deshacer.',
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(lead.id);
      toast.success('Negocio borrado');
      nav.close();
    } catch (err) {
      toast.error(`No se pudo borrar: ${apiErrorMessage(err)}`);
    }
  }

  return (
    <ProfileFrame
      title={lead?.company ?? 'Negocio'}
      subtitle={lead ? `Negocio · creado el ${fullDate(lead.created_at)}` : 'Cargando el negocio'}
      icon={<EntityIcon icon={Building2} />}
      badges={
        lead ? (
          <>
            <StageBadge stage={stage} />
            <HealthBadge band={lead.health} reason={lead.health_reason} />
            {lead.estimated_value != null ? <span className="text-xs tabular-nums text-muted-foreground">{formatMoney(lead.estimated_value)}</span> : null}
          </>
        ) : null
      }
      nav={nav}
      onEdit={lead ? () => setEditing(true) : undefined}
      onDelete={lead ? onDelete : undefined}
      deleting={del.isPending}
      loading={isLoading}
    >
      {error ? <ProfileError message={apiErrorMessage(error)} /> : null}
      {isLoading || !lead ? (
        !error ? <ProfileLoading /> : null
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as LeadTab)}>
          <TabsList aria-label="Secciones del negocio">
            <TabsTrigger value="summary">Resumen</TabsTrigger>
            <TabsTrigger value="activity">Actividad</TabsTrigger>
            <TabsTrigger value="journey">Recorrido</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="mt-4">
            <LeadSummary lead={lead} stageName={stage?.name} onOpenCompany={nav.openCompany} onOpenPerson={nav.openPerson} />
          </TabsContent>
          <TabsContent value="activity" className="mt-4">
            <ActivityFeed entityType="lead" entityId={lead.id} />
          </TabsContent>
          <TabsContent value="journey" className="mt-4">
            <LeadJourney journey={journey} loading={journeyLoading} currentStageId={lead.stage_id} />
          </TabsContent>
        </Tabs>
      )}
      {lead ? <LeadDialog open={editing} onOpenChange={setEditing} stages={stages} lead={lead} /> : null}
    </ProfileFrame>
  );
}

function LeadSummary({
  lead,
  stageName,
  onOpenCompany,
  onOpenPerson,
}: {
  lead: Lead;
  stageName: string | undefined;
  onOpenCompany: (id: string) => void;
  onOpenPerson: (id: string) => void;
}) {
  const inStage = daysSince(lead.stage_changed_at);
  const health = lead.health ? HEALTH_META[lead.health] : null;
  const nextOverdue = lead.next_task?.due_date ? isOverdue(lead.next_task.due_date) : false;
  return (
    <FieldList>
      <Field label="Valor estimado">{lead.estimated_value != null ? <span className="tabular-nums">{formatMoney(lead.estimated_value)}</span> : <Dash />}</Field>
      <Field label="Responsable">
        <OwnerChip owner={lead.owner} />
      </Field>
      <Field label="Etapa">
        {stageName ?? 'Sin etapa'}
        {inStage != null ? <span className="text-xs text-muted-foreground"> · {inStage === 0 ? 'desde hoy' : `hace ${inStage} d`}</span> : null}
      </Field>
      <Field label="Salud">
        {health ? (
          <span className="inline-flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', health.dot)} aria-hidden />
            {health.label}
            {lead.health_reason ? <span className="text-xs text-muted-foreground">· {lead.health_reason}</span> : null}
          </span>
        ) : (
          <span className="text-muted-foreground">Negocio cerrado</span>
        )}
      </Field>
      <Field label="Última actividad">{lead.last_activity_at ? relativeTime(lead.last_activity_at) : <span className="text-muted-foreground">Sin actividad registrada</span>}</Field>
      <Field label="Próxima tarea">
        {lead.next_task ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {lead.next_task.title}
            {lead.next_task.due_date ? (
              <span className={cn('inline-flex items-center gap-1 text-xs', nextOverdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                <CalendarClock className="h-3 w-3" /> {formatDueLabel(lead.next_task.due_date)}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">Ninguna. Crea una en Actividad.</span>
        )}
      </Field>
      <Field label="Servicio">
        <TagBadge value={lead.target_service} />
      </Field>
      <Field label="Sector">
        <TagBadge value={lead.sector} />
      </Field>
      <Field label="Origen">
        <TagBadge value={lead.source} />
      </Field>
      {lead.lost_reason ? <Field label="Razón de pérdida">{lead.lost_reason}</Field> : null}
      <Field label="Empresa">
        {lead.company_id ? (
          <ProfileLink onClick={() => onOpenCompany(lead.company_id as string)}>
            <Building2 className="h-3 w-3" /> Ver empresa
          </ProfileLink>
        ) : (
          <span className="text-muted-foreground">Sin empresa asociada. Edita el negocio para enlazarla.</span>
        )}
      </Field>
      <Field label="Personas">
        {lead.persons.length ? (
          <div className="flex flex-col items-start gap-1">
            {lead.persons.map((p) => (
              <ProfileLink key={p.id} onClick={() => onOpenPerson(p.id)}>
                <User className="h-3 w-3" /> {p.name}
              </ProfileLink>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">Sin contactos. Edita el negocio para asociar personas.</span>
        )}
      </Field>
      <Field label="Notas">{lead.notes_count ?? 0}</Field>
    </FieldList>
  );
}

/** Línea de tiempo por etapa: cuánto lleva/llevó el lead en cada una. */
function LeadJourney({ journey, loading, currentStageId }: { journey: LeadStageHistory | undefined; loading: boolean; currentStageId: string }) {
  if (loading || !journey) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando recorrido…
      </div>
    );
  }
  if (journey.segments.length === 0) {
    return <p className="text-xs text-muted-foreground">Aún no hay movimientos. El recorrido se llena cada vez que el negocio cambia de etapa en el pipeline.</p>;
  }
  const max = Math.max(1, ...journey.totals.map((t) => t.days));
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Días por etapa</h3>
        <ul className="space-y-2">
          {journey.totals.map((t) => {
            const c = stageColor(t.color);
            return (
              <li key={t.stage_id}>
                <div className="flex items-center gap-2 text-sm">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', c.dot)} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  {t.stage_id === currentStageId ? <span className="text-[11px] text-muted-foreground">en curso</span> : null}
                  <span className="tabular-nums text-muted-foreground">{formatDays(t.days)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn('h-full rounded-full', c.dot)} style={{ width: `${Math.max(3, (t.days / max) * 100)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cronología</h3>
        <ol className="relative ml-1.5 space-y-3 border-l border-border pl-4">
          {journey.segments.map((s, i) => {
            const c = stageColor(s.color);
            return (
              <li key={`${s.stage_id}-${i}`} className="relative text-sm">
                <span className={cn('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-background', c.dot)} aria-hidden />
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{s.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDays(s.days)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {fullDate(s.entered_at)} → {s.left_at ? fullDate(s.left_at) : 'hoy'}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function formatDays(days: number): string {
  if (days < 1) return '<1 d';
  return `${Math.round(days)} d`;
}
