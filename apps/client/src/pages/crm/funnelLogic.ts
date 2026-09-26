import type { DateRange } from '@/hooks/useCrm';
import { parseDateInput, startOfDay } from '@/lib/dates';

// Lógica pura del filtro de rango del embudo (probada sin DOM).

export const FUNNEL_PRESETS = [
  { value: 'month', label: 'Este mes' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: '90d', label: 'Últimos 90 días' },
  { value: 'year', label: 'Este año' },
  { value: 'all', label: 'Todo' },
  { value: 'custom', label: 'Personalizado' },
] as const;

export type FunnelPreset = (typeof FUNNEL_PRESETS)[number]['value'];

export function isFunnelPreset(v: string | null | undefined): v is FunnelPreset {
  return FUNNEL_PRESETS.some((p) => p.value === v);
}

/**
 * Rango ISO para un preset. `to` se omite en los presets relativos (= hasta hoy)
 * y `all` no acota nada. Los límites son medianoche LOCAL, que es como el equipo
 * piensa "este mes".
 */
export function rangeForPreset(preset: FunnelPreset, now: Date = new Date()): DateRange {
  const today = startOfDay(now);
  switch (preset) {
    case 'month':
      return { from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString() };
    case 'year':
      return { from: new Date(today.getFullYear(), 0, 1).toISOString() };
    case '30d':
    case '90d': {
      const d = new Date(today);
      d.setDate(d.getDate() - (preset === '30d' ? 30 : 90));
      return { from: d.toISOString() };
    }
    default:
      return {};
  }
}

/**
 * Rango personalizado a partir de dos fechas `YYYY-MM-DD` (las que intercambia el
 * DatePicker). `to` es inclusivo: se manda el inicio del día siguiente.
 */
export function customRange(from: string | null, to: string | null): DateRange {
  const range: DateRange = {};
  if (from) range.from = parseDateInput(from).toISOString();
  if (to) {
    const end = parseDateInput(to);
    end.setDate(end.getDate() + 1);
    range.to = end.toISOString();
  }
  return range;
}

export const pct = (n: number | null | undefined): string => (n == null ? '—' : `${Math.round(n * 100)}%`);

export const days = (n: number | null | undefined): string => (n == null ? '—' : `${Math.round(n)} d`);

/** Avance de la meta mensual en 0..1 (null sin meta). Se acota a 1 para la barra. */
export function goalProgress(won: number, goal: number | null | undefined): number | null {
  if (!goal || goal <= 0) return null;
  return Math.min(1, won / goal);
}
