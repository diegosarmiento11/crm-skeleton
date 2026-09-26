import { Loader2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  count: number;
  /** Sustantivo en singular para el texto ("persona", "empresa"). */
  noun: string;
  onDelete: () => void;
  onClear: () => void;
  pending?: boolean;
}

// Barra flotante que aparece al seleccionar filas. En este CRM la única acción en
// lote es eliminar (no hay correo ni WhatsApp), así que va directa y no tras un menú.
export function SelectionBar({ count, noun, onDelete, onClear, pending }: Props) {
  if (count === 0) return null;
  const plural = count > 1 ? 's' : '';
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div
        role="toolbar"
        aria-label="Acciones sobre la selección"
        className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-lg"
      >
        <span className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm font-medium">
          {count} {noun}
          {plural} seleccionada{plural}
          <button
            type="button"
            onClick={onClear}
            className="rounded-md text-muted-foreground hover:text-foreground"
            aria-label="Quitar selección"
          >
            <X className="h-4 w-4" />
          </button>
        </span>
        <Button variant="outline" onClick={onDelete} disabled={pending} className="text-destructive hover:text-destructive">
          {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
          Eliminar
        </Button>
      </div>
    </div>
  );
}
