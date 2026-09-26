import { useEffect, useMemo, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PillOption {
  value: string;
  label: string;
}

/**
 * Pill-shaped single select (rounded trigger + searchable dropdown), matching the
 * MemberFilter look. Drop-in for plain shadcn <Select> where we want the lighter,
 * consistent filter style across the cockpit.
 *
 * The dropdown is rendered as a DOM descendant (NOT a portal) so it stays inside
 * the parent Dialog's focus scope and interactive layer — same trick as `Combobox`.
 * A portaled Radix Popover loses the keyboard (and clicks) inside a modal dialog,
 * which is why the owner select inside LeadDialog used to be unusable.
 */
export function PillSelect({
  value,
  onChange,
  options,
  icon: Icon,
  placeholder = 'Seleccionar…',
  searchPlaceholder = 'Buscar…',
  searchable = true,
  disabled = false,
  align = 'start',
  portal = false,
  className,
  contentClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  options: PillOption[];
  icon?: ComponentType<{ className?: string }>;
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  /** Borde del trigger al que se ancla el menú: 'start' abre a la derecha,
   *  'end' abre hacia la izquierda (evita que se salga del layout). */
  align?: 'start' | 'end';
  /**
   * Renderiza el menú en un portal a <body> con posición `fixed`, para que NO lo
   * recorte el `overflow-hidden` (ni el `translate`) de un modal contenedor. En
   * este modo el foco se queda en el trigger y la navegación por teclado se maneja
   * ahí (el input de búsqueda portaleado perdería el foco por el focus-trap del
   * Dialog de Radix), así que conviene usarlo con listas cortas (`searchable=false`).
   */
  portal?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [dropUp, setDropUp] = useState(false);
  const [active, setActive] = useState(0);
  // Coords fijas del menú portaleado (solo en modo `portal`).
  const [rect, setRect] = useState<{ left: number; top: number; bottom: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sin portal el dropdown es descendiente del body scrolleable del Dialog, así
  // que al abrir cerca del fondo se recorta — lo llevamos a la vista en vez de
  // cortarlo. (En modo portal la posición `fixed` ya lo mantiene visible.)
  useEffect(() => {
    if (open && !portal) dropdownRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open, portal]);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [options, q]);
  const activeIdx = Math.min(active, Math.max(0, filtered.length - 1));

  // Close on outside click. The portaled menu lives outside rootRef, so also
  // treat clicks inside it as "inside" (otherwise the option unmounts on mousedown
  // before its click fires).
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // In portal mode the menu is fixed; if the container scrolls it would drift, so
  // close on any scroll (capture catches the modal's inner scroll too).
  useEffect(() => {
    if (!open || !portal) return;
    function close() {
      setOpen(false);
    }
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [open, portal]);

  function toggle() {
    if (disabled) return;
    const next = !open;
    if (next && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setDropUp(r.bottom > window.innerHeight - 320);
      if (portal) {
        setRect({ left: r.left, top: r.bottom, bottom: window.innerHeight - r.top, width: r.width });
      }
    }
    setOpen(next);
    if (next) {
      setQ('');
      setActive(0);
      // Sin portal enfocamos el input de búsqueda para que el teclado funcione ya.
      // Con portal el input perdería el foco (focus-trap del Dialog), así que
      // dejamos el foco en el trigger y navegamos con teclado desde ahí.
      if (!portal) setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function choose(v: string) {
    onChange(v);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function moveActive(dir: 1 | -1) {
    setActive((i) => (filtered.length ? (i + dir + filtered.length) % filtered.length : 0));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = filtered[activeIdx];
      if (o) choose(o.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  // Teclado del trigger: solo relevante en modo portal (donde el input no tiene
  // foco). Abre con ↓/Enter y navega la lista sin depender del input.
  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!portal) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = filtered[activeIdx];
      if (o) choose(o.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  const menuInner = (
    <>
      {/* Always rendered so there's a focus target for keyboard navigation;
          fully hidden (wrapper included) when not searchable, or in portal mode
          where the trigger owns the keyboard (a portaled input loses focus to the
          Dialog's focus-trap). */}
      <div className={cn('flex items-center gap-2 border-b px-3', (!searchable || portal) && 'sr-only')}>
        <Search className="h-4 w-4 shrink-0 opacity-50" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={searchPlaceholder}
          className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="max-h-[18rem] overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">Sin resultados</div>
        ) : null}
        {filtered.map((o, i) => (
          <button
            key={o.value}
            type="button"
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(o.value)}
            className={cn(
              'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
              i === activeIdx ? 'bg-accent' : 'hover:bg-accent',
            )}
          >
            <span className="truncate">{o.label}</span>
            {o.value === value ? <Check className="ml-auto h-4 w-4 shrink-0" /> : null}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-full border border-border bg-white px-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-800 dark:hover:bg-neutral-50',
          className,
        )}
      >
        {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
        <span className="max-w-[160px] truncate">{selected ? selected.label : placeholder}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && portal && rect
        ? createPortal(
            <div
              ref={dropdownRef}
              style={{
                position: 'fixed',
                width: Math.max(rect.width, 224),
                left: align === 'end' ? undefined : rect.left,
                right: align === 'end' ? window.innerWidth - (rect.left + rect.width) : undefined,
                ...(dropUp ? { bottom: rect.bottom + 4 } : { top: rect.top + 4 }),
              }}
              className={cn(
                // pointer-events-auto: dentro de un Dialog modal de Radix el <body> queda
                // con pointer-events:none; como este menú se portalea a <body> (hermano del
                // DialogContent) hereda ese none y los clicks a las opciones no llegan. Lo
                // reactivamos explícitamente en el menú.
                'pointer-events-auto z-[80] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
                contentClassName,
              )}
            >
              {menuInner}
            </div>,
            document.body,
          )
        : null}

      {open && !portal ? (
        <div
          ref={dropdownRef}
          className={cn(
            'absolute z-50 w-56 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
            align === 'end' ? 'right-0' : 'left-0',
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
            contentClassName,
          )}
        >
          {menuInner}
        </div>
      ) : null}
    </div>
  );
}
