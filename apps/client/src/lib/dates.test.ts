import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  daysFromToday,
  formatDueLabel,
  isOverdue,
  parseDateInput,
  startOfDay,
  toDateInput,
} from './dates';

/** ISO exactly as the app stores a due date: local midnight of the given day. */
function storedDueDate(y: number, m: number, d: number): string {
  return new Date(y, m - 1, d).toISOString();
}

describe('relative due-date labels', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The exact bug scenario: mid-afternoon, when the old millisecond diff
    // rounded a task due *today* down to −1 → "Ayer".
    vi.setSystemTime(new Date(2026, 6, 6, 14, 30, 0)); // 2026-07-06 14:30 local
  });
  afterEach(() => vi.useRealTimers());

  it('labels a task due TODAY as "Hoy" (not "Ayer") in the afternoon', () => {
    expect(formatDueLabel(storedDueDate(2026, 7, 6))).toBe('Hoy');
    expect(isOverdue(storedDueDate(2026, 7, 6))).toBe(false);
  });

  it('labels tomorrow / yesterday correctly', () => {
    expect(formatDueLabel(storedDueDate(2026, 7, 7))).toBe('Mañana');
    expect(formatDueLabel(storedDueDate(2026, 7, 5))).toBe('Ayer');
  });

  it('marks past days overdue and labels the recent past in days', () => {
    expect(isOverdue(storedDueDate(2026, 7, 5))).toBe(true);
    expect(formatDueLabel(storedDueDate(2026, 7, 3))).toBe('Hace 3d');
  });

  it('shows an absolute date for further-out days', () => {
    // Exact wording depends on the ICU locale build ("20 jul" / "20 de jul");
    // assert it's an absolute date, not a relative label.
    const label = formatDueLabel(storedDueDate(2026, 7, 20));
    expect(label).toMatch(/20/);
    expect(label).toMatch(/jul/i);
    expect(label).not.toMatch(/Hace|Hoy|Ayer|Mañana/);
    expect(isOverdue(storedDueDate(2026, 7, 20))).toBe(false);
  });

  it('counts calendar days regardless of time of day', () => {
    // Same calendar day, any hour → 0.
    expect(daysFromToday(new Date(2026, 6, 6, 23, 0, 0))).toBe(0);
    expect(daysFromToday(new Date(2026, 6, 7, 1, 0, 0))).toBe(1);
  });
});

describe('date-only conversion (no UTC day shift)', () => {
  it('round-trips YYYY-MM-DD through local time', () => {
    expect(toDateInput(parseDateInput('2026-07-06'))).toBe('2026-07-06');
  });

  it('parses YYYY-MM-DD as LOCAL midnight, not UTC', () => {
    const d = parseDateInput('2026-07-06');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July
    expect(d.getDate()).toBe(6); // never rolls back to the 5th
  });

  it('extracts the local calendar day from a stored midnight ISO', () => {
    expect(toDateInput(startOfDay(new Date(storedDueDate(2026, 7, 6))))).toBe('2026-07-06');
  });
});
