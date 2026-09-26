// ─────────────────────────── Equipo y permisos ───────────────────────────
// La autorización es POR ÁREA, no por rango. Un rol tiene una lista de áreas y
// el servidor (`@RequireArea`) y el cliente (`<RequireArea>`, `config/nav.ts`)
// leen la MISMA matriz. Cambiar un permiso es cambiar `ROLE_AREAS`, nada más.

/** Secciones de la app. Cada endpoint y cada ruta declaran la suya. */
export const CRM_AREAS = ['crm', 'equipo'] as const;
export type CrmArea = (typeof CRM_AREAS)[number];

/**
 * Roles del equipo. PENDIENTE = cuenta auto-provisionada en el primer acceso, sin
 * áreas hasta que un GERENTE le asigne rol. Espejo del `enum TeamRole` de Prisma.
 */
export const TEAM_ROLES = ['GERENTE', 'COMERCIAL', 'PENDIENTE'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  GERENTE: 'Gerente',
  COMERCIAL: 'Comercial',
  PENDIENTE: 'Pendiente',
};

/** Única fuente de verdad de qué áreas alcanza cada rol. */
export const ROLE_AREAS: Record<TeamRole, readonly CrmArea[]> = {
  GERENTE: CRM_AREAS,
  // Comercial opera el CRM (pipeline, personas, empresas) pero no administra el equipo
  // ni ve la analítica de dirección (esa se restringe además con @RequireRole).
  COMERCIAL: ['crm'],
  PENDIENTE: [],
};

export function roleCanAccess(role: TeamRole, area: CrmArea): boolean {
  return ROLE_AREAS[role]?.includes(area) ?? false;
}

// ─────────────────────────────── Pipeline ───────────────────────────────

/**
 * Papel de una etapa dentro del embudo. Reemplaza el heurístico "adivinar por el
 * nombre" (`/gan|won/`, `/propuesta/`): la analítica, el SLA y el desempeño por
 * persona leen `kind`, así que renombrar una etapa no rompe ningún reporte.
 *
 *   OPEN      etapa abierta genérica (Nuevo, Negociación, En pausa…)
 *   QUALIFY   etapa de calificación/diagnóstico: entrar aquí cuenta como "prospectado"
 *   PROPOSAL  propuesta enviada/cotización: entrar aquí cuenta como "propuesta"
 *   WON       cerrado ganado (una sola, la que define el ciclo y el win-rate)
 *   LOST      cerrado perdido (captura `lost_reason`)
 *
 * QUALIFY y PROPOSAL son las etapas VIGILADAS por el SLA de seguimiento.
 * Espejo del `enum StageKind` de Prisma.
 */
export const STAGE_KINDS = ['OPEN', 'QUALIFY', 'PROPOSAL', 'WON', 'LOST'] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

export const STAGE_KIND_LABELS: Record<StageKind, string> = {
  OPEN: 'Abierta',
  QUALIFY: 'Calificación',
  PROPOSAL: 'Propuesta',
  WON: 'Ganado',
  LOST: 'Perdido',
};

/** Una etapa cerrada saca al lead del pipeline abierto (no tiene salud ni cuenta en forecast). */
export function isClosedKind(kind: StageKind): boolean {
  return kind === 'WON' || kind === 'LOST';
}

/** Colores de etapa disponibles en el gestor. El cliente mapea cada uno a clases Tailwind completas. */
export const STAGE_COLORS = ['slate', 'blue', 'green', 'amber', 'red', 'purple', 'teal'] as const;
export type StageColor = (typeof STAGE_COLORS)[number];

// ─────────────────────────────── Dinero ───────────────────────────────
// Un solo lugar para moneda y locale. `estimated_value` es un entero en la unidad
// mínima que use el negocio (pesos, no centavos, en el caso original).
export const CRM_CURRENCY = 'COP';
export const CRM_LOCALE = 'es-CO';

// ─────────────────────────── Listas sugeridas del lead ───────────────────────────
// Son SUGERENCIAS para los selects (permiten escribir un valor propio): los campos
// `target_service`, `sector` y `source` del lead son texto libre.

export const LEAD_SERVICES = ['Consultoría', 'Implementación', 'Soporte', 'Licencia'] as const;

