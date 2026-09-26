import { useMemo, useState } from 'react';
import { Check, Filter, Search } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { tagColor } from '@/lib/crm';
import { optionLabel, type FilterOption } from './TableFilters';

interface Props {
  label: string;
  options: FilterOption[];
  /** Valores seleccionados (multi-select). Vacío = sin filtro. */
  active: string[];
  onChange: (values: string[]) => void;
  /** Buscador arriba para colar opciones (listas largas). */
  searchable?: boolean;
  /** Menú más ancho y alto (textos largos, p. ej. industria). */
  wide?: boolean;
}

// Filtro de columna inline en el encabezado. Multi-select CLICKABLE: cada opción
// es una pill que se enciende/apaga; se pueden elegir varias. Mismos colores que
// los tags del pipeline.
export function ColumnFilter({ label, options, active, onChange, searchable, wide }: Props) {
  const activeSet = new Set(active);
  const count = active.length;
  const [query, setQuery] = useState('');

  function toggle(value: string) {
    const next = new Set(activeSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange([...next]);
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter((o) => optionLabel(o).toLowerCase().includes(q));
  }, [options, query, searchable]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          // El encabezado es el asa de arrastre de la columna: sin esto, abrir el
          // filtro empezaría a arrastrarla.
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            'relative rounded-md p-0.5 transition-colors',
            count > 0 ? 'text-primary' : 'text-muted-foreground/50 hover:text-foreground',
          )}
          aria-label={count > 0 ? `Filtrar por ${label} (${count} activos)` : `Filtrar por ${label}`}
        >
          <Filter className="h-3 w-3" />
          {count > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-bold leading-none text-primary-foreground">
              {count}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      {/* Título + buscador quedan fijos; solo la lista scrollea. */}
      <DropdownMenuContent align="start" className={cn('p-1', wide ? 'w-72' : 'w-56')}>
        <DropdownMenuLabel className="flex items-center justify-between">
          {label}
          {count > 0 ? (
            <button type="button" onClick={() => onChange([])} className="text-xs font-normal text-primary hover:underline">
              Limpiar
            </button>
          ) : null}
        </DropdownMenuLabel>
        {searchable ? (
          <div className="relative px-1 pb-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // Radix captura las teclas para su typeahead: paramos la propagación
              // para poder escribir en el buscador.
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={`Buscar ${label.toLowerCase()}…`}
              aria-label={`Buscar ${label.toLowerCase()}`}
              className="h-7 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        ) : null}
        <DropdownMenuSeparator />
        <div className={cn('overflow-y-auto', wide ? 'max-h-[26rem]' : 'max-h-80')}>
          {shown.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">Sin opciones para ese texto.</p>
          ) : null}
          {shown.map((o) => {
            const on = activeSet.has(o.value);
            const text = optionLabel(o);
            return (
              <DropdownMenuItem
                key={o.value}
                // No cerrar al elegir: el multi-select se arma con varios clicks.
                onSelect={(e) => {
                  e.preventDefault();
                  toggle(o.value);
                }}
                aria-checked={on}
                role="menuitemcheckbox"
                className={cn('cursor-pointer gap-2', on && 'bg-accent')}
              >
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-inset transition-shadow',
                    tagColor(text),
                    on && 'ring-2 ring-primary',
                  )}
                >
                  {text}
                </span>
                {on ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">{o.count}</span>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Pill de valor libre (cargo / industria / origen). Null si está vacío para que
 *  la tabla deje la celda en blanco y no aplique el tinte de "con dato". */
export function Pill({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  return <span className={cn('rounded-md px-1.5 py-0.5 text-xs font-medium', tagColor(value))}>{value}</span>;
}
