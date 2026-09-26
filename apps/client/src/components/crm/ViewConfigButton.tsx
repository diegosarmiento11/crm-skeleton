import type { ReactNode } from 'react';
import { Eye, EyeOff, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DataColumn } from './DataTable';
import type { TableConfig } from '@/hooks/useTableConfig';

interface Props<T> {
  config: TableConfig;
  columns: DataColumn<T>[];
  /** Trigger alterno (p. ej. el "+ Agregar columna" al final del encabezado). */
  trigger?: ReactNode;
}

// Botón "Vista" de la barra: visibilidad de columnas (el orden se cambia
// arrastrando los encabezados y los anchos con el borde de cada columna).
export function ViewConfigButton<T>({ config, columns, trigger }: Props<T>) {
  const colById = new Map(columns.map((c) => [c.id, c]));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" aria-label="Configurar columnas visibles">
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> Vista
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Columnas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {config.order.map((id) => {
          const col = colById.get(id);
          if (!col) return null;
          const Icon = col.icon;
          const isHidden = config.hidden.has(id);
          return (
            <DropdownMenuItem
              key={id}
              role="menuitemcheckbox"
              aria-checked={!isHidden}
              // No cerrar al elegir: se suelen mostrar/ocultar varias de una vez.
              onSelect={(e) => {
                e.preventDefault();
                config.toggleHidden(id);
              }}
              className="cursor-pointer gap-2"
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 truncate text-left">{col.label}</span>
              {isHidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
