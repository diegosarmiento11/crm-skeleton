import { CRM_CURRENCY, CRM_LOCALE, type PipelineStage } from '@crm/shared';
import { resolveMemberName } from '@/lib/members';

/** Nombre para mostrar de un responsable (id = correo), o el id si no se conoce. */
export function ownerName(id: string | null | undefined): string {
  return resolveMemberName(id);
}

const moneyFmt = new Intl.NumberFormat(CRM_LOCALE, {
  style: 'currency',
  currency: CRM_CURRENCY,
  maximumFractionDigits: 0,
});

/** Dinero desde un helper, nunca concatenando el símbolo. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return moneyFmt.format(value);
}

/** Versión corta para tarjetas y ejes: 12,5 M · 850 k. */
export function formatMoneyShort(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString(CRM_LOCALE, { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString(CRM_LOCALE, { maximumFractionDigits: 0 })} k`;
  return value.toLocaleString(CRM_LOCALE);
}

/**
 * Clases Tailwind COMPLETAS por color de etapa (el JIT no genera clases
 * construidas dinámicamente). Nunca armar estas cadenas con template strings.
 */
export const STAGE_COLOR_CLASSES: Record<string, { badge: string; dot: string; header: string; ring: string }> = {
  slate: { badge: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300', dot: 'bg-slate-400', header: 'bg-slate-100 dark:bg-slate-500/15', ring: 'ring-slate-400 dark:ring-slate-400/50' },
  blue: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300', dot: 'bg-blue-500', header: 'bg-blue-100 dark:bg-blue-500/15', ring: 'ring-blue-500 dark:ring-blue-400/50' },
  green: { badge: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300', dot: 'bg-green-500', header: 'bg-green-100 dark:bg-green-500/15', ring: 'ring-green-500 dark:ring-green-400/50' },
  amber: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300', dot: 'bg-amber-500', header: 'bg-amber-100 dark:bg-amber-500/15', ring: 'ring-amber-500 dark:ring-amber-400/50' },
  red: { badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300', dot: 'bg-red-500', header: 'bg-red-100 dark:bg-red-500/15', ring: 'ring-red-500 dark:ring-red-400/50' },
  purple: { badge: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300', dot: 'bg-purple-500', header: 'bg-purple-100 dark:bg-purple-500/15', ring: 'ring-purple-500 dark:ring-purple-400/50' },
  teal: { badge: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300', dot: 'bg-teal-500', header: 'bg-teal-100 dark:bg-teal-500/15', ring: 'ring-teal-500 dark:ring-teal-400/50' },
};

export function stageColor(color: string | null | undefined) {
  return STAGE_COLOR_CLASSES[color ?? 'slate'] ?? STAGE_COLOR_CLASSES.slate;
}

/** Etapa perdida = kind LOST (el servidor decide por `kind`, nunca por el nombre). */
export function isLostStage(stage: Pick<PipelineStage, 'kind'> | null | undefined): boolean {
  return stage?.kind === 'LOST';
}

export function isClosedStage(stage: Pick<PipelineStage, 'kind'> | null | undefined): boolean {
  return stage?.kind === 'WON' || stage?.kind === 'LOST';
}

/** Badge de color estable para etiquetas libres (servicio, sector): mismo valor → mismo color. */
const TAG_PALETTE = [
  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  'bg-lime-100 text-lime-700 dark:bg-lime-500/20 dark:text-lime-300',
];

export function tagColor(value: string | null | undefined): string {
  if (!value) return 'bg-muted text-muted-foreground';
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

export const linkInternal = 'underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground';
export const linkExternal = 'text-primary hover:underline';

/** Banda de salud → etiqueta + color del punto (clase completa). */
export const HEALTH_META: Record<string, { label: string; dot: string }> = {
  hot: { label: 'Activo', dot: 'bg-green-500' },
  warm: { label: 'En seguimiento', dot: 'bg-blue-500' },
  cold: { label: 'Frío', dot: 'bg-amber-500' },
  at_risk: { label: 'En riesgo', dot: 'bg-red-500' },
};

/** Días enteros desde una fecha ISO. */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(CRM_LOCALE, { day: 'numeric', month: 'short' });
}

export function fullDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(CRM_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeTime(iso: string | null | undefined): string {
  const days = daysSince(iso);
  if (days === null) return '—';
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}
