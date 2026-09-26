import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { AutoGrowTextarea } from '@/components/common/AutoGrowTextarea';
import { MemberAvatar } from '@/components/team/MemberAvatar';
import { useMembers, type Member } from '@/lib/members';
import { cn } from '@/lib/utils';
import { detectMention, insertMention, type MentionQuery } from './activityLogic';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Cmd/Ctrl + Enter. */
  onSubmit?: () => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  className?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
  disabled?: boolean;
}

/**
 * Textarea autoajustable con autocompletado de `@menciones` sobre los miembros
 * activos. Al elegir uno se inserta el token estable `@[correo]` (lo que guarda
 * el servidor); el nombre se resuelve al pintar, así la mención sigue apuntando a
 * la persona correcta aunque cambie de nombre.
 *
 * La lista de sugerencias NO se portalea: queda dentro del wrapper para no salirse
 * del focus-scope del Sheet/Dialog que la contiene. Los ítems capturan `mousedown`
 * para que el textarea no pierda el foco al hacer clic.
 */
export function ActivityMentionTextarea({
  value,
  onChange,
  onSubmit,
  placeholder,
  minRows = 3,
  maxRows = 12,
  className,
  autoFocus,
  disabled,
  'aria-label': ariaLabel,
}: Props) {
  const { activeMembers } = useMembers();
  const ref = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const [query, setQuery] = useState<MentionQuery | null>(null);
  const [active, setActive] = useState(0);

  const suggestions: Member[] = query
    ? activeMembers
        .filter((m) => m.name.toLowerCase().includes(query.text) || m.email.toLowerCase().includes(query.text))
        .slice(0, 6)
    : [];
  const open = query !== null && suggestions.length > 0;
  const activeIdx = Math.min(active, Math.max(0, suggestions.length - 1));

  function detect(text: string) {
    const caret = ref.current?.selectionStart ?? text.length;
    setQuery(detectMention(text, caret));
  }

  function pick(m: Member) {
    if (!query) return;
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const next = insertMention(value, caret, query, m.id);
    onChange(next.text);
    setQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit?.();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      pick(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      // Se detiene aquí para que el Escape cierre la lista y no el panel entero.
      e.preventDefault();
      e.stopPropagation();
      setQuery(null);
    }
  }

  return (
    <div className="relative">
      <AutoGrowTextarea
        ref={ref}
        minRows={minRows}
        maxRows={maxRows}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) detect(value);
        }}
        onClick={() => detect(value)}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
        placeholder={placeholder}
        className={className}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Miembros para mencionar"
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 top-full z-50 mt-1 max-h-60 w-64 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {suggestions.map((m, i) => (
            <li key={m.id} role="option" aria-selected={i === activeIdx}>
              <button
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(m)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                  i === activeIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent',
                )}
              >
                <MemberAvatar name={m.name} seed={m.id} size="sm" />
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">{m.email}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
