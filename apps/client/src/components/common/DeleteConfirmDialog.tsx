import { useState } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  /** The exact phrase the user must type, e.g. "eliminar-perfiles". */
  confirmPhrase: string;
  /** Overrides the default "Eliminar N registros" title (e.g. for a board). */
  title?: string;
  pending?: boolean;
  onConfirm: () => void;
}

// Destructive-action guard: requires typing an exact phrase before deleting.
export function DeleteConfirmDialog({ open, onOpenChange, count, confirmPhrase, title, pending, onConfirm }: Props) {
  const [text, setText] = useState('');
  const ok = text.trim() === confirmPhrase;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setText('');
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="h-5 w-5" /> {title ?? `Eliminar ${count} registro${count > 1 ? 's' : ''}`}
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. Para confirmar, escribe{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">{confirmPhrase}</code>.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={confirmPhrase}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && ok && onConfirm()}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={!ok || pending} onClick={onConfirm}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
