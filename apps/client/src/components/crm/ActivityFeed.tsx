import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { toast } from 'sonner';
import { CornerDownRight, Loader2, Mail, MessageCircle, MessageSquare, Pencil, Phone, Send, Trash2 } from 'lucide-react';
import type { CrmNote, CrmNoteKindType } from '@crm/shared';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useConfirm } from '@/components/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import type { CrmEntity } from '@/hooks/useCrm';
import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from '@/hooks/useComments';
import { apiErrorMessage } from '@/lib/api';
import { resolveMemberName } from '@/lib/members';
import { cn, formatRelativeDate } from '@/lib/utils';
import { ActivityMentionTextarea } from './ActivityMentionTextarea';
import { ActivityTasks } from './ActivityTasks';
import { groupNotes, isOwnNote, splitMentions, type NoteThread } from './activityLogic';

type IconType = ComponentType<{ className?: string }>;

// Tipos de entrada. Los puntos de contacto (correo, WhatsApp, llamada) son los que
// el servidor cuenta como "actividad" para la salud del lead y como "contactado"
// para una persona; un comentario libre es interno y NO mueve la salud. Por eso el
// selector los separa y el placeholder pide un resumen de la interacción.
const KINDS: { kind: CrmNoteKindType; label: string; icon: IconType; placeholder: string }[] = [
  { kind: 'comment', label: 'Comentario', icon: MessageSquare, placeholder: 'Escribe un comentario interno. Usa @ para mencionar a alguien.' },
  { kind: 'email', label: 'Correo', icon: Mail, placeholder: 'Resumen del correo enviado o recibido.' },
  { kind: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, placeholder: 'Resumen de la conversación por WhatsApp.' },
  { kind: 'call', label: 'Llamada', icon: Phone, placeholder: 'Resumen de la llamada y próximos pasos.' },
];
const KIND_META = new Map(KINDS.map((k) => [k.kind, k]));

const EMPTY_HINT: Record<CrmEntity, string> = {
  lead: 'Sin actividad todavía. Registra un correo, un WhatsApp o una llamada: es lo que cuenta para la salud del lead.',
  person: 'Sin actividad todavía. Registra el primer punto de contacto para marcar a esta persona como contactada.',
  company: 'Sin actividad todavía. Registra el primer punto de contacto o deja un comentario para el equipo.',
};

interface Props {
  entityType: CrmEntity;
  entityId: string;
  /** Oculta la sección de tareas (por defecto se muestra). */
  showTasks?: boolean;
}

/**
 * Actividad de un registro: compositor (comentario o punto de contacto), historial
 * en hilos de un nivel (más nuevas arriba) y tareas de seguimiento.
 */
export function ActivityFeed({ entityType, entityId, showTasks = true }: Props) {
  const ref = useMemo(() => ({ entity_type: entityType, entity_id: entityId }), [entityType, entityId]);
  const { data, isLoading } = useNotes(ref);
  const create = useCreateNote();
  const { me } = useAuth();

  const [kind, setKind] = useState<CrmNoteKindType>('comment');
  const [body, setBody] = useState('');

  const threads = useMemo(() => groupNotes(data?.items ?? []), [data]);

  async function submit() {
    const text = body.trim();
    if (!text || create.isPending) return;
    try {
      await create.mutateAsync({ entity_type: entityType, entity_id: entityId, kind, body: text });
      setBody('');
      setKind('comment');
    } catch (err) {
      toast.error(`No se pudo registrar: ${apiErrorMessage(err)}`);
    }
  }

  async function reply(rootId: string, text: string) {
    // Un solo nivel de hilo: toda respuesta cuelga de la nota raíz.
    await create.mutateAsync({ entity_type: entityType, entity_id: entityId, kind: 'comment', body: text, parent_id: rootId });
  }

  const meta = KIND_META.get(kind) ?? KINDS[0];

  return (
    <div className="space-y-5">
      <div className="space-y-2 rounded-xl border border-border p-3">
        <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Tipo de entrada">
          {KINDS.map((k) => {
            const Icon = k.icon;
            const on = kind === k.kind;
            return (
              <button
                key={k.kind}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setKind(k.kind)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {k.label}
              </button>
            );
          })}
        </div>
        <ActivityMentionTextarea
          value={body}
          onChange={setBody}
          onSubmit={submit}
          placeholder={meta.placeholder}
          aria-label="Nueva entrada de actividad"
          minRows={3}
          className="text-sm"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">Cmd/Ctrl + Enter para registrar</span>
          <Button size="sm" onClick={submit} disabled={create.isPending || !body.trim()}>
            {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Registrar
          </Button>
        </div>
      </div>

      <section aria-label="Historial de actividad">
        {isLoading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando actividad…
          </div>
        ) : threads.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">{EMPTY_HINT[entityType]}</p>
        ) : (
          <ul className="space-y-4">
            {threads.map((t) => (
              <ThreadItem key={t.root.id} thread={t} myEmail={me?.email} onReply={(text) => reply(t.root.id, text)} />
            ))}
          </ul>
        )}
      </section>

      {showTasks ? (
        <>
          <Separator />
          <ActivityTasks entityType={entityType} entityId={entityId} />
        </>
      ) : null}
    </div>
  );
}

