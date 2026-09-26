import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronsUpDown, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ComboOption {
  value: string;
  label: string;
  /** Secondary text shown dimmed (e.g. domain or email) and included in search. */
  sub?: string;
  icon?: ReactNode;
}

const TRIGGER_CLS =
  'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

function useClickOutside<T extends HTMLElement>(ref: React.RefObject<T>, onOut: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOut]);
}

/**
 * Filters locally. When `serverSide` is true the options already come filtered
 * by the backend (see `onSearch`), so re-filtering here would only drop rows the
 * server matched with richer rules (emails, other columns).
 */
function useFiltered(options: ComboOption[], q: string, serverSide: boolean) {
  return useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || serverSide) return options;
    return options.filter((o) => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(s));
  }, [options, q, serverSide]);
}

/**
 * Pushes the typed query to the consumer (debounced) so it can re-query the
 * backend. Held in a ref so an inline arrow function doesn't retrigger it.
 */
function useSearchBridge(q: string, onSearch?: (q: string) => void) {
  const ref = useRef(onSearch);
  ref.current = onSearch;
  useEffect(() => {
    if (!ref.current) return;
    const t = setTimeout(() => ref.current?.(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
}

/**
 * Remembers every option ever seen (plus the caller-supplied `known` ones) so a
 * selected value keeps its label after a server-side search replaces the list.
 * Without this, selected chips fall back to raw UUIDs.
 */
function useOptionMemory(options: ComboOption[], known?: ComboOption[]) {
  const memory = useRef(new Map<string, ComboOption>());
  for (const o of known ?? []) memory.current.set(o.value, o);
  for (const o of options) memory.current.set(o.value, o);
  return memory.current;
}

/**
 * Inline searchable dropdown. Renders the panel as a DOM descendant (NOT a portal)
 * so it stays inside the parent Dialog's focus scope and interactive layer — this
 * is what lets the search input receive the keyboard inside a modal dialog.
 */
function Panel({ dropUp, children }: { dropUp: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        'absolute left-0 z-50 w-full min-w-[16rem] rounded-md border bg-popover text-popover-foreground shadow-md',
        dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
      )}
    >
      {children}
    </div>
  );
}

function SearchRow({
  value,
  onChange,
  inputRef,
  placeholder,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  placeholder?: string;
  onEnter?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b px-3">
      <Search className="h-4 w-4 shrink-0 opacity-50" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

function CreateFooter({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="border-t p-1">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
      >
        <Plus className="h-4 w-4" /> {label}
      </button>
    </div>
  );
}

const ITEM_CLS =
  'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent';

interface ComboboxProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  noneLabel?: string;
  onCreate?: () => void;
  createLabel?: string;
  disabled?: boolean;
  /**
   * Let the user commit a free-typed value that isn't in the option list (the
   * value becomes the typed string). Useful for governed-but-open fields like
   * Ubicación where the list is a suggestion, not a closed set.
   */
  allowCustom?: boolean;
  /**
   * Server-side search: called with the typed query (debounced). Providing it
   * turns OFF local filtering — `options` are expected to be the server's
   * answer for that query. Required whenever the catalog can outgrow one page.
   */
  onSearch?: (q: string) => void;
  /** Options whose labels must survive a search that no longer returns them. */
  knownOptions?: ComboOption[];
  /** Shows a loading hint instead of "Sin resultados" while the query is in flight. */
  loading?: boolean;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar…',
  searchPlaceholder = 'Buscar…',
  emptyLabel = 'Sin resultados',
  noneLabel,
  onCreate,
  createLabel = 'Crear',
  disabled,
  allowCustom,
  onSearch,
  knownOptions,
  loading,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useClickOutside(rootRef, () => setOpen(false));

  useSearchBridge(q, onSearch);
  const memory = useOptionMemory(options, knownOptions);
  const selected = options.find((o) => o.value === value) ?? (value ? memory.get(value) : undefined);
  const filtered = useFiltered(options, q, Boolean(onSearch));
  // Show a free-typed value even when it isn't (or no longer is) in the list.
  const displayLabel = selected?.label ?? (value || null);
  const trimmed = q.trim();
  const hasExact =
    !trimmed || options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());
  const showCustom = Boolean(allowCustom && trimmed && !hasExact);

  function commitCustom() {
    onChange(trimmed);
    setOpen(false);
  }

  function toggle() {
    if (disabled) return;
    const next = !open;
    if (next && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setDropUp(r.bottom > window.innerHeight - 440);
    }
    setOpen(next);
    if (next) {
      setQ('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button ref={triggerRef} type="button" disabled={disabled} onClick={toggle} className={TRIGGER_CLS}>
        <span className={cn('flex items-center gap-2 truncate', !displayLabel && 'text-muted-foreground')}>
          {displayLabel ? (
            <>
              {selected?.icon}
              <span className="truncate">{displayLabel}</span>
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
      {open ? (
        <Panel dropUp={dropUp}>
          <SearchRow
            value={q}
            onChange={setQ}
            inputRef={inputRef}
            placeholder={searchPlaceholder}
            onEnter={showCustom ? commitCustom : undefined}
          />
          <div className="max-h-[22rem] overflow-y-auto p-1">
            {noneLabel ? (
              <button type="button" className={ITEM_CLS} onClick={() => { onChange(null); setOpen(false); }}>
                <span className="text-muted-foreground">{noneLabel}</span>
                {value == null ? <Check className="ml-auto h-4 w-4" /> : null}
              </button>
            ) : null}
            {filtered.length === 0 && !showCustom ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                {loading ? 'Buscando…' : emptyLabel}
              </div>
            ) : null}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                className={ITEM_CLS}
                onClick={() => { onChange(o.value); setOpen(false); }}
              >
                {o.icon}
                <span className="truncate">{o.label}</span>
                {o.sub ? <span className="truncate text-xs text-muted-foreground">{o.sub}</span> : null}
                {value === o.value ? <Check className="ml-auto h-4 w-4 shrink-0" /> : null}
              </button>
            ))}
          </div>
          {showCustom ? (
            <CreateFooter label={`Usar «${trimmed}»`} onClick={commitCustom} />
          ) : null}
          {onCreate ? <CreateFooter label={createLabel} onClick={() => { setOpen(false); onCreate(); }} /> : null}
        </Panel>
      ) : null}
    </div>
  );
}

interface MultiComboboxProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  onCreate?: () => void;
  createLabel?: string;
  disabled?: boolean;
  /** See `ComboboxProps.onSearch` — turns OFF local filtering. */
  onSearch?: (q: string) => void;
  /** Options whose labels must survive a search that no longer returns them. */
  knownOptions?: ComboOption[];
  /** Shows a loading hint instead of "Sin resultados" while the query is in flight. */
  loading?: boolean;
}

export function MultiCombobox({
  values,
  onChange,
  options,
  placeholder = 'Agregar…',
  searchPlaceholder = 'Buscar…',
  emptyLabel = 'Sin resultados',
  onCreate,
  createLabel = 'Crear',
  disabled,
  onSearch,
  knownOptions,
  loading,
}: MultiComboboxProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useClickOutside(rootRef, () => setOpen(false));

  useSearchBridge(q, onSearch);
  const byValue = useOptionMemory(options, knownOptions);
  const filtered = useFiltered(options, q, Boolean(onSearch));

  function toggleOpen() {
    if (disabled) return;
    const next = !open;
    if (next && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setDropUp(r.bottom > window.innerHeight - 440);
    }
    setOpen(next);
    if (next) {
      setQ('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }
  function toggleValue(v: string) {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  }

  return (
    <div className="space-y-1.5">
      {values.length ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => {
            const o = byValue.get(v);
            return (
              <span key={v} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                {o?.icon}
                {o?.label ?? v}
                <button
                  type="button"
                  onClick={() => toggleValue(v)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Quitar"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      <div ref={rootRef} className="relative">
        <button ref={triggerRef} type="button" disabled={disabled} onClick={toggleOpen} className={TRIGGER_CLS}>
          <span className="text-muted-foreground">{placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
        {open ? (
          <Panel dropUp={dropUp}>
            <SearchRow value={q} onChange={setQ} inputRef={inputRef} placeholder={searchPlaceholder} />
            <div className="max-h-[22rem] overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {loading ? 'Buscando…' : emptyLabel}
                </div>
              ) : null}
              {filtered.map((o) => {
                const checked = values.includes(o.value);
                return (
                  <button key={o.value} type="button" className={ITEM_CLS} onClick={() => toggleValue(o.value)}>
                    {o.icon}
                    <span className="truncate">{o.label}</span>
                    {o.sub ? <span className="truncate text-xs text-muted-foreground">{o.sub}</span> : null}
                    <span
                      className={cn(
                        'ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                        checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                      )}
                    >
                      {checked ? <Check className="h-3 w-3" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {onCreate ? <CreateFooter label={createLabel} onClick={() => { setOpen(false); onCreate(); }} /> : null}
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
