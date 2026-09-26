import { ConflictException } from '@nestjs/common';
import { CrmService } from './crm.service';
import type { PrismaService } from '../prisma/prisma.service';

// El embudo del CRM: cada cambio de etapa deja un LeadStageEvent (de él sale toda
// la analítica) y el kanban re-secuencia posiciones a un 0..n limpio.
describe('CrmService', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  const leadRow = {
    id: 'l-1',
    company: 'ACME',
    owner: 'ana@example.com',
    stage_id: 'st-1',
    stage_changed_at: now,
    created_at: now,
    persons: [],
  };

  type Tx = typeof prisma;
  let prisma: {
    lead: {
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
    };
    pipelineStage: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    crmNote: { groupBy: jest.Mock };
    crmTask: { findMany: jest.Mock };
    leadPerson: { findMany: jest.Mock };
    leadStageEvent: { create: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let svc: CrmService;

  beforeEach(() => {
    prisma = {
      lead: {
        findUnique: jest.fn().mockResolvedValue(leadRow),
        update: jest.fn().mockResolvedValue(leadRow),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(leadRow),
        count: jest.fn().mockResolvedValue(0),
      },
      pipelineStage: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'st-2', name: 'Propuesta', kind: 'PROPOSAL' }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      crmNote: { groupBy: jest.fn().mockResolvedValue([]) },
      crmTask: { findMany: jest.fn().mockResolvedValue([]) },
      leadPerson: { findMany: jest.fn().mockResolvedValue([]) },
      leadStageEvent: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      // $transaction acepta un arreglo de promesas o un callback con el cliente.
      $transaction: jest.fn(async (arg: Promise<unknown>[] | ((tx: Tx) => Promise<unknown>)) =>
        typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
      ),
    };
    svc = new CrmService(prisma as unknown as PrismaService);
  });

  describe('updateLead', () => {
    it('registra un LeadStageEvent con from/to al cambiar de etapa', async () => {
      await svc.updateLead('l-1', { stage_id: 'st-2' });

      expect(prisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'l-1' },
          data: expect.objectContaining({ stage_id: 'st-2', stage_changed_at: expect.any(Date) }),
        }),
      );
      expect(prisma.leadStageEvent.create).toHaveBeenCalledWith({
        data: {
          lead_id: 'l-1',
          from_stage_id: 'st-1',
          to_stage_id: 'st-2',
          owner: 'ana@example.com',
        },
      });
    });

    it('no registra evento si la etapa no cambió', async () => {
      await svc.updateLead('l-1', { company: 'ACME Holdings' });
      expect(prisma.leadStageEvent.create).not.toHaveBeenCalled();
    });

    it('canoniza la razón de pérdida para que el reporte no se fragmente', async () => {
      await svc.updateLead('l-1', { lost_reason: 'precio' });
      expect(prisma.lead.update.mock.calls[0][0].data.lost_reason).toBe('Presupuesto / Precio');
    });
  });

  describe('createLead', () => {
    it('crea el lead con su evento inicial (from = null) y el responsable en minúscula', async () => {
      prisma.pipelineStage.findUnique.mockResolvedValue({ id: 'st-1', kind: 'OPEN' });
      await svc.createLead({
        company: 'ACME',
        stage_id: 'st-1',
        owner: 'Ana@Example.com',
        person_ids: [],
      });
      const data = prisma.lead.create.mock.calls[0][0].data;
      expect(data.owner).toBe('ana@example.com');
      expect(data.stage_events.create).toEqual([{ to_stage_id: 'st-1', owner: 'ana@example.com' }]);
      // Todo dentro de la misma transacción.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('moveLead', () => {
    it('re-secuencia la columna destino a un 0..n limpio alrededor del lead movido', async () => {
      prisma.lead.findMany.mockResolvedValue([{ id: 'l-a' }, { id: 'l-b' }]);

      await svc.moveLead('l-1', { stage_id: 'st-2', position: 1 });

      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'l-a' },
        data: { position: 0 },
      });
      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'l-1' },
        data: expect.objectContaining({ position: 1, stage_id: 'st-2' }),
      });
      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'l-b' },
        data: { position: 2 },
      });
      expect(prisma.leadStageEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ from_stage_id: 'st-1', to_stage_id: 'st-2' }),
      });
    });

    it('acota una posición fuera de rango al final de la columna', async () => {
      prisma.lead.findMany.mockResolvedValue([{ id: 'l-a' }]);
      await svc.moveLead('l-1', { stage_id: 'st-2', position: 99 });
      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'l-1' },
        data: expect.objectContaining({ position: 1 }),
      });
    });
  });

  describe('etapas', () => {
    it('no deja borrar una etapa con leads (409)', async () => {
      prisma.lead.count.mockResolvedValue(3);
      await expect(svc.deleteStage('st-2')).rejects.toBeInstanceOf(ConflictException);
    });

    it('solo puede haber una etapa WON', async () => {
      prisma.pipelineStage.findFirst.mockResolvedValue({ name: 'Ganado' });
      await expect(
        svc.createStage({ name: 'Cerrado', color: 'green', kind: 'WON' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // Días por etapa: la métrica sale del log de eventos, no del snapshot actual.
  describe('leadStageHistory', () => {
    it('mide los días por etapa y oculta las estadías-artefacto (mismo instante)', async () => {
      prisma.leadStageEvent.findMany.mockResolvedValue([
        { to_stage_id: 'st-0', occurred_at: new Date('2026-06-01T00:00:00Z') },
        { to_stage_id: 'st-1', occurred_at: new Date('2026-06-01T00:00:00Z') },
        { to_stage_id: 'st-2', occurred_at: new Date('2026-06-06T00:00:00Z') },
      ]);
      prisma.pipelineStage.findMany.mockResolvedValue([
        { id: 'st-0', name: 'Nuevo', color: 'slate', position: 0 },
        { id: 'st-1', name: 'Diagnóstico', color: 'blue', position: 1 },
        { id: 'st-2', name: 'Propuesta', color: 'amber', position: 2 },
      ]);
      jest.useFakeTimers().setSystemTime(new Date('2026-06-16T00:00:00Z'));
      const res = await svc.leadStageHistory('l-1');
      jest.useRealTimers();

      expect(res.segments.map((seg) => [seg.name, seg.days])).toEqual([
        ['Diagnóstico', 5],
        ['Propuesta', 10],
      ]);
      expect(res.segments[1].left_at).toBeNull();
      expect(res.totals).toEqual([
        expect.objectContaining({ stage_id: 'st-1', days: 5 }),
        expect.objectContaining({ stage_id: 'st-2', days: 10 }),
      ]);
    });
  });

  describe('pipelineAnalytics — histórico y SLA', () => {
    const stages = [
      { id: 'st-1', name: 'Diagnóstico', color: 'blue', position: 0, kind: 'QUALIFY' },
      { id: 'st-2', name: 'Propuesta enviada', color: 'amber', position: 1, kind: 'PROPOSAL' },
      { id: 'st-3', name: 'Ganado', color: 'green', position: 2, kind: 'WON' },
      { id: 'st-4', name: 'Perdido', color: 'red', position: 3, kind: 'LOST' },
    ];

    it('calcula hist_avg_days con las estadías completadas del log', async () => {
      prisma.pipelineStage.findMany.mockResolvedValue(stages);
      const lead = {
        id: 'l-1',
        stage_id: 'st-2',
        estimated_value: 0,
        company: 'ACME',
        owner: null,
        created_at: new Date('2026-06-01T00:00:00Z'),
        stage_changed_at: new Date('2026-06-08T00:00:00Z'),
        lost_reason: null,
      };
      prisma.lead.findMany.mockResolvedValue([lead]);
      prisma.leadStageEvent.findMany.mockResolvedValue([
        {
          lead_id: 'l-1',
          from_stage_id: null,
          to_stage_id: 'st-1',
          occurred_at: new Date('2026-06-01T00:00:00Z'),
        },
        {
          lead_id: 'l-1',
          from_stage_id: 'st-1',
          to_stage_id: 'st-2',
          occurred_at: new Date('2026-06-08T00:00:00Z'),
        },
      ]);
      jest.useFakeTimers().setSystemTime(new Date('2026-06-10T00:00:00Z'));
      const res = await svc.pipelineAnalytics();
      jest.useRealTimers();

      const diag = res.stages.find((s) => s.id === 'st-1')!;
      expect(diag.hist_avg_days).toBe(7);
      expect(diag.hist_n).toBe(1);
      expect(res.stages.find((s) => s.id === 'st-2')!.hist_avg_days).toBeNull();
      expect(res.sla.items).toHaveLength(0);
      // La conversión Diagnóstico → Propuesta es 1/1.
      expect(res.stages.find((s) => s.id === 'st-2')!.conversion_from_prev).toBe(1);
    });

    it('marca la violación de SLA: >10 días en etapa vigilada sin actividad', async () => {
      prisma.pipelineStage.findMany.mockResolvedValue(stages);
      const lead = {
        id: 'l-1',
        stage_id: 'st-2',
        estimated_value: 5_000_000,
        company: 'ACME',
        owner: 'ana@example.com',
        created_at: new Date('2026-05-01T00:00:00Z'),
        stage_changed_at: new Date('2026-05-20T00:00:00Z'),
        lost_reason: null,
      };
      prisma.lead.findMany.mockResolvedValue([lead]);
      jest.useFakeTimers().setSystemTime(new Date('2026-06-10T00:00:00Z'));
      const res = await svc.pipelineAnalytics();
      jest.useRealTimers();

      expect(res.sla.days).toBe(10);
      expect(res.sla.stages.map((s) => s.id).sort()).toEqual(['st-1', 'st-2']);
      expect(res.sla.items).toEqual([
        expect.objectContaining({
          lead_id: 'l-1',
          stage_name: 'Propuesta enviada',
          days_in_stage: 21,
          days_since_activity: null,
        }),
      ]);
    });

    it('el reporte de pérdidas agrupa por etapa de origen y por razón canónica', async () => {
      prisma.pipelineStage.findMany.mockResolvedValue(stages);
      prisma.lead.findMany.mockResolvedValue([
        {
          id: 'l-1',
          stage_id: 'st-4',
          estimated_value: 100,
          company: 'A',
          owner: null,
          created_at: now,
          stage_changed_at: now,
          lost_reason: 'precio',
        },
        {
          id: 'l-2',
          stage_id: 'st-4',
          estimated_value: 50,
          company: 'B',
          owner: null,
          created_at: now,
          stage_changed_at: now,
          lost_reason: null,
        },
      ]);
      prisma.leadStageEvent.findMany.mockResolvedValue([
        { lead_id: 'l-1', from_stage_id: 'st-2', to_stage_id: 'st-4', occurred_at: now },
        { lead_id: 'l-2', from_stage_id: 'st-1', to_stage_id: 'st-4', occurred_at: now },
      ]);
      const res = await svc.pipelineAnalytics();
      expect(res.loss.by_stage.map((r) => [r.key, r.value])).toEqual([
        ['Propuesta enviada', 100],
        ['Diagnóstico', 50],
      ]);
      expect(res.loss.reasons.map((r) => r.key)).toEqual(['Presupuesto / Precio', 'Sin razón']);
      expect(res.totals.win_rate).toBe(0);
    });
  });
});
