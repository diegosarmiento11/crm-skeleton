import { DATA_SOURCE_LABELS, normalizeSource, sourceLabel, type ContactStatus, type Facet, type Person } from '@crm/shared';
import type { FilterOption } from './TableFilters';

/**
 * Helpers puros de formato/mapeo que comparten las tablas de Personas y Empresas.
 * Van aparte de los componentes para poder probarlos sin montar nada.
 */

// Etiquetas del estado de contacto. Espejo de ContactStatusSchema; el orden es
// el del menú (lo normal primero, la baja al final).
export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  CONTACTAR: 'Contactar',
  NO_CONTACTAR: 'No contactar',
  DE_BAJA: 'De baja',
};

/** Facetas de origen → opciones: el servidor manda slugs y 'none' para "sin origen". */
export function sourceFacetOptions(facets: Facet[] | undefined): FilterOption[] {
  return (facets ?? []).map((f) => ({
    value: f.value,
    count: f.count,
    label: sourceLabel(f.value === 'none' ? null : f.value),
  }));
}

/**
 * Etiqueta escrita/elegida en la celda de origen → slug que guarda el servidor.
 * Primero las etiquetas conocidas (catálogo + facetas), si no, se normaliza.
 */
export function sourceSlugFromLabel(label: string | null, facets: Facet[] | undefined): string | null {
  if (!label) return null;
  const known = Object.entries(DATA_SOURCE_LABELS).find(([, l]) => l === label);
  if (known) return known[0];
  const fromFacet = (facets ?? []).find((f) => f.value !== 'none' && sourceLabel(f.value) === label);
  if (fromFacet) return fromFacet.value;
  return normalizeSource(label);
}

/** Opciones sugeridas para la celda de origen: catálogo + orígenes ya usados. */
export function sourceSuggestions(facets: Facet[] | undefined): string[] {
  const set = new Set<string>(Object.values(DATA_SOURCE_LABELS));
  for (const f of facets ?? []) if (f.value !== 'none') set.add(sourceLabel(f.value));
  return [...set];
}

export const DOMAIN_FACET_LABELS: Record<string, string> = { with: 'Con dominio', without: 'Sin dominio' };

/** Faceta binaria de dominio ('with' | 'without') → opciones legibles. */
export function domainFacetOptions(facets: Facet[] | undefined): FilterOption[] {
  return (facets ?? []).map((f) => ({ value: f.value, count: f.count, label: DOMAIN_FACET_LABELS[f.value] ?? f.value }));
}

// La faceta `contact` del servidor trae estas dos etiquetas como valores.
export const CONTACT_FACET_CONTACTED = 'Contactado';

/**
 * Filtro de contacto (multi-select de la faceta) → parámetro `contacted`. Elegir
 * ambas opciones o ninguna equivale a no filtrar.
 */
export function contactedParam(active: string[]): 'yes' | 'no' | undefined {
  if (active.length !== 1) return undefined;
  return active[0] === CONTACT_FACET_CONTACTED ? 'yes' : 'no';
}

export const TOUCH_KIND_LABELS: Record<NonNullable<Person['last_touch_kind']>, string> = {
  email: 'Correo',
  whatsapp: 'WhatsApp',
  call: 'Llamada',
};

/**
 * Texto de "Última interacción": canal + cuándo ("Correo · hace 3 días").
 * Sin interacción registrada → "Sin contacto".
 */
export function lastTouchText(
  p: Pick<Person, 'last_touch_at' | 'last_touch_kind'>,
  relative: (iso: string) => string,
): string {
  if (!p.last_touch_at) return 'Sin contacto';
  const when = relative(p.last_touch_at);
  const kind = p.last_touch_kind ? TOUCH_KIND_LABELS[p.last_touch_kind] : null;
  return kind ? `${kind} · ${when}` : when;
}

/** Industria efectiva de una persona: manda la de su empresa; la propia es respaldo. */
export function effectiveIndustry(p: Pick<Person, 'industry' | 'company'>): string | null {
  return p.company?.industry ?? p.industry ?? null;
}

/** href navegable para un dominio guardado como host ("acme.com" → "https://acme.com"). */
export function domainHref(domain: string): string {
  return /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
}

/** Texto plural en español para contadores: 1 persona / 3 personas. */
export function countLabel(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
