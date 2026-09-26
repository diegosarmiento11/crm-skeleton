import { Building2, CheckSquare, Clock, DollarSign, MessageSquare } from 'lucide-react';
import type { Lead } from '@crm/shared';
import { cn } from '@/lib/utils';
import { HEALTH_META, daysSince, formatMoney, ownerName, shortDate, tagColor } from '@/lib/crm';
import { MemberAvatar } from '@/components/team/MemberAvatar';

interface Props {
  lead: Lead;
  onClick?: () => void;
  /** Silueta punteada que queda en el origen mientras la tarjeta se arrastra. */
  placeholder?: boolean;
  /** Tarjeta "levantada" dentro del DragOverlay (sigue al cursor). */
  overlay?: boolean;
}

/** Tarjeta de negocio: empresa + salud, próxima tarea, responsable, valor y etiquetas. */
export function PipelineCard({ lead, onClick, placeholder, overlay }: Props) {
  const owner = ownerName(lead.owner);
  // La salud viene calculada del servidor (health / health_reason); aquí solo se pinta.
  const health = lead.health ? HEALTH_META[lead.health] : undefined;
  const days = daysSince(lead.stage_changed_at);
  const healthTitle = health ? `${health.label}${lead.health_reason ? ` · ${lead.health_reason}` : ''}` : undefined;

  return (
    <button
      type="button"
      onClick={placeholder ? undefined : onClick}
      aria-label={`Abrir lead ${lead.company}`}
      className={cn(
        'w-full rounded-xl border bg-card p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        placeholder
          ? // Conserva el tamaño de la tarjeta (los hijos quedan invisibles) y muestra un fantasma punteado.
            'border-2 border-dashed border-muted-foreground/30 bg-muted/40 shadow-none [&_*]:invisible'
          : overlay
            ? 'rotate-1 cursor-grabbing border-primary/40 shadow-lg'
            : 'border-border shadow-sm hover:border-primary/40 hover:shadow',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Building2 className="h-3 w-3" />
        </span>
        <span className="line-clamp-2 text-sm font-semibold leading-tight">{lead.company}</span>
        {health ? (
          <span
            className={cn('ml-auto h-2.5 w-2.5 shrink-0 rounded-full', health.dot)}
            title={healthTitle}
            aria-label={healthTitle}
            role="img"
          />
        ) : null}
      </div>

      {lead.next_task ? (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
          <CheckSquare className="h-3 w-3 shrink-0" />
          <span className="truncate">{lead.next_task.title}</span>
          {lead.next_task.due_date ? (
            <span className="ml-auto shrink-0 tabular-nums">{shortDate(lead.next_task.due_date)}</span>
          ) : null}
        </div>
      ) : null}

      {lead.owner ? (
        <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
          <MemberAvatar name={owner} seed={lead.owner} size="sm" />
          <span className="truncate">{owner}</span>
        </div>
      ) : null}

      {lead.estimated_value != null ? (
        <div className="mt-2.5 flex items-center gap-1.5 text-base font-semibold tabular-nums">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          {formatMoney(lead.estimated_value)}
        </div>
      ) : null}

      {lead.target_service || lead.sector ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {lead.target_service ? (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', tagColor(lead.target_service))}>
              {lead.target_service}
            </span>
          ) : null}
          {lead.sector ? (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', tagColor(lead.sector))}>
              {lead.sector}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center gap-3 text-xs text-muted-foreground">
        {days != null ? (
          <span className="inline-flex items-center gap-1" title="Tiempo en esta etapa">
            <Clock className="h-3 w-3" />
            {days}d
          </span>
        ) : null}
        {lead.notes_count ? (
          <span className="inline-flex items-center gap-1" title="Notas">
            <MessageSquare className="h-3 w-3" />
            {lead.notes_count}
          </span>
        ) : null}
      </div>
    </button>
  );
}
