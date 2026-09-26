import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, CheckSquare, Loader2, Plus, Trash2, Users } from 'lucide-react';
import type { CrmTask } from '@crm/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/common/DatePicker';
import { MultiPillSelect } from '@/components/common/MultiPillSelect';
import { MemberAvatar } from '@/components/team/MemberAvatar';
import { useConfirm } from '@/components/ConfirmDialog';
import type { CrmEntity } from '@/hooks/useCrm';
import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from '@/hooks/useComments';
import { apiErrorMessage } from '@/lib/api';
import { formatDueLabel, isOverdue, parseDateInput } from '@/lib/dates';
import { resolveMemberName, useMembers } from '@/lib/members';
import { cn } from '@/lib/utils';
import { sortTasks } from './activityLogic';

interface Props {
  entityType: CrmEntity;
  entityId: string;
}

/** Tareas de seguimiento del registro: crear con fecha y responsables, marcar hecha, borrar. */
export function ActivityTasks({ entityType, entityId }: Props) {
  const ref = useMemo(() => ({ entity_type: entityType, entity_id: entityId }), [entityType, entityId]);
  const { data, isLoading } = useTasks(ref);
  const { activeMembers } = useMembers();
  const create = useCreateTask();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const confirm = useConfirm();

  const [title, setTitle] = useState('');
  const [due, setDue] = useState<string | null>(null); // YYYY-MM-DD
  const [assignees, setAssignees] = useState<string[]>([]);
  const [showDone, setShowDone] = useState(false);

  const tasks = useMemo(() => sortTasks(data?.items ?? []), [data]);
  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const memberOptions = useMemo(() => activeMembers.map((m) => ({ value: m.id, label: m.name })), [activeMembers]);

  async function add() {
    const t = title.trim();
    if (!t || create.isPending) return;
    try {
      await create.mutateAsync({
        entity_type: entityType,
        entity_id: entityId,
        title: t,
        // Medianoche local del día elegido (convención de lib/dates para vencimientos).
        due_date: due ? parseDateInput(due).toISOString() : undefined,
        // Sin responsables en un lead, el servidor pone al responsable del lead.
        assignees: assignees.length ? assignees : undefined,
      });
      setTitle('');
      setDue(null);
      setAssignees([]);
    } catch (err) {
      toast.error(`No se pudo crear la tarea: ${apiErrorMessage(err)}`);
    }
  }

  async function toggle(task: CrmTask) {
    try {
      await update.mutateAsync({ id: task.id, data: { done: !task.done } });
    } catch (err) {
      toast.error(`No se pudo actualizar la tarea: ${apiErrorMessage(err)}`);
    }
  }

  async function remove(task: CrmTask) {
    const ok = await confirm({
      title: 'Borrar esta tarea',
      description: `"${task.title}" se eliminará del registro. Esta acción no se puede deshacer.`,
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(task.id);
    } catch (err) {
      toast.error(`No se pudo borrar la tarea: ${apiErrorMessage(err)}`);
    }
  }

  return (
    <section aria-labelledby="activity-tasks-title" className="space-y-3">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-muted-foreground" />
        <h3 id="activity-tasks-title" className="text-sm font-medium">
          Tareas
        </h3>
        {pending.length > 0 ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {pending.length} pendiente{pending.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      <div className="space-y-2 rounded-xl border border-border p-3">
        <div className="flex items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add();
            }}
            placeholder="Nueva tarea, p. ej. enviar propuesta"
            aria-label="Título de la tarea"
            className="h-9"
          />
          <Button type="button" size="sm" className="h-9 shrink-0" onClick={add} disabled={!title.trim() || create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Añadir
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker value={due} onChange={setDue} clearable placeholder="Fecha límite" className="h-9 w-auto rounded-full text-xs" />
          <MultiPillSelect
            values={assignees}
            onChange={setAssignees}
            options={memberOptions}
            icon={Users}
            allLabel={entityType === 'lead' ? 'Responsable del lead' : 'Sin responsable'}
            searchPlaceholder="Buscar miembro…"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando tareas…
        </div>
      ) : tasks.length === 0 ? (
        <p className="py-1 text-xs text-muted-foreground">Sin tareas. Crea una con fecha para no perder el seguimiento.</p>
      ) : (
        <ul className="space-y-1.5">
          {pending.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={() => toggle(t)} onDelete={() => remove(t)} />
          ))}
          {done.length > 0 ? (
            <li>
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                aria-expanded={showDone}
              >
                {showDone ? 'Ocultar' : 'Mostrar'} {done.length} hecha{done.length === 1 ? '' : 's'}
              </button>
            </li>
          ) : null}
          {showDone ? done.map((t) => <TaskRow key={t.id} task={t} onToggle={() => toggle(t)} onDelete={() => remove(t)} />) : null}
        </ul>
      )}
    </section>
  );
}

function TaskRow({ task, onToggle, onDelete }: { task: CrmTask; onToggle: () => void; onDelete: () => void }) {
  const overdue = !task.done && task.due_date ? isOverdue(task.due_date) : false;
  return (
    <li className="group flex items-start gap-2.5 rounded-xl border border-border p-2.5">
      <Checkbox
        checked={task.done}
        onCheckedChange={onToggle}
        aria-label={task.done ? `Reabrir "${task.title}"` : `Marcar "${task.title}" como hecha`}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm leading-snug', task.done && 'text-muted-foreground line-through')}>{task.title}</p>
        {task.due_date || task.assignees.length > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {task.due_date ? (
              <span className={cn('inline-flex items-center gap-1 tabular-nums', overdue && 'font-medium text-destructive')}>
                <CalendarClock className="h-3 w-3" />
                {formatDueLabel(task.due_date)}
                {overdue ? ' · vencida' : ''}
              </span>
            ) : null}
            {task.assignees.length > 0 ? (
              <span className="inline-flex items-center gap-1">
                {task.assignees.map((a) => (
                  <MemberAvatar key={a} name={resolveMemberName(a)} seed={a} size="sm" />
                ))}
                <span className="truncate">{task.assignees.map((a) => resolveMemberName(a).split(' ')[0]).join(', ')}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        aria-label={`Borrar tarea "${task.title}"`}
        className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}
