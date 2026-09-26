import { memo, useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Checkbox } from '@/components/ui/checkbox';
import type { TableConfig } from '@/hooks/useTableConfig';

export interface DataColumn<T> {
  id: string;
  label: string;
  icon: LucideIcon;
  width?: number;
  align?: 'left' | 'right';
  /** Control inline en el encabezado (p. ej. el filtro de columna). */
  headerControl?: ReactNode;
  /** Contenido de la celda; null/undefined = celda vacía. */
  cell: (row: T) => ReactNode;
  /** Si la celda "tiene dato" (para el tinte). Necesario cuando `cell` siempre
      renderiza algo (celdas editables) y el contenido ya no lo dice. */
  filled?: (row: T) => boolean;
}

interface Props<T> {
  config: TableConfig;
  rows: T[];
  columns: DataColumn<T>[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  /** Acción al final del encabezado (p. ej. "+ Agregar columna"). */
  addColumn?: ReactNode;
  /** Acciones por fila (editar…), en la cola derecha de la fila. */
  rowActions?: (row: T) => ReactNode;
  /** Qué hacer cuando no hay filas: una frase que diga el siguiente paso. */
  emptyMessage?: string;
}

const SELECT_W = 44;
const DEFAULT_W = 180;

// La selección es un tinte MÁS fuerte que el de celda con dato para que no se
// confundan. Las celdas fijas (sticky) van opacas para tapar lo que scrollea debajo.
const SELECTED_ROW = 'bg-primary/10';
const SELECTED_STICKY = 'bg-accent';
const CELL_TINT = 'bg-primary/5';
const PIN_SHADOW = 'shadow-md';

export function DataTable<T>({
  config,
  rows,
  columns,
  getRowId,
  onRowClick,
  selected,
  onToggleRow,
  onToggleAll,
  addColumn,
  rowActions,
  emptyMessage = 'Sin resultados. Ajusta los filtros o la búsqueda.',
}: Props<T>) {
  const colById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const { order, widths, hidden, setOrder, setWidth, persist } = config;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const visibleIds = useMemo(
    () => order.filter((id) => colById.has(id) && !hidden.has(id)),
    [order, colById, hidden],
  );
  const [pinnedId, ...scrollIds] = visibleIds;
  // Referencias estables para que las filas memoizadas no se re-rendericen en vano.
  const pinnedCol = pinnedId ? colById.get(pinnedId)! : null;
  const scrollCols = useMemo(() => visibleIds.slice(1).map((cid) => colById.get(cid)!), [visibleIds, colById]);
  const widthOf = (id: string) => widths[id] ?? colById.get(id)?.width ?? DEFAULT_W;
  const isMobile = useIsMobile();
  // La sombra de la columna fija solo aparece tras scrollear en horizontal.
  // Se declara antes del return de móvil para que el orden de hooks sea estable.
  const [scrolledX, setScrolledX] = useState(false);

  // Móvil: una tabla ancha no cabe. Cada fila es una tarjeta (nombre destacado +
  // primeros campos con dato); las celdas editables siguen funcionando al tocarlas.
  if (isMobile) {
    return (
      <div className="space-y-2 pb-4">
        {rows.map((row) => {
          const id = getRowId(row);
          const isSel = selected.has(id);
          const extras = scrollIds
            .map((cid) => ({ col: colById.get(cid)!, content: colById.get(cid)!.cell(row) }))
            .filter((x) => x.content != null && x.content !== '' && x.content !== false)
            .slice(0, 4);
          return (
            <div
              key={id}
              className={cn(
                'flex items-start gap-2.5 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors',
                isSel ? SELECTED_ROW : 'active:bg-muted/40',
              )}
            >
              <Checkbox
                checked={isSel}
                onCheckedChange={() => onToggleRow(id)}
                className="mt-0.5 shrink-0"
                aria-label="Seleccionar fila"
              />
              <div className={cn('min-w-0 flex-1', onRowClick && 'cursor-pointer')} onClick={() => onRowClick?.(row)}>
                {pinnedId ? <div className="mb-1.5 min-w-0 font-medium">{colById.get(pinnedId)!.cell(row)}</div> : null}
                {extras.length ? (
                  <div className="space-y-1">
                    {extras.map(({ col, content }) => {
                      const Icon = col.icon;
                      return (
                        <div key={col.id} className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">{content}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              {rowActions ? <div className="shrink-0">{rowActions(row)}</div> : null}
            </div>
          );
        })}
        {rows.length === 0 ? <EmptyState message={emptyMessage} /> : null}
      </div>
    );
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setOrder(next);
  }

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(getRowId(r)));

  return (
    <div
      className="h-full overflow-auto rounded-xl border border-border bg-card text-sm scrollbar-thin"
      onScroll={(e) => setScrolledX(e.currentTarget.scrollLeft > 0)}
    >
      {/* w-max: el wrapper mide el CONTENIDO, no el viewport del scroll; sin esto las
          filas terminaban antes que las columnas al scrollear en horizontal. */}
      <div className="w-max min-w-full">
        <div className="sticky top-0 z-40 flex border-b border-border bg-card text-[13px] font-semibold text-muted-foreground">
          <HeaderCell sticky left={0} width={SELECT_W} className="justify-center">
            <Checkbox
              checked={allChecked}
              onCheckedChange={onToggleAll}
              disabled={rows.length === 0}
              aria-label={allChecked ? 'Quitar selección de la página' : 'Seleccionar toda la página'}
            />
          </HeaderCell>

          {pinnedId ? (
            <HeaderCell
              sticky
              left={SELECT_W}
              width={widthOf(pinnedId)}
              border
              pinShadow={scrolledX}
              onResize={(w) => setWidth(pinnedId, w)}
              onResizeEnd={() => persist()}
            >
              <ColHeaderLabel col={colById.get(pinnedId)!} />
            </HeaderCell>
          ) : null}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={scrollIds} strategy={horizontalListSortingStrategy}>
              {scrollIds.map((id) => (
                <SortableHeader
                  key={id}
                  col={colById.get(id)!}
                  width={widthOf(id)}
                  onResize={(w) => setWidth(id, w)}
                  onResizeEnd={() => persist()}
                />
              ))}
            </SortableContext>
          </DndContext>

          <div className="flex h-10 min-w-[160px] flex-1 items-center border-l border-border px-2">{addColumn}</div>
        </div>

        {rows.map((row) => {
          const id = getRowId(row);
          return (
            <DataRow
              key={id}
              id={id}
              row={row}
              isSel={selected.has(id)}
              pinned={pinnedCol}
              scrollCols={scrollCols}
              widths={widths}
              scrolledX={scrolledX}
              onToggleRow={onToggleRow}
              onRowClick={onRowClick}
              rowActions={rowActions}
            />
          );
        })}

        {rows.length === 0 ? <EmptyState message={emptyMessage} /> : null}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="px-4 py-10 text-center text-sm text-muted-foreground">{message}</div>;
}

interface DataRowProps<T> {
  id: string;
  row: T;
  isSel: boolean;
  pinned: DataColumn<T> | null;
  scrollCols: DataColumn<T>[];
  widths: Record<string, number>;
  scrolledX: boolean;
  onToggleRow: (id: string) => void;
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
}

// Fila memoizada: con cientos de filas y celdas editables, re-renderizar todo
// por cambiar la selección de una se nota. Las páginas memoizan `columns` y
// pasan callbacks estables para que el memo surta efecto.
function DataRowInner<T>({ id, row, isSel, pinned, scrollCols, widths, scrolledX, onToggleRow, onRowClick, rowActions }: DataRowProps<T>) {
  const widthOf = (col: DataColumn<T>) => widths[col.id] ?? col.width ?? DEFAULT_W;
  return (
    <div
      onClick={onRowClick ? () => onRowClick(row) : undefined}
      className={cn('group flex border-b border-border', isSel ? SELECTED_ROW : 'hover:bg-muted/30', onRowClick && 'cursor-pointer')}
    >
      <BodyCell sticky left={0} width={SELECT_W} selected={isSel} className="justify-center">
        <Checkbox
          checked={isSel}
          onCheckedChange={() => onToggleRow(id)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Seleccionar fila"
        />
      </BodyCell>
      {pinned ? (
        <BodyCell sticky left={SELECT_W} width={widthOf(pinned)} selected={isSel} border pinShadow={scrolledX} className="font-medium">
          {pinned.cell(row)}
        </BodyCell>
      ) : null}
      {scrollCols.map((col) => {
        const content = col.cell(row);
        return (
          <BodyCell
            key={col.id}
            width={widthOf(col)}
            align={col.align}
            border
            selected={isSel}
            filled={col.filled ? col.filled(row) : content != null}
          >
            {content}
          </BodyCell>
        );
      })}
      <div className="flex min-w-[160px] flex-1 items-center justify-end border-l border-border px-2">{rowActions?.(row)}</div>
    </div>
  );
}
const DataRow = memo(DataRowInner) as typeof DataRowInner;

function ColHeaderLabel<T>({ col }: { col: DataColumn<T> }) {
  const Icon = col.icon;
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{col.label}</span>
      {col.headerControl}
    </div>
  );
}

function HeaderCell({
  children,
  width,
  sticky,
  left,
  border,
  pinShadow,
  className,
  onResize,
  onResizeEnd,
}: {
  children: ReactNode;
  width: number;
  sticky?: boolean;
  left?: number;
  border?: boolean;
  pinShadow?: boolean;
  className?: string;
  onResize?: (w: number) => void;
  onResizeEnd?: () => void;
}) {
  return (
    <div
      className={cn(
        'relative flex h-10 shrink-0 items-center gap-1 px-3',
        border && 'border-l border-border',
        sticky && 'sticky z-30 bg-card',
        pinShadow && PIN_SHADOW,
        className,
      )}
      style={{ width, ...(sticky ? { left } : {}) }}
    >
      {children}
      {onResize ? <ResizeHandle width={width} onResize={onResize} onResizeEnd={onResizeEnd} /> : null}
    </div>
  );
}

function SortableHeader<T>({
  col,
  width,
  onResize,
  onResizeEnd,
}: {
  col: DataColumn<T>;
  width: number;
  onResize: (w: number) => void;
  onResizeEnd: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
  return (
    // TODO el encabezado es el asa de arrastre (el borde de resize y el filtro paran la propagación).
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ width, transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'group/col relative flex h-10 shrink-0 cursor-grab items-center gap-1 border-l border-border px-3',
        isDragging && 'z-40 bg-card opacity-90',
      )}
    >
      <GripVertical className="h-3 w-3 shrink-0 text-transparent group-hover/col:text-muted-foreground/60" />
      <ColHeaderLabel col={col} />
      <ResizeHandle width={width} onResize={onResize} onResizeEnd={onResizeEnd} />
    </div>
  );
}

function BodyCell({
  children,
  width,
  sticky,
  left,
  align,
  border,
  pinShadow,
  selected,
  filled,
  className,
}: {
  children: ReactNode;
  width: number;
  sticky?: boolean;
  left?: number;
  align?: 'left' | 'right';
  border?: boolean;
  pinShadow?: boolean;
  selected?: boolean;
  filled?: boolean;
  className?: string;
}) {
  const empty = children == null || children === false || children === '';
  return (
    <div
      className={cn(
        'flex h-[35px] shrink-0 items-center overflow-hidden px-3 text-[14px]',
        border && 'border-l border-border',
        align === 'right' && 'justify-end',
        // Las celdas fijas van sticky + opacas para tapar el contenido scrolleado.
        sticky && 'sticky z-20',
        sticky ? (selected ? SELECTED_STICKY : 'bg-card') : null,
        !sticky && filled && !empty && !selected && CELL_TINT,
        pinShadow && PIN_SHADOW,
        className,
      )}
      style={{ width, ...(sticky ? { left } : {}) }}
    >
      {/* Celda vacía = en blanco (sin "—"): el vacío se lee solo y no mete ruido. */}
      <div className="min-w-0 flex-1 truncate">{empty ? null : children}</div>
    </div>
  );
}

function ResizeHandle({
  width,
  onResize,
  onResizeEnd,
}: {
  width: number;
  onResize: (w: number) => void;
  onResizeEnd?: () => void;
}) {
  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width;
    function move(ev: PointerEvent) {
      onResize(startW + (ev.clientX - startX));
    }
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onResizeEnd?.();
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar columna"
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-primary/40"
    />
  );
}