export const LEAD_SECTORS = [
  'Construcción',
  'Manufactura',
  'Salud',
  'Retail',
  'Logística',
  'Servicios profesionales',
  'Educación',
  'Alimentos',
  'Tecnología',
  'Agro',
  'Turismo',
  'Financiero',
  'Inmobiliario',
  'Transporte',
  'Energía',
  'Otro',
] as const;

export const LEAD_SOURCES = ['Referido', 'Contenido', 'Outbound', 'Evento', 'Otro'] as const;

// Origen del dato (provenance) de una persona/empresa. Lista sugerida: `source` es
// texto libre y el servidor lo normaliza a slug (`normalizeSource`).
export const DATA_SOURCES = [
  'referido',
  'evento',
  'outbound',
  'contenido',
  'website',
  'importacion',
  'manual',
  'otro',
] as const;

export const DATA_SOURCE_LABELS: Record<string, string> = {
  referido: 'Referido',
  evento: 'Evento',
  outbound: 'Outbound',
  contenido: 'Contenido',
  website: 'Sitio web',
  importacion: 'Importación',
  manual: 'Manual',
  otro: 'Otro',
};

/** Etiqueta amigable de un origen (cae al valor crudo si es una fuente propia). */
export function sourceLabel(source: string | null | undefined): string {
  if (!source) return 'Sin origen';
  return DATA_SOURCE_LABELS[source] ?? source;
}

/** Normaliza un origen escrito a mano: minúsculas, espacios/guiones → guion bajo. */
export function normalizeSource(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return s || null;
}

// ─────────────────────────── Ubicación ───────────────────────────

/** Minúsculas sin tildes, espacios colapsados: para comparar ubicaciones. */
function foldLocation(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ciudades canónicas. La lista base está vacía a propósito: cada despliegue añade
 * las suyas (con tilde y mayúscula correctas) y `normalizeCity` colapsa las variantes
 * (BOGOTA / bogota / "Bogotá D.C." → "Bogotá") para que filtros e ICP no se fragmenten.
 */
export const KNOWN_CITIES: string[] = [];

/**
 * Normaliza una ciudad: si coincide (sin tildes ni mayúsculas) con una de
 * KNOWN_CITIES devuelve la forma canónica; si no, Title Case genérico. Prueba cada
 * segmento separado por coma porque la ciudad suele venir con departamento/país.
 */
export function normalizeCity(input: string | null | undefined): string | null {
  const raw = input?.trim().replace(/\s+/g, ' ');
  if (!raw) return null;
  for (const seg of raw.split(',')) {
    const key = foldLocation(seg.replace(/[.]/g, ' '));
    if (!key) continue;
    const match = KNOWN_CITIES.find((c) => foldLocation(c) === key);
    if (match) return match;
  }
  return raw
    .toLowerCase()
    .replace(/(^|[\s.\-(/])(\p{L})/gu, (_m, p: string, ch: string) => p + ch.toUpperCase());
}

// ─────────────────────────── Nombres de persona ───────────────────────────
// Conectores que en español van en minúscula dentro de un nombre (salvo que sean
// la primera palabra): "María de los Ángeles", "Juan de la Cruz".
const NAME_PARTICLES = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'y',
  'e',
  'da',
  'das',
  'do',
  'dos',
  'di',
  'van',
  'von',
  'der',
]);

