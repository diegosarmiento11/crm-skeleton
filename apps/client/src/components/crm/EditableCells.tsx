import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { Check, Search, X } from 'lucide-react';
import { ContactStatusSchema, type ContactStatus } from '@crm/shared';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CONTACT_STATUS_LABELS } from './TableFormat';

/**
 * Celdas editables in-place para las tablas de Personas/Empresas: llenar la data
 * sin abrir el perfil. Convención: click en cualquier parte de la celda que NO sea
 * un link/botón entra a editar; las celdas vacías quedan en blanco pero se pueden
 * tocar.
 */

/** true si el click cayó sobre un elemento interactivo del contenido (link/copiar). */
function hitInteractive(e: MouseEvent): boolean {
  return Boolean((e.target as HTMLElement).closest('a,button'));
}

export function EditableTextCell({
  value,
  display,
  placeholder = 'Escribir…',
  label,
  onSave,
}: {
  value: string | null | undefined;
  /** Qué mostrar cuando hay valor (link, copiar…); por defecto el texto plano. */
  display?: ReactNode;
  placeholder?: string;
  /** Nombre del campo para lectores de pantalla ("Editar correo"). */
  label: string;
  onSave: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function commit() {
    setEditing(false);
    const v = draft.trim();
    if ((v || null) !== (value ?? null)) onSave(v || null);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-full bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/50"
      />
    );
  }

  function startEdit() {
    setDraft(value ?? '');
    setEditing(true);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Editar ${label.toLowerCase()}`}
      onClick={(e) => {
        e.stopPropagation();
        if (hitInteractive(e)) return;
        startEdit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startEdit();
        }
      }}
      className="flex w-full min-w-0 cursor-text items-center rounded-md py-2 outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {value ? <span className="min-w-0 truncate">{display ?? value}</span> : <span className="w-full">&nbsp;</span>}
    </div>
  );
}

/**
 * Celda con menú buscable sobre una lista de opciones + texto libre ("Usar «…»").
 * Base de ciudad / industria / cargo / origen.
 */
export function SelectCell({
  value,
  options,
  display,
  label,
  searchPlaceholder = 'Buscar…',
  clearLabel = 'Quitar',
  onSave,
}: {
  value: string | null | undefined;
  options: readonly string[];
  /** Qué mostrar en la celda cuando hay valor (p. ej. el pill de cargo). */
  display?: ReactNode;
  /** Nombre del campo para lectores de pantalla. */
  label: string;
  searchPlaceholder?: string;
  clearLabel?: string;
  onSave: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options.slice(0, 60);
    return options.filter((c) => c.toLowerCase().includes(s)).slice(0, 60);
  }, [q, options]);

  function pick(v: string | null) {
    if (v !== (value ?? null)) onSave(v);
    setOpen(false);
  }

  const typed = q.trim();
  const canCreate = typed && !filtered.some((c) => c.toLowerCase() === typed.toLowerCase());

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) setQ('');
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Editar ${label.toLowerCase()}`}
          onClick={(e) => e.stopPropagation()}
          className="block h-full w-full cursor-pointer truncate rounded-md py-1.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {value ? <span className="min-w-0 truncate">{display ?? value}</span> : <span className="w-full">&nbsp;</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-64 p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 opacity-50" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (canCreate) pick(typed);
                else if (filtered[0]) pick(filtered[0]);
              }
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {value ? (
            <button
              type="button"
              onClick={() => pick(null)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" /> {clearLabel}
            </button>
          ) : null}
          {canCreate ? (
            <button
              type="button"
              onClick={() => pick(typed)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              Usar «{typed}»
            </button>
          ) : null}
          {filtered.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pick(c)}
              className={cn('flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', c === value && 'font-medium')}
            >
              <span className="truncate">{c}</span>
              {c === value ? <Check className="ml-auto h-4 w-4 shrink-0" /> : null}
            </button>
          ))}
          {filtered.length === 0 && !canCreate ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">Escribe para crear un valor nuevo.</div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Clases COMPLETAS por estado (el JIT no genera clases armadas dinámicamente).
const CONTACT_STATUS_DOT: Record<ContactStatus, string> = {
  CONTACTAR: 'bg-green-500',
  NO_CONTACTAR: 'bg-amber-500',
  DE_BAJA: 'bg-destructive',
};

/**
 * Estado de contacto editable con un Select. Cualquier sistema de envío respeta
 * este campo, por eso se edita a la vista y no escondido en el perfil.
 */
export function ContactStatusCell({
  value,
  onSave,
  disabled,
}: {
  value: ContactStatus;
  onSave: (v: ContactStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div onClick={(e) => e.stopPropagation()} className="w-full">
      <Select value={value} onValueChange={(v) => onSave(v as ContactStatus)} disabled={disabled}>
        <SelectTrigger className="h-7 border-0 bg-transparent px-1 text-[13px] shadow-none focus:ring-1" aria-label="Estado de contacto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ContactStatusSchema.options.map((s) => (
            <SelectItem key={s} value={s}>
              <span className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', CONTACT_STATUS_DOT[s])} />
                {CONTACT_STATUS_LABELS[s]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
