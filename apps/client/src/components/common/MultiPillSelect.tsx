import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PillOption } from './PillSelect';

/**
 * Variante multi-select de PillSelect: trigger tipo pill + dropdown buscable donde
 * cada opción es CLICKABLE (se enciende/apaga), sin checkbox. Sirve para filtros
 * donde quieres elegir 1, 2, 3 o más valores (p. ej. industrias del pipeline).
 *
 * `values` vacío = sin filtro (el trigger muestra `allLabel`).
 */
export function MultiPillSelect({
  values,
  onChange,
  options,
  icon: Icon,
  allLabel = 'Todos',
  searchPlaceholder = 'Buscar…',
  align = 'start',
  className,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: PillOption[];
  icon?: ComponentType<{ className?: string }>;
  /** Etiqueta cuando no hay nada seleccionado (equivale a "Todas"). */
  allLabel?: string;
  searchPlaceholder?: string;
  align?: 'start' | 'end';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(values), [values]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setQ('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function toggleValue(v: string) {
    const next = new Set(selectedSet);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange([...next]);
  }

  const triggerLabel =
    values.length === 0
      ? allLabel
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? values[0])
        : `${values.length} seleccionadas`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors',
          values.length > 0
            ? 'border-[#0563fe] bg-[#0563fe]/5 text-[#0563fe]'
            : 'border-border bg-white text-neutral-800 hover:bg-neutral-50 dark:bg-white dark:text-neutral-800 dark:hover:bg-neutral-50',
          className,
        )}
      >
        {Icon ? <Icon className="h-3.5 w-3.5 opacity-70" /> : null}
        <span className="max-w-[160px] truncate">{triggerLabel}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </button>

      {open ? (
        <div
          className={cn(
            'absolute z-50 mt-1 w-60 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {values.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full border-b px-3 py-1.5 text-left text-xs font-medium text-primary hover:bg-accent"
            >
              Limpiar selección
            </button>
          ) : null}
          <div className="max-h-[18rem] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">Sin resultados</div>
            ) : null}
            {filtered.map((o) => {
              const on = selectedSet.has(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggleValue(o.value)}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                    on ? 'bg-accent' : 'hover:bg-accent',
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {on ? <Check className="ml-auto h-4 w-4 shrink-0 text-[#0563fe]" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
