// Calendar-day date helpers. The app stores due dates as an ISO timestamp at
// LOCAL midnight (e.g. 2026-07-06T05:00:00Z in UTC-5). Relative labels must
// compare CALENDAR DAYS — flooring both sides to local start-of-day — otherwise
// a raw millisecond diff against `Date.now()` rounds a task due today to "Ayer"
// for most of the afternoon.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Local midnight of the given date (drops the time-of-day). */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole calendar days from today (local) to the given day. Today = 0,
 * tomorrow = 1, yesterday = -1. */
export function daysFromToday(iso: string | Date): number {
  const day = startOfDay(typeof iso === 'string' ? new Date(iso) : iso);
  const today = startOfDay(new Date());
  return Math.round((day.getTime() - today.getTime()) / MS_PER_DAY);
}

/** A due date is overdue once its calendar day is strictly before today. */
export function isOverdue(iso: string): boolean {
  return daysFromToday(iso) < 0;
}

/**
 * Relative due-date label: Hoy / Mañana / Ayer / "Hace Nd" for the recent past,
 * and an absolute "6 jul" for anything further out.
 */
export function formatDueLabel(iso: string): string {
  const diff = daysFromToday(iso);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  if (diff < 0) return `Hace ${Math.abs(diff)}d`;
  return startOfDay(new Date(iso)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

/** A local `Date` → `YYYY-MM-DD` (the date-only value the pickers exchange). */
export function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** `YYYY-MM-DD` (or an ISO string) → a LOCAL midnight `Date`. Never uses
 * `new Date("YYYY-MM-DD")`, which would parse as UTC and shift a day. */
export function parseDateInput(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Human label for a picker trigger, e.g. "6 jul 2026". */
export function formatDateInput(value: string): string {
  return parseDateInput(value).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
