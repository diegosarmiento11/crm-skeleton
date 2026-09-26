import { BadRequestException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CrmPortService } from '../crm/crm.port';
import type { NotifierPort } from '../jobs/notifier.port';

const LEAD_ID = '11111111-1111-4111-8111-111111111111';

describe('CommentsService', () => {
  const actor = { email: 'Ana@Example.com', name: 'Ana' };
  let prisma: {
    crmNote: { findFirst: jest.Mock; findMany: jest.Mock; create: jest.Mock };
    crmTask: { create: jest.Mock };
  };
  let crmPort: { labelsFor: jest.Mock; findLeadById: jest.Mock };
  let notifier: { notify: jest.Mock };
  let svc: CommentsService;

  beforeEach(() => {
    prisma = {
      crmNote: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }: { data: object }) => ({
          id: 'n1',
          parent_id: null,
          ...data,
        })),
      },
      crmTask: { create: jest.fn(async ({ data }: { data: object }) => ({ id: 't1', ...data })) },
    };
    crmPort = {
      labelsFor: jest.fn().mockResolvedValue(new Map([[`lead:${LEAD_ID}`, 'ACME']])),
      findLeadById: jest.fn().mockResolvedValue({ id: LEAD_ID, owner: 'dueno@example.com' }),
    };
    notifier = { notify: jest.fn().mockResolvedValue(undefined) };
    svc = new CommentsService(
      prisma as unknown as PrismaService,
      crmPort as unknown as CrmPortService,
      notifier as unknown as NotifierPort,
    );
  });

  // Una respuesta solo cuelga de un hilo raíz de la misma entidad: con un parent_id
  // ajeno se notificaría de "respuesta" a gente de otro lead.
  describe('createNote — hilos', () => {
    const entity = { entity_type: 'lead' as const, entity_id: LEAD_ID };

    it('rechaza un parent_id que no es un hilo raíz de la misma entidad', async () => {
      await expect(
        svc.createNote({ ...entity, kind: 'comment', body: 'x', parent_id: LEAD_ID }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.crmNote.findFirst).toHaveBeenCalledWith({
        where: { id: LEAD_ID, ...entity, parent_id: null },
        select: { id: true },
      });
      expect(prisma.crmNote.create).not.toHaveBeenCalled();
    });

    it('acepta el parent_id de un hilo raíz de la misma entidad', async () => {
      prisma.crmNote.findFirst.mockResolvedValue({ id: 'root' });
      await svc.createNote({ ...entity, kind: 'comment', body: 'x', parent_id: LEAD_ID });
      expect(prisma.crmNote.create.mock.calls[0][0].data.parent_id).toBe(LEAD_ID);
    });

    it('firma la nota con la identidad estable del actor (correo en minúscula)', async () => {
      await svc.createNote({ ...entity, kind: 'comment', body: 'hola' }, actor);
      expect(prisma.crmNote.create.mock.calls[0][0].data).toMatchObject({
        author: 'Ana',
        author_id: 'ana@example.com',
      });
    });
  });

  describe('createNote — notificaciones', () => {
    const entity = { entity_type: 'lead' as const, entity_id: LEAD_ID };

    it('notifica a los @mencionados, nunca al propio autor', async () => {
      await svc.createNote(
        { ...entity, kind: 'comment', body: 'mira @[Beto@example.com] y @[ana@example.com]' },
        actor,
      );
      expect(notifier.notify).toHaveBeenCalledTimes(1);
      expect(notifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'mention',
          recipients: ['beto@example.com'],
          entity_label: 'ACME',
        }),
      );
    });

    it('en una respuesta avisa a los participantes del hilo aunque no los mencionen', async () => {
      prisma.crmNote.findFirst.mockResolvedValue({ id: 'root' });
      prisma.crmNote.findMany.mockResolvedValue([
        { author_id: 'raiz@example.com', body: 'hilo con @[carla@example.com]' },
        { author_id: 'ana@example.com', body: 'ya respondí' },
      ]);
      await svc.createNote(
        { ...entity, kind: 'comment', body: 'de acuerdo', parent_id: LEAD_ID },
        actor,
      );
      const call = notifier.notify.mock.calls[0][0];
      expect(call.type).toBe('reply');
      expect(call.recipients.sort()).toEqual(['carla@example.com', 'raiz@example.com']);
    });

    it('si el notificador falla, la nota igual queda guardada', async () => {
      notifier.notify.mockRejectedValue(new Error('slack caído'));
      const note = await svc.createNote(
        { ...entity, kind: 'comment', body: '@[beto@example.com]' },
        actor,
      );
      expect(note.id).toBe('n1');
    });
  });

  describe('createTask', () => {
    it('una tarea de lead sin responsables se asigna al responsable del lead', async () => {
      await svc.createTask({ entity_type: 'lead', entity_id: LEAD_ID, title: 'Llamar' });
      expect(prisma.crmTask.create.mock.calls[0][0].data.assignees).toEqual(['dueno@example.com']);
    });

    it('respeta los responsables explícitos (normalizados a minúscula)', async () => {
      await svc.createTask({
        entity_type: 'lead',
        entity_id: LEAD_ID,
        title: 'Llamar',
        assignees: ['Beto@Example.com'],
      });
      expect(prisma.crmTask.create.mock.calls[0][0].data.assignees).toEqual(['beto@example.com']);
      expect(crmPort.findLeadById).not.toHaveBeenCalled();
    });
  });
});
