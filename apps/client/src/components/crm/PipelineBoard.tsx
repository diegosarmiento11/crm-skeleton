import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import type { Lead, PipelineStage } from '@crm/shared';
import { cn } from '@/lib/utils';
import { formatMoneyShort, isLostStage, stageColor } from '@/lib/crm';
import { apiErrorMessage } from '@/lib/api';
import { useMoveLead } from '@/hooks/useCrm';
import { useIsMobile } from '@/hooks/useIsMobile';
import { PipelineCard } from './PipelineCard';
import { LostReasonDialog } from './LostReasonDialog';
import { applyDrop, groupByStage, sumEstimated, type Board } from './pipelineLogic';

interface Props {
  leads: Lead[];
  stages: PipelineStage[];
  onEditLead: (lead: Lead) => void;
  onAddLead: (stageId: string) => void;
}

export function PipelineBoard({ leads, stages, onEditLead, onAddLead }: Props) {
  // Tablero optimista: se actualiza al soltar y se re-sincroniza cuando llega la lista del servidor.
  const [board, setBoard] = useState<Board>(() => groupByStage(leads, stages));
  const [activeId, setActiveId] = useState<string | null>(null);
  // Lead recién soltado en la etapa LOST → pedir la razón de pérdida.
  const [lostPrompt, setLostPrompt] = useState<{ id: string; company: string } | null>(null);
  const move = useMoveLead();

  useEffect(() => setBoard(groupByStage(leads, stages)), [leads, stages]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const orderedStages = useMemo(() => [...stages].sort((a, b) => a.position - b.position), [stages]);
  const activeLead = activeId ? (leads.find((l) => l.id === activeId) ?? null) : null;

  // Móvil: una etapa a la vez (scroll vertical). Las pills eligen la etapa;
  // dentro de la columna sí se puede reordenar.
  const isMobile = useIsMobile();
  const [activeStage, setActiveStage] = useState(0);
  const stageIndex = Math.min(activeStage, Math.max(orderedStages.length - 1, 0));
  const currentStage = orderedStages[stageIndex];

  const stageIdSet = useMemo(() => new Set(stages.map((s) => s.id)), [stages]);
  // Colisión por puntero para que soltar en una columna VACÍA funcione
  // (closestCorners no ve contenedores grandes vacíos). Se prefiere la tarjeta
  // (posición exacta) y se cae a la columna (vacía / final de lista).
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const pointer = pointerWithin(args);
      const base = pointer.length ? pointer : rectIntersection(args);
      const card = base.find((c) => !stageIdSet.has(String(c.id)));
      return card ? [card] : base;
    },
    [stageIdSet],
  );

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const result = applyDrop(board, String(active.id), String(over.id));
    if (!result) return;
    const { sourceStage, targetStage, position, moved } = result;
    if (sourceStage === targetStage && board[sourceStage][position]?.id === moved.id) return;

    setBoard(result.board);
    move.mutate(
      { id: moved.id, data: { stage_id: targetStage, position } },
      {
        onError: (err) => {
          // El tablero optimista se revierte al estado del servidor.
          setBoard(groupByStage(leads, stages));
          toast.error(`No se pudo mover el lead: ${apiErrorMessage(err)}`);
        },
      },
    );
    if (sourceStage !== targetStage && isLostStage(stages.find((s) => s.id === targetStage))) {
      setLostPrompt({ id: moved.id, company: moved.company });
    }
  }

  function renderColumn(stage: PipelineStage, mobile: boolean) {
    const items = board[stage.id] ?? [];
    return (
      <Column
        key={stage.id}
        mobile={mobile}
        stage={stage}
        count={items.length}
        sum={sumEstimated(items)}
        onAdd={() => onAddLead(stage.id)}
      >
        <SortableContext items={items.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {items.map((lead) => (
            <SortableCard key={lead.id} lead={lead} onClick={() => onEditLead(lead)} />
          ))}
        </SortableContext>
      </Column>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {isMobile ? (
        <div className="pb-4">
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Etapas">
            {orderedStages.map((stage, i) => {
              const items = board[stage.id] ?? [];
              const c = stageColor(stage.color);
              const active = i === stageIndex;
              return (
                <button
                  key={stage.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveStage(i)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    c.header,
                    active ? cn('ring-2 ring-inset', c.ring) : 'opacity-60 hover:opacity-100',
                  )}
                >
                  <span className={cn('text-sm', active ? 'font-semibold' : 'font-medium')}>{stage.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
                </button>
              );
            })}
          </div>
          {currentStage ? renderColumn(currentStage, true) : null}
        </div>
      ) : (
        <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-4">{orderedStages.map((s) => renderColumn(s, false))}</div>
      )}
      <DragOverlay>{activeLead ? <PipelineCard lead={activeLead} overlay /> : null}</DragOverlay>
      <LostReasonDialog
        open={lostPrompt !== null}
        onOpenChange={(o) => {
          if (!o) setLostPrompt(null);
        }}
        lead={lostPrompt}
      />
    </DndContext>
  );
}

function Column({
  stage,
  count,
  sum,
  onAdd,
  children,
  mobile,
}: {
  stage: PipelineStage;
  count: number;
  sum: number;
  onAdd: () => void;
  children: ReactNode;
  mobile?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const c = stageColor(stage.color);
  return (
    <div className={cn('flex flex-col', mobile ? 'w-full' : 'w-64 shrink-0')}>
      <div className={cn('mb-2 flex items-center justify-between rounded-md px-2.5 py-1.5', c.header)}>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{stage.name}</span>
          <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
        </div>
        {sum > 0 ? (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground" title="Valor estimado en la etapa">
            {formatMoneyShort(sum)}
          </span>
        ) : null}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'min-h-20 flex-1 space-y-2 rounded-md p-1 transition-colors',
          isOver && 'bg-primary/10 ring-2 ring-inset ring-primary/40',
        )}
      >
        {children}
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Nuevo lead en ${stage.name}`}
          className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-3.5 w-3.5" /> Nuevo
        </button>
      </div>
    </div>
  );
}

function SortableCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { stageId: lead.stage_id },
  });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners}>
      {isDragging ? <PipelineCard lead={lead} placeholder /> : <PipelineCard lead={lead} onClick={onClick} />}
    </div>
  );
}
