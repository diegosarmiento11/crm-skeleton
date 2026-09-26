import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { XCircle } from 'lucide-react';
import { LOST_REASONS } from '@crm/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PillSelect } from '@/components/common/PillSelect';
import { useUpdateLead } from '@/hooks/useCrm';
import { apiErrorMessage } from '@/lib/api';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: { id: string; company: string } | null;
}

/**
 * Se abre al mover un lead a la etapa LOST: captura POR QUÉ se perdió, con
 * selección única entre las razones canónicas (alimentan el reporte de pérdidas
 * del embudo). "Omitir" deja `lost_reason` sin poner.
 */
export function LostReasonDialog({ open, onOpenChange, lead }: Props) {
  const update = useUpdateLead();
  const [reason, setReason] = useState<string>(LOST_REASONS[0]);

  // Se reinicia la razón en cada apertura para no arrastrar la del lead anterior.
  useEffect(() => {
    if (open) setReason(LOST_REASONS[0]);
  }, [open]);

  async function save() {
    if (!lead) return;
    try {
      await update.mutateAsync({ id: lead.id, data: { lost_reason: reason } });
      onOpenChange(false);
    } catch (err) {
      toast.error(`No se pudo guardar la razón: ${apiErrorMessage(err)}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" /> ¿Por qué se perdió?
          </DialogTitle>
          <DialogDescription>
            {lead?.company} pasó a perdido. La razón alimenta el reporte de pérdidas del embudo.
          </DialogDescription>
        </DialogHeader>
        <PillSelect
          value={reason}
          onChange={setReason}
          options={LOST_REASONS.map((r) => ({ value: r, label: r }))}
          searchable={false}
          className="w-full justify-between"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Omitir
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
