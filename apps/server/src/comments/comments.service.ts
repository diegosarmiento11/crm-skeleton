import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  extractMentionIds,
  type CreateCrmNoteInput,
  type UpdateCrmNoteInput,
  type CreateCrmTaskInput,
  type UpdateCrmTaskInput,
} from '@crm/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CrmPortService } from '../crm/crm.port';
import { NOTIFIER, type NotifierPort } from '../jobs/notifier.port';
import { Inject } from '@nestjs/common';

type Entity = { entity_type: string; entity_id: string };
type Actor = { email: string; name: string };

/**
 * Motor genérico de notas (comentarios y puntos de contacto) y tareas de
 * seguimiento sobre una entidad (entity_type/entity_id). No sabe nada del CRM en
 * particular: lo consume `crm/engagement.controller.ts` y podría consumirlo
 * cualquier otro módulo con sus propias entidades.
 *
 * Al CRM le llega por su puerto (`CrmPortService`) solo para dos cosas: la
 * etiqueta del registro (para notificaciones y bandejas) y el responsable del
 * lead (para asignar tareas por defecto).
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crmPort: CrmPortService,
    @Inject(NOTIFIER) private readonly notifier: NotifierPort,
  ) {}

  // ─────────────────────────── Notas ───────────────────────────

  listNotes(e: Entity) {
    return this.prisma.crmNote
      .findMany({ where: e, orderBy: { created_at: 'desc' } })
      .then((items) => ({ items }));
  }

  async createNote(data: CreateCrmNoteInput, actor?: Actor) {
    // Una respuesta solo cuelga de un hilo RAÍZ de la MISMA entidad: sin esto, un
    // parent_id ajeno notificaría a los participantes de otro registro y dejaría
    // la nota huérfana en la línea de tiempo.
    if (data.parent_id) {
      const parent = await this.prisma.crmNote.findFirst({
        where: {
          id: data.parent_id,
          entity_type: data.entity_type,
          entity_id: data.entity_id,
          parent_id: null,
        },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('El hilo no pertenece a esta entidad');
    }
    const note = await this.prisma.crmNote.create({
      data: {
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        kind: data.kind ?? 'comment',
        body: data.body,
        author: data.author ?? actor?.name ?? null,
        author_id: actor?.email.toLowerCase() ?? null,
        parent_id: data.parent_id ?? null,
      },
    });

    // Notificar es best-effort: nunca bloquea ni deshace el comentario.
    if (actor) {
      try {
        await this.fanoutNotifications(note, data, actor);
      } catch {
        /* la notificación falló; la nota ya quedó guardada */
      }
    }
    return note;
  }

  /**
   * Dos audiencias para un comentario nuevo:
   *  - los @mencionados explícitamente → 'mention' (en cualquier comentario);
   *  - en una respuesta, los demás participantes del hilo (autor raíz, quienes ya
   *    respondieron y quienes fueron mencionados antes) → 'reply', para que nadie
   *    tenga que volver a etiquetar a nadie.
   */
  private async fanoutNotifications(
    note: { id: string; parent_id: string | null },
    data: CreateCrmNoteInput,
    actor: Actor,
  ) {
    const actorEmail = actor.email.toLowerCase();
    const mentioned = new Set(extractMentionIds(data.body).map((id) => id.toLowerCase()));

    const participants = new Set<string>();
    if (data.parent_id) {
      const rootId = data.parent_id; // un solo nivel: el padre es la raíz
      const thread = await this.prisma.crmNote.findMany({
        where: { OR: [{ id: rootId }, { parent_id: rootId }] },
        select: { author_id: true, body: true },
      });
      for (const t of thread) {
        if (t.author_id) participants.add(t.author_id.toLowerCase());
        for (const id of extractMentionIds(t.body)) participants.add(id.toLowerCase());
      }
    }
    for (const id of mentioned) participants.delete(id); // mención gana sobre respuesta
    participants.delete(actorEmail);
    mentioned.delete(actorEmail);

    if (mentioned.size === 0 && participants.size === 0) return;
    const labels = await this.crmPort.labelsFor([data]);
    const entityLabel = labels.get(`${data.entity_type}:${data.entity_id}`) ?? null;
    const base = {
      actor,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      entity_label: entityLabel,
      note_id: note.id,
      body: data.body,
    };
    if (mentioned.size > 0) {
      await this.notifier.notify({ ...base, recipients: [...mentioned], type: 'mention' });
    }
    if (participants.size > 0) {
      await this.notifier.notify({ ...base, recipients: [...participants], type: 'reply' });
    }
  }

  async getNoteOr404(id: string) {
    const note = await this.prisma.crmNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundException('Nota no encontrada');
    return note;
  }

  async updateNote(id: string, data: UpdateCrmNoteInput) {
    await this.getNoteOr404(id);
    return this.prisma.crmNote.update({ where: { id }, data: { body: data.body } });
  }

  async deleteNote(id: string) {
    await this.getNoteOr404(id);
    // Borrar la raíz se lleva sus respuestas: un hilo sin raíz no se puede pintar.
    await this.prisma.$transaction([
      this.prisma.crmNote.deleteMany({ where: { parent_id: id } }),
      this.prisma.crmNote.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  // ─────────────────────────── Tareas ───────────────────────────

  async listTasks(e: Entity) {
    const items = await this.prisma.crmTask.findMany({
      where: { entity_type: e.entity_type, entity_id: e.entity_id },
      orderBy: [
        { done: 'asc' }, // pendientes primero
        { due_date: { sort: 'asc', nulls: 'last' } },
        { created_at: 'desc' },
      ],
    });
    return { items };
  }

  /**
   * Todas las tareas pendientes, la más próxima primero, cada una con el nombre
   * del registro al que pertenece. Alimenta la bandeja de "mis pendientes".
   */
  async listPendingTasks(assignee?: string) {
    const tasks = await this.prisma.crmTask.findMany({
      where: {
        done: false,
        ...(assignee ? { assignees: { has: assignee.toLowerCase() } } : {}),
      },
      orderBy: [{ due_date: { sort: 'asc', nulls: 'last' } }, { created_at: 'desc' }],
      take: 100,
    });
    const labels = await this.crmPort.labelsFor(tasks);
    return {
      items: tasks.map((t) => ({
        ...t,
        entity_label: labels.get(`${t.entity_type}:${t.entity_id}`) ?? null,
      })),
    };
  }

  async createTask(data: CreateCrmTaskInput) {
    // Una tarea de lead sin responsables se asigna al responsable del lead, para
    // que aparezca en SUS pendientes y no se pierda.
    let assignees = (data.assignees ?? []).map((a) => a.toLowerCase());
    if (assignees.length === 0 && data.entity_type === 'lead') {
      const lead = await this.crmPort.findLeadById(data.entity_id);
      if (lead?.owner) assignees = [lead.owner];
    }
    return this.prisma.crmTask.create({
      data: {
        title: data.title,
        due_date: data.due_date ? new Date(data.due_date) : null,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        assignees,
      },
    });
  }

  async updateTask(id: string, data: UpdateCrmTaskInput) {
    await this.ensureTask(id);
    return this.prisma.crmTask.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.done !== undefined ? { done: data.done } : {}),
        ...(data.due_date !== undefined
          ? { due_date: data.due_date ? new Date(data.due_date) : null }
          : {}),
        ...(data.assignees !== undefined
          ? { assignees: data.assignees.map((a) => a.toLowerCase()) }
          : {}),
      },
    });
  }

  async deleteTask(id: string) {
    await this.ensureTask(id);
    await this.prisma.crmTask.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureTask(id: string) {
    const t = await this.prisma.crmTask.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Tarea no encontrada');
    return t;
  }
}
