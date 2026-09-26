import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { SortableList } from '@/components/ui/sortable-list';

interface Props {
  values: string[];
  onChange: (values: string[]) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Editor de varios correos: arrastra para reordenar, copia al pasar el cursor, agrega o quita filas. */
export function EmailListInput({ values, onChange }: Props) {
  // Siempre hay al menos una fila visible para que el campo no parezca "cerrado".
  const rows = values.length ? values : [''];

  const setAt = (i: number, v: string) => onChange(rows.map((r, idx) => (idx === i ? v : r)));
  const removeAt = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const move = (from: number, to: number) => {
    const next = [...rows];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      <SortableList
        count={rows.length}
        onMove={move}
        renderRow={(i, handle) => {
          const v = rows[i] ?? '';
          const invalid = v.trim() !== '' && !EMAIL_RE.test(v.trim());
          return (
            <div className="group flex items-center gap-1.5 py-0.5">
              {handle}
              <Input
                type="email"
                value={v}
                placeholder="correo@empresa.com"
                aria-label={`Correo ${i + 1}`}
                onChange={(e) => setAt(i, e.target.value)}
                className="h-8"
                aria-invalid={invalid}
              />
              {v.trim() && !invalid ? (
                <CopyButton value={v.trim()} className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" />
              ) : (
                <span className="w-3.5" />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-7 shrink-0 text-muted-foreground"
                onClick={() => removeAt(i)}
                aria-label="Quitar correo"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        }}
      />
      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => onChange([...rows, ''])}>
        <Plus className="h-3.5 w-3.5" /> Agregar correo
      </Button>
    </div>
  );
}
