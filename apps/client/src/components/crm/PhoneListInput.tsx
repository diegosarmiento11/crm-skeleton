import { useEffect, useRef, useState } from 'react';
import type { CountryCode } from 'libphonenumber-js';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { SortableList } from '@/components/ui/sortable-list';
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY, buildE164, isValidE164, parsePhone } from '@/lib/phone';

interface Row {
  country: CountryCode;
  national: string;
}
interface Props {
  /** Teléfonos en E.164 (lo que guarda el servidor). */
  values: string[];
  onChange: (values: string[]) => void;
}

const seed = (values: string[]): Row[] => (values.length ? values.map(parsePhone) : [{ country: DEFAULT_COUNTRY, national: '' }]);
const emitOf = (rows: Row[]): string[] => rows.map((r) => buildE164(r.country, r.national)).filter(Boolean);
const sameArr = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Editor de varios teléfonos: país + dígitos nacionales → E.164, arrastre para
 * reordenar, copia al pasar el cursor y validez por fila. Mantiene su propio estado
 * (país/nacional separados) y emite E.164 hacia arriba; se re-siembra solo cuando el
 * valor del formulario cambia desde fuera (p. ej. un reset), no por su propio eco.
 */
export function PhoneListInput({ values, onChange }: Props) {
  const [rows, setRows] = useState<Row[]>(() => seed(values));
  const lastEmitted = useRef<string[]>(emitOf(seed(values)));

  useEffect(() => {
    if (sameArr(values, lastEmitted.current)) return;
    const next = seed(values);
    setRows(next);
    lastEmitted.current = emitOf(next);
  }, [values]);

  function update(next: Row[]) {
    setRows(next);
    const e164 = emitOf(next);
    lastEmitted.current = e164;
    onChange(e164);
  }

  const setRow = (i: number, patch: Partial<Row>) => update(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeAt = (i: number) => update(rows.filter((_, idx) => idx !== i));
  const move = (from: number, to: number) => {
    const next = [...rows];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    update(next);
  };

  return (
    <div className="space-y-1.5">
      <SortableList
        count={rows.length}
        onMove={move}
        renderRow={(i, handle) => {
          const r = rows[i];
          const e164 = buildE164(r.country, r.national);
          const invalid = r.national.trim() !== '' && !isValidE164(e164);
          return (
            <div>
              <div className="group flex items-center gap-1.5 py-0.5">
                {handle}
                {/* Select nativo: con 200+ países es más ligero que un menú Radix y funciona con teclado. */}
                <select
                  value={r.country}
                  onChange={(e) => setRow(i, { country: e.target.value as CountryCode })}
                  className="h-8 shrink-0 rounded-md border border-input bg-background px-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="País"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} +{c.dial}
                    </option>
                  ))}
                </select>
                <Input
                  inputMode="numeric"
                  value={r.national}
                  placeholder="300 123 4567"
                  aria-label={`Teléfono ${i + 1}`}
                  onChange={(e) => setRow(i, { national: e.target.value.replace(/[^\d]/g, '') })}
                  className="h-8"
                  aria-invalid={invalid}
                />
                {!invalid && e164 ? (
                  <CopyButton value={e164} className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" />
                ) : (
                  <span className="w-3.5" />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-7 shrink-0 text-muted-foreground"
                  onClick={() => removeAt(i)}
                  aria-label="Quitar teléfono"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              {invalid ? <p className="pl-6 text-xs text-destructive">Número inválido para {r.country}</p> : null}
            </div>
          );
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-muted-foreground"
        onClick={() => update([...rows, { country: DEFAULT_COUNTRY, national: '' }])}
      >
        <Plus className="h-3.5 w-3.5" /> Agregar teléfono
      </Button>
    </div>
  );
}
