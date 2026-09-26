import { useState, type MouseEvent } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/** Click-to-copy icon button. Shows a brief check on success. */
export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard may be unavailable (insecure context); silently ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="Copiar"
      title="Copiar"
      className={cn('text-muted-foreground transition-colors hover:text-foreground', className)}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** Text that copies itself to the clipboard on click (with a toast). */
export function CopyText({
  value,
  display,
  className,
}: {
  value: string;
  /** What to render; defaults to `value`. (Lets you show a formatted phone but copy E.164.) */
  display?: string;
  className?: string;
}) {
  async function onCopy(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copiado');
    } catch {
      // Clipboard unavailable; ignore.
    }
  }
  return (
    <button type="button" onClick={onCopy} title="Click para copiar" className={cn('hover:underline', className)}>
      {display ?? value}
    </button>
  );
}
