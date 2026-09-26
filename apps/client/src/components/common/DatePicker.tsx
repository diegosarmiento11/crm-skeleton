import { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { formatDateInput, parseDateInput, startOfDay, toDateInput } from '@/lib/dates';

interface Props {
  /** Date-only value `YYYY-MM-DD` (or empty/null for none). */
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** Disable days before today (deadlines/future-only fields). */
  disablePast?: boolean;
  /** Show a "Sin fecha" shortcut and allow clearing to null. */
  clearable?: boolean;
  /** Show Hoy / Mañana / +1 semana shortcuts (default true). */
  presets?: boolean;
  placeholder?: string;
  id?: string;
  /** Extra classes for the trigger button (e.g. compact inline variants). */
  className?: string;
  align?: 'start' | 'center' | 'end';
  disabled?: boolean;
  /**
   * Modal popover (default true) so the calendar stays interactive when nested
   * in a Radix Dialog. Pass false for inline/page usages to avoid the scroll
   * lock (they don't need it — nothing makes them inert).
   */
  modal?: boolean;
}

/**
 * Modern date picker: a popover with a month calendar (es-CO, Monday-first) and
 * quick shortcuts. Exchanges a plain `YYYY-MM-DD` string so it drops into the
 * existing controlled inputs, and does all date math in LOCAL time (never
 * `new Date("YYYY-MM-DD")`, which would parse as UTC and shift a day).
 */
export function DatePicker({
  value,
  onChange,
  disablePast,
  clearable,
  presets = true,
  placeholder = 'Seleccionar fecha',
  id,
  className,
  align = 'start',
  disabled,
  modal = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const today = startOfDay(new Date());
  const selected = value ? parseDateInput(value) : undefined;

  function commit(date: Date | null) {
    onChange(date ? toDateInput(date) : null);
    setOpen(false);
  }

  function inDays(n: number): Date {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() + n);
    return d;
  }

  const showBar = presets || clearable;

  return (
    // `modal` (default) so the calendar is interactive even inside a modal
    // Dialog — a non-modal popover nested in a Radix Dialog inherits the
    // dialog's inert pointer-events / focus trap and its days become unclickable.
    <Popover open={open} onOpenChange={setOpen} modal={modal}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{value ? formatDateInput(value) : placeholder}</span>
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        {showBar ? (
          <div className="flex flex-wrap gap-1 border-b p-2">
            {presets ? (
              <>
                <Preset label="Hoy" onClick={() => commit(today)} />
                <Preset label="Mañana" onClick={() => commit(inDays(1))} />
                <Preset label="+1 semana" onClick={() => commit(inDays(7))} />
              </>
            ) : null}
            {clearable ? (
              <Preset label="Sin fecha" onClick={() => commit(null)} muted />
            ) : null}
          </div>
        ) : null}
        <Calendar
          mode="single"
          locale={es}
          selected={selected}
          defaultMonth={selected ?? today}
          onSelect={(d) => d && commit(d)}
          disabled={disablePast ? { before: today } : undefined}
          showOutsideDays
        />
      </PopoverContent>
    </Popover>
  );
}

function Preset({ label, onClick, muted }: { label: string; onClick: () => void; muted?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-1 text-xs font-medium transition-colors',
        muted
          ? 'ml-auto text-muted-foreground hover:bg-muted hover:text-foreground'
          : 'bg-muted text-foreground hover:bg-accent',
      )}
    >
      {label}
    </button>
  );
}
