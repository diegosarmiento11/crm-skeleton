import type { LucideIcon } from 'lucide-react';

/**
 * Opción de un filtro por faceta. `value` es lo que viaja al servidor; `label`
 * (opcional) es lo que se muestra cuando el valor crudo no es legible
 * ('none' → "Sin origen", 'with' → "Con dominio").
 */
export interface FilterOption {
  value: string;
  count: number;
  label?: string;
}

export function optionLabel(o: FilterOption): string {
  return o.label ?? o.value;
}

/** Una dimensión de filtro: la misma forma que consumen ColumnFilter (desktop) y
 *  MobileFiltersSheet (móvil), para declararla UNA vez por página. */
export interface FilterDim {
  id: string;
  label: string;
  icon: LucideIcon;
  options: FilterOption[];
  active: string[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
  wide?: boolean;
}