// ─────────────────────────── Hilos ───────────────────────────

function ThreadItem({ thread, myEmail, onReply }: { thread: NoteThread; myEmail: string | null | undefined; onReply: (text: string) => Promise<unknown> }) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const meta = KIND_META.get(thread.root.kind) ?? KINDS[0];
  const Icon = meta.icon;

  async function send() {
    const t = text.trim();
    if (!t || pending) return;
    setPending(true);
    try {
      await onReply(t);
      setText('');
      setReplying(false);
    } catch (err) {
      toast.error(`No se pudo responder: ${apiErrorMessage(err)}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="flex gap-2.5">
      <span
        className={cn(
          'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          thread.root.kind === 'comment' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
        )}
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <NoteBody note={thread.root} kindLabel={meta.label} own={isOwnNote(thread.root, myEmail)} />

        {thread.replies.length > 0 ? (
          <ul className="mt-2 space-y-2 border-l-2 border-border pl-3">
            {thread.replies.map((r) => (
              <li key={r.id}>
                <NoteBody note={r} own={isOwnNote(r, myEmail)} compact />
              </li>
            ))}
          </ul>
        ) : null}

        {replying ? (
          <div className="mt-2 space-y-1.5">
            <ActivityMentionTextarea
              value={text}
              onChange={setText}
              onSubmit={send}
              minRows={2}
              autoFocus
              placeholder="Responder en el hilo. Usa @ para mencionar."
              aria-label="Respuesta"
              className="text-sm"
            />
            <div className="flex justify-end gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => { setReplying(false); setText(''); }}>
                Cancelar
              </Button>
              <Button size="sm" onClick={send} disabled={pending || !text.trim()}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CornerDownRight className="h-3.5 w-3.5" />}
                Responder
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setReplying(true)}
            className="mt-1.5 inline-flex items-center gap-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            <CornerDownRight className="h-3 w-3" /> Responder
          </button>
        )}
      </div>
    </li>
  );
}

/** Una nota (raíz o respuesta): autor, fecha, cuerpo con menciones, y editar/borrar si es propia. */
function NoteBody({ note, kindLabel, own, compact = false }: { note: CrmNote; kindLabel?: string; own: boolean; compact?: boolean }) {
  const update = useUpdateNote();
  const del = useDeleteNote();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);

  const author = note.author_id ? resolveMemberName(note.author_id) : (note.author ?? 'Alguien');
  const when = new Date(note.created_at);

  async function save() {
    const t = draft.trim();
    if (!t || update.isPending) return;
    try {
      await update.mutateAsync({ id: note.id, data: { body: t } });
      setEditing(false);
    } catch (err) {
      toast.error(`No se pudo editar: ${apiErrorMessage(err)}`);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: 'Borrar esta entrada',
      description: 'Se eliminará del historial junto con sus respuestas. Esta acción no se puede deshacer.',
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(note.id);
    } catch (err) {
      toast.error(`No se pudo borrar: ${apiErrorMessage(err)}`);
    }
  }

  return (
    <div className="group">
      <div className="flex items-center gap-1.5">
        {kindLabel ? <span className="text-xs font-medium">{kindLabel}</span> : null}
        <span className={cn('truncate text-muted-foreground', compact ? 'text-xs font-medium text-foreground' : 'text-[11px]')}>
          {kindLabel ? `· ${author}` : author}
        </span>
        <time dateTime={note.created_at} title={when.toLocaleString('es-CO')} className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {formatRelativeDate(note.created_at)}
        </time>
        {own && !editing ? (
          <span className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              aria-label="Editar entrada"
              onClick={() => {
                setDraft(note.body);
                setEditing(true);
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" aria-label="Borrar entrada" onClick={remove}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </span>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-1 space-y-1.5">
          <ActivityMentionTextarea value={draft} onChange={setDraft} onSubmit={save} minRows={2} autoFocus aria-label="Editar entrada" className="text-sm" />
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={update.isPending || !draft.trim()}>
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        <p className={cn('whitespace-pre-wrap break-words leading-relaxed', compact ? 'text-[13px]' : 'text-sm')}>{renderMentions(note.body)}</p>
      )}
    </div>
  );
}

/** Pinta el cuerpo reemplazando los tokens `@[correo]` por el nombre del miembro. */
function renderMentions(body: string): ReactNode {
  return splitMentions(body).map((seg, i) =>
    seg.type === 'text' ? (
      <span key={i}>{seg.value}</span>
    ) : (
      <span key={i} className="rounded-md bg-primary/10 px-1 font-medium text-primary">
        @{resolveMemberName(seg.id)}
      </span>
    ),
  );
}