/** Capitaliza cada segmento de una palabra (separados por - o apóstrofo): Jean-Paul, O'Brien. */
function capitalizeNameWord(w: string): string {
  return w.replace(/(^|[-'’])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * Formatea un nombre de persona a "Title Case" natural: "ALBERTO GALINDO" →
 * "Alberto Galindo". Los conectores quedan en minúscula salvo si abren el nombre.
 * NO inventa tildes (solo baja mayúsculas): "JOSÉ" → "José", "JOSE" → "Jose".
 * Idempotente: un nombre ya bien escrito no cambia.
 */
export function formatPersonName(input: string | null | undefined): string {
  const raw = input?.trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  return raw
    .toLowerCase()
    .split(' ')
    .map((word, i) => (i > 0 && NAME_PARTICLES.has(word) ? word : capitalizeNameWord(word)))
    .join(' ');
}

/** ¿El texto está en MAYÚSCULA sostenida? (tiene letras y ninguna minúscula). */
export function isAllCaps(input: string | null | undefined): boolean {
  if (!input) return false;
  return /\p{Lu}/u.test(input) && !/\p{Ll}/u.test(input);
}

// ─────────────────────────── Familias de cargo ───────────────────────────
// Los cargos son texto libre; para poder filtrarlos se agrupan en familias de rol.
// Se comparten con el servidor para que las facetas y el filtrado se calculen igual
// en ambos lados. El match es por substring sin tildes.
export const CARGO_GROUPS: { label: string; keywords: string[] }[] = [
  { label: 'Gerencia', keywords: ['gerent', 'gerenci', 'gte'] },
  { label: 'Dirección', keywords: ['director', 'direccion'] },
  { label: 'Presidencia', keywords: ['presiden'] },
  { label: 'Coordinación', keywords: ['coordina'] },
  { label: 'Jefatura', keywords: ['jefe', 'jefatura', 'head'] },
  { label: 'Liderazgo', keywords: ['lider', 'liderazgo', 'lead '] },
  { label: 'Supervisión', keywords: ['supervis'] },
  { label: 'Comercial / Ventas', keywords: ['comercial', 'ventas', 'vendedor', 'represent', 'sales'] },
  { label: 'Administración', keywords: ['administ'] },
  { label: 'Análisis', keywords: ['analist', 'analyst'] },
  { label: 'Asistencia / Auxiliar', keywords: ['asistent', 'auxiliar', 'secretari'] },
  {
    label: 'Propietario / Socio',
    keywords: ['propietari', 'dueno', 'socio', 'fundador', 'founder', 'owner'],
  },
  {
    label: 'Profesional / Técnico',
    keywords: ['profesional', 'ingenier', 'contador', 'abogad', 'arquitect', 'tecnic', 'especialista'],
  },
];

/** Etiquetas canónicas de familia de cargo (para el select de la celda). */
export const CARGO_FAMILIES = CARGO_GROUPS.map((g) => g.label);

/** Familia de rol de un cargo libre. '' → 'Sin cargo'; sin match → 'Otros'. */
export function cargoGroup(title: string | null | undefined): string {
  const t = (title ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
  if (!t) return 'Sin cargo';
  for (const g of CARGO_GROUPS) if (g.keywords.some((k) => t.includes(k))) return g.label;
  return 'Otros';
}

// ─────────────────── Dominios de correo públicos / gratuitos ───────────────────
// Dominios de proveedores personales. NUNCA se usan para auto-asociar una persona a
// una empresa por dominio de correo: si una empresa quedara guardada con
// `domain = hotmail.com`, todo correo @hotmail.com se ligaría a ella.
export const PUBLIC_EMAIL_DOMAINS = new Set<string>([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.es',
  'hotmail.co.uk',
  'hotmail.com.co',
  'hotmail.com.mx',
  'outlook.com',
  'outlook.es',
  'outlook.com.co',
  'live.com',
  'live.com.mx',
  'live.com.co',
  'msn.com',
  'yahoo.com',
  'yahoo.es',
  'yahoo.com.mx',
  'yahoo.com.co',
  'ymail.com',
  'rocketmail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'gmx.com',
  'gmx.es',
  'mail.com',
  'protonmail.com',
  'proton.me',
  'tutanota.com',
  'zoho.com',
  'yandex.com',
]);

/** ¿El host es un proveedor de correo público/gratuito? (host ya normalizado). */
export function isPublicEmailDomain(host: string | null | undefined): boolean {
  if (!host) return false;
  return PUBLIC_EMAIL_DOMAINS.has(host.trim().toLowerCase());
}

/** Dominio (host) de un correo: la parte después de "@", en minúscula. */
export function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const host = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  return host || null;
}

/**
 * Dominio corporativo de un correo, o `null` si es de webmail. Úsalo para enlazar
 * personas con empresas por dominio; NO para descartar el correo como contacto.
 */
export function corporateDomainFromEmail(email: string | null | undefined): string | null {
  const d = emailDomain(email);
  if (!d) return null;
  return isPublicEmailDomain(d) ? null : d;
}

/** Normaliza el `domain` de una empresa a solo host: quita protocolo, "www." y ruta. */
export function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  const host = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  return host || null;
}
