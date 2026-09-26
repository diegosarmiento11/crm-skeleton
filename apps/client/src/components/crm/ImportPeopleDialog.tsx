import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileUp, Loader2 } from 'lucide-react';
import { DATA_SOURCES, DATA_SOURCE_LABELS, type ImportPeopleResult } from '@crm/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useImportPeople } from '@/hooks/useCrm';
import { apiErrorMessage } from '@/lib/api';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// Origen por defecto del importador (el servidor usa el mismo si no se manda nada).
const DEFAULT_SOURCE = 'importacion';

/**
 * Importar personas desde un CSV. El servidor deduplica por correo (una persona
 * ya existente no se pisa) y enlaza las nuevas a su empresa por dominio; aquí
 * solo se elige el archivo y el origen, y se muestra el resumen al terminar.
 */
export function ImportPeopleDialog({ open, onOpenChange }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<string>(DEFAULT_SOURCE);
  const [result, setResult] = useState<ImportPeopleResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importPeople = useImportPeople();

  function reset() {
    setFile(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function close(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function submit() {
    if (!file) return;
    importPeople.mutate(
      { file, source },
      {
        onSuccess: (r) => {
          setResult(r);
          toast.success(`${r.created} persona${r.created === 1 ? '' : 's'} nueva${r.created === 1 ? '' : 's'}`);
        },
        onError: (e) => toast.error(`No se pudo importar: ${apiErrorMessage(e)}`),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar personas desde CSV</DialogTitle>
          <DialogDescription>
            Se deduplica por correo: si ya existe una persona con ese correo, la fila se salta y no se pisa lo que el equipo
            ya editó. Las filas sin correo no se importan.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <ImportSummary result={result} />
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="import-people-file">Archivo CSV</Label>
              <Input
                id="import-people-file"
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Columnas reconocidas (en inglés o español): <code className="rounded-md bg-muted px-1">name</code>/nombre o
                nombres + apellidos, <code className="rounded-md bg-muted px-1">email</code>/correo,{' '}
                <code className="rounded-md bg-muted px-1">phone</code>/teléfono y{' '}
                <code className="rounded-md bg-muted px-1">job_title</code>/cargo.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="import-people-source">Origen de las personas importadas</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="import-people-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {DATA_SOURCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <>
              <Button variant="ghost" onClick={reset}>
                Importar otro archivo
              </Button>
              <Button onClick={() => close(false)}>Listo</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => close(false)}>
                Cancelar
              </Button>
              <Button onClick={submit} disabled={!file || importPeople.isPending}>
                {importPeople.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                Importar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportSummary({ result }: { result: ImportPeopleResult }) {
  const cells: { label: string; value: number; hint: string }[] = [
    { label: 'Filas leídas', value: result.total, hint: 'Filas con nombre o correo en el archivo.' },
    { label: 'Creadas', value: result.created, hint: 'Personas nuevas en el CRM.' },
    { label: 'Saltadas', value: result.skipped, hint: 'Ya existían (mismo correo) o venían repetidas.' },
    { label: 'Enlazadas', value: result.linked, hint: 'Asociadas a su empresa por el dominio del correo.' },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2">
      {cells.map((c) => (
        <div key={c.label} className="rounded-xl border border-border bg-card p-3">
          <dt className="text-xs text-muted-foreground">{c.label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{c.value.toLocaleString('es-CO')}</dd>
          <dd className="mt-0.5 text-[11px] text-muted-foreground">{c.hint}</dd>
        </div>
      ))}
    </dl>
  );
}
