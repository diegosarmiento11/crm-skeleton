import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  STAGE_COLORS,
  STAGE_KINDS,
  STAGE_KIND_LABELS,
  type PipelineStage,
  type StageColor,
  type StageKind,
} from '@crm/shared';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { stageColor } from '@/lib/crm';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { useConfirm } from '@/components/ConfirmDialog';
import { useCreateStage, useDeleteStage, useReorderStages, useStages, useUpdateStage } from '@/hooks/useCrm';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// Nombre en español de cada color del gestor (la clase visual sale de stageColor()).
const COLOR_LABELS: Record<StageColor, string> = {
  slate: 'Gris',
  blue: 'Azul',
  green: 'Verde',
  amber: 'Ámbar',
  red: 'Rojo',
  purple: 'Morado',
  teal: 'Turquesa',
};

/**
 * Gestor de columnas del pipeline. Solo GERENTE crea, edita, reordena o borra;
 * cualquier otro rol ve la lista en solo lectura. El servidor responde 409 si se
 * repite un tipo único (WON/LOST/QUALIFY/PROPOSAL) o si la etapa aún tiene leads:
 * ese mensaje se muestra tal cual.
 */
export function StagesManagerDialog({ open, onOpenChange }: Props) {
  const { hasRole } = useAuth();
  const canManage = hasRole('GERENTE');
  const { data } = useStages();
  const stages = [...(data?.items ?? [])].sort((a, b) => a.position - b.position);
  const create = useCreateStage();
  const update = useUpdateStage();
  const reorder = useReorderStages();
  const del = useDeleteStage();
  const confirm = useConfirm();
  const [newName, setNewName] = useState('');

  const fail = (prefix: string) => (err: unknown) => toast.error(`${prefix}: ${apiErrorMessage(err)}`);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    try {
      await create.mutateAsync({ name, color: 'slate', kind: 'OPEN' });
      setNewName('');
    } catch (err) {
      fail('No se pudo crear la etapa')(err);
    }
  }

  function rename(stage: PipelineStage, raw: string) {
    const name = raw.trim();
    if (name && name !== stage.name) {
      update.mutate({ id: stage.id, data: { name } }, { onError: fail('No se pudo renombrar') });
    }
  }

  function swap(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= stages.length) return;
    const a = stages[idx];
    const b = stages[target];
    reorder.mutate(
      { items: [{ id: a.id, position: b.position }, { id: b.id, position: a.position }] },
      { onError: fail('No se pudo reordenar') },
    );
  }

  async function remove(stage: PipelineStage) {
    const ok = await confirm({
      title: `¿Borrar la etapa "${stage.name}"?`,
      description: 'Solo se puede borrar una etapa sin leads. Esta acción no se puede deshacer.',
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (!ok) return;
    del.mutate(stage.id, { onError: fail('No se pudo borrar la etapa') });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{canManage ? 'Gestionar etapas' : 'Etapas del pipeline'}</DialogTitle>
          <DialogDescription>
            {canManage
              ? 'Agrega, renombra, colorea y reordena las columnas del pipeline. Solo puede haber una etapa de tipo Ganado, una Perdido, una Calificación y una Propuesta.'
              : 'Solo un gerente puede modificar las etapas.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {stages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center gap-1.5">
              <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', stageColor(stage.color).dot)} aria-hidden />
              {canManage ? (
                <>
                  <Input
                    // Sin controlar a propósito: se guarda al perder el foco, no en cada tecla.
                    key={stage.name}
                    defaultValue={stage.name}
                    aria-label={`Nombre de la etapa ${stage.name}`}
                    onBlur={(e) => rename(stage, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    className="h-8 min-w-0 flex-1"
                  />
                  <Select
                    value={stage.color}
                    onValueChange={(color) =>
                      update.mutate({ id: stage.id, data: { color: color as StageColor } }, { onError: fail('No se pudo cambiar el color') })
                    }
                  >
                    <SelectTrigger className="h-8 w-28" aria-label="Color">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_COLORS.map((c) => (
                        <SelectItem key={c} value={c}>
                          <span className="flex items-center gap-2">
                            <span className={cn('h-2.5 w-2.5 rounded-full', stageColor(c).dot)} />
                            {COLOR_LABELS[c]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={stage.kind}
                    onValueChange={(kind) =>
                      update.mutate({ id: stage.id, data: { kind: kind as StageKind } }, { onError: fail('No se pudo cambiar el tipo') })
                    }
                  >
                    <SelectTrigger className="h-8 w-32" aria-label="Tipo de etapa">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {STAGE_KIND_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-7" onClick={() => swap(idx, -1)} disabled={idx === 0} aria-label="Subir">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-7"
                    onClick={() => swap(idx, 1)}
                    disabled={idx === stages.length - 1}
                    aria-label="Bajar"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-7 text-destructive" onClick={() => remove(stage)} aria-label="Borrar">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm">{stage.name}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{STAGE_KIND_LABELS[stage.kind]}</span>
                </>
              )}
            </div>
          ))}
          {stages.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay etapas.</p> : null}
        </div>

        {canManage ? (
          <div className="flex items-center gap-2 border-t border-border pt-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Nueva etapa…"
              aria-label="Nombre de la nueva etapa"
              className="h-8"
            />
            <Button type="button" size="sm" onClick={add} disabled={!newName.trim() || create.isPending}>
              <Plus className="h-3.5 w-3.5" /> Agregar
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
