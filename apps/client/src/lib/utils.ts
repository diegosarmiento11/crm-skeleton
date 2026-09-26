import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Fecha relativa en español, cubriendo todo el rango:
 * "ahora" · "hace 5 min" · "hace 2 h" · "ayer" · "hace 3 días" ·
 * "hace 2 sem" · "hace 4 meses" · "hace 2 años". Fechas futuras → "próximamente".
 */
export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs)) return '';
  if (diffMs < 0) return 'próximamente';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? 'hace 1 mes' : `hace ${months} meses`;
  const years = Math.floor(days / 365);
  return years <= 1 ? 'hace 1 año' : `hace ${years} años`;
}

export function shortenUrl(url: string, max = 42): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}

/** Saludo según la hora local: "Buenos días" · "Buenas tardes" · "Buenas noches". */
export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Primer nombre de un display name; "crack" como fallback amistoso. */
export function firstName(name?: string | null): string {
  return name?.trim().split(/\s+/)[0] || 'crack';
}
