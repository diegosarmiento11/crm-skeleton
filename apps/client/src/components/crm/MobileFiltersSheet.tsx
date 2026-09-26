import { useState } from 'react';
import { Check, SlidersHorizontal } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { tagColor } from '@/lib/crm';
import { cn } from '@/lib/utils';
import { optionLabel, type FilterDim } from './TableFilters';

// Tope de pills por sección en listas largas (industria/ubicación); el resto se
// alcanza con el buscador de la sección.
const MAX_PILLS = 60;

/**
 * Panel de filtros para MÓVIL. En desktop los filtros viven en los encabezados de
 * columna; en móvil (tarjetas) no hay encabezados, así que este panel reúne todas
 * las dimensiones con sus opciones (multi-select).
 */
export function MobileFiltersSheet({
  open,
  onOpenChange,
  dims,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dims: FilterDim[];
}) {
  const totalActive = dims.reduce((n, d) => n + d.active.length, 0);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[85vh] flex-col gap-0 rounded-t-2xl p-0">
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            Filtros
          </SheetTitle>
          <SheetDescription className="sr-only">Toca una opción para activarla o quitarla.</SheetDescription>
          {totalActive > 0 ? (
            <button
              type="button"
              onClick={() => dims.forEach((d) => d.active.length && d.onChange([]))}
              className="text-sm font-medium text-primary"
            >
              Limpiar todo
            </button>
          ) : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {dims.map((d) => (
            <FilterSection key={d.id} dim={d} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FilterSection({ dim }: { dim: FilterDim }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const filtered =
    dim.searchable && needle ? dim.options.filter((o) => optionLabel(o).toLowerCase().includes(needle)) : dim.options;
  const shown = filtered.slice(0, MAX_PILLS);
  const hidden = filtered.length - shown.length;

  const toggle = (value: string) =>
    dim.onChange(dim.active.includes(value) ? dim.active.filter((v) => v !== value) : [...dim.active, value]);

  const Icon = dim.icon;
  return (
    <section aria-label={dim.label}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {dim.label}
          {dim.active.length ? (
            <span className="rounded-full bg-primary/10 px-1.5 text-xs font-semibold text-primary">{dim.active.length}</span>
          ) : null}
        </div>
        {dim.active.length ? (
          <button type="button" onClick={() => dim.onChange([])} className="text-xs text-muted-foreground hover:text-foreground">
            Limpiar
          </button>
        ) : null}
      </div>
      {dim.searchable ? (
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Buscar ${dim.label.toLowerCase()}…`}
          aria-label={`Buscar ${dim.label.toLowerCase()}`}
          className="mb-2 h-9"
        />
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {shown.length === 0 ? (
          <span className="text-xs text-muted-foreground">Sin opciones para ese texto.</span>
        ) : (
          shown.map((o) => {
            const on = dim.active.includes(o.value);
            const text = optionLabel(o);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(o.value)}
                className={cn(
                  'inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all',
                  tagColor(text),
                  on ? 'ring-2 ring-primary' : 'opacity-60',
                )}
              >
                {on ? <Check className="h-3 w-3 shrink-0" /> : null}
                <span className="truncate">{text}</span>
                <span className="shrink-0 tabular-nums opacity-60">{o.count}</span>
              </button>
            );
          })
        )}
      </div>
      {hidden > 0 ? <p className="mt-1.5 text-[11px] text-muted-foreground">+{hidden} más: usa el buscador para acotar.</p> : null}
    </section>
  );
}
