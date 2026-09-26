import { useMemo } from 'react';
import type { Lead, PipelineStage } from '@crm/shared';
import { HEALTH_META, formatMoney, stageColor } from '@/lib/crm';
import { cn } from '@/lib/utils';

interface Props {
  leads: Lead[];
  stages: PipelineStage[];
  onOpen: (leadId: string) => void;
  emptyHint: string;
}

/** Negocios asociados a una persona o empresa; clic abre el perfil del lead. */
export function AssociatedDeals({ leads, stages, onOpen, emptyHint }: Props) {
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  if (leads.length === 0) return <p className="py-1 text-xs text-muted-foreground">{emptyHint}</p>;
  return (
    <ul className="space-y-1.5">
      {leads.map((l) => {
        const stage = stageById.get(l.stage_id);
        const c = stageColor(stage?.color);
        const health = l.health ? HEALTH_META[l.health] : null;
        return (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => onOpen(l.id)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-border p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {health ? <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', health.dot)} title={health.label} aria-hidden /> : null}
                  <span className="truncate text-sm font-medium">{l.company}</span>
                </div>
                {l.target_service ? <div className="text-[11px] text-muted-foreground">{l.target_service}</div> : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {l.estimated_value != null ? <span className="text-[11px] tabular-nums text-muted-foreground">{formatMoney(l.estimated_value)}</span> : null}
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', c.badge)}>{stage?.name ?? '—'}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
