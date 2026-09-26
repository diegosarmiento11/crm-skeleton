import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateLeadInput,
  UpdateLeadInput,
  MoveLeadInput,
  CreatePipelineStageInput,
  UpdatePipelineStageInput,
  ReorderStagesInput,
  SignalLead,
  StageKind,
} from '@crm/shared';
import {
  LOST_REASONS,
  TOUCHPOINT_KINDS,
  canonicalLostReason,
  computeLeadHealth,
  isClosedKind,
  normalizeCity,
} from '@crm/shared';
import { PrismaService } from '../prisma/prisma.service';

interface LeadFilters {
  stageId?: string;
  owner?: string;
  q?: string;
}

/** Umbral del playbook de seguimiento: días en QUALIFY/PROPOSAL sin actividad. */
export const SLA_DAYS = 10;
/** Un lead abierto que no se mueve en tantos días cuenta como "estancado". */
export const STALLED_DAYS = 14;

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────── Etapas ───────────────────────────

  async listStages() {
    const items = await this.prisma.pipelineStage.findMany({ orderBy: { position: 'asc' } });
    return { items };
  }

  async createStage(data: CreatePipelineStageInput) {
    await this.ensureSingleKind(data.kind);
    const last = await this.prisma.pipelineStage.findFirst({ orderBy: { position: 'desc' } });
    return this.prisma.pipelineStage.create({
      data: {
        name: data.name,
        color: data.color ?? 'slate',
        kind: data.kind ?? 'OPEN',
        position: (last?.position ?? -1) + 1,
      },
    });
  }

  async updateStage(id: string, data: UpdatePipelineStageInput) {
    await this.ensureStage(id);
    if (data.kind) await this.ensureSingleKind(data.kind, id);
    return this.prisma.pipelineStage.update({ where: { id }, data });
  }

  /**
   * Solo puede haber UNA etapa WON, UNA LOST, UNA QUALIFY y UNA PROPOSAL: la
   * analítica las trata como hitos del embudo. OPEN puede repetirse.
   */
  private async ensureSingleKind(kind: StageKind | undefined, exceptId?: string) {
    if (!kind || kind === 'OPEN') return;
    const other = await this.prisma.pipelineStage.findFirst({
      where: { kind, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { name: true },
    });
    if (other) {
      throw new ConflictException(`Ya existe una etapa de tipo ${kind} («${other.name}»)`);
    }
  }

  async reorderStages(input: ReorderStagesInput) {
    await this.prisma.$transaction(
      input.items.map((it) =>
        this.prisma.pipelineStage.update({ where: { id: it.id }, data: { position: it.position } }),
      ),
    );
    return this.listStages();
  }

  async deleteStage(id: string) {
    await this.ensureStage(id);
    const count = await this.prisma.lead.count({ where: { stage_id: id } });
    if (count > 0) {
      throw new ConflictException(
        `No se puede borrar una etapa con ${count} lead(s). Muévelos a otra etapa primero.`,
      );
    }
    await this.prisma.pipelineStage.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureStage(id: string) {
    const stage = await this.prisma.pipelineStage.findUnique({ where: { id } });
    if (!stage) throw new NotFoundException('Etapa no encontrada');
    return stage;
  }

  // ─────────────────────────── Leads ───────────────────────────

  async listLeads(filters: LeadFilters) {
    const where = {
      ...(filters.stageId ? { stage_id: filters.stageId } : {}),
      ...(filters.owner ? { owner: filters.owner.toLowerCase() } : {}),
      ...(filters.q ? { company: { contains: filters.q, mode: 'insensitive' as const } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        orderBy: [{ stage: { position: 'asc' } }, { position: 'asc' }],
        include: LEAD_PERSONS_INCLUDE,
      }),
      this.prisma.lead.count({ where }),
    ]);

    const [meta, closedSet] = await Promise.all([
      this.leadMeta(items.map((l) => l.id)),
      this.closedStageSet(),
    ]);
    return { items: items.map((l) => this.withMeta(shapeLead(l), meta, closedSet)), total };
  }

  /**
   * Conteo de notas, última actividad y próxima tarea pendiente por lead.
   * "Actividad" = un punto de contacto registrado (email/whatsapp/call) sobre el
   * lead o sobre cualquiera de sus personas asociadas. Un comentario libre no
   * cuenta: comentar internamente no es contactar al cliente.
   */
  private async leadMeta(ids: string[]): Promise<LeadMeta> {
    if (ids.length === 0) {
      return { notesById: new Map(), lastActById: new Map(), nextTaskById: new Map() };
    }
    const [notes, touches, tasks, leadPeople] = await Promise.all([
      this.prisma.crmNote.groupBy({
        by: ['entity_id'],
        where: { entity_type: 'lead', entity_id: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.crmNote.groupBy({
        by: ['entity_id'],
        where: { entity_type: 'lead', entity_id: { in: ids }, kind: { in: [...TOUCHPOINT_KINDS] } },
        _max: { created_at: true },
      }),
      this.prisma.crmTask.findMany({
        where: { entity_type: 'lead', entity_id: { in: ids }, done: false },
        orderBy: [{ due_date: { sort: 'asc', nulls: 'last' } }, { created_at: 'asc' }],
        select: { id: true, title: true, due_date: true, entity_id: true },
      }),
      this.prisma.leadPerson.findMany({
        where: { lead_id: { in: ids } },
        select: { lead_id: true, person_id: true },
      }),
    ]);
    const notesById = new Map(notes.map((n) => [n.entity_id, n._count._all]));
    const lastActById = new Map<string, Date | null>(
      touches.map((t) => [t.entity_id, t._max.created_at]),
    );
    const fold = (leadId: string, at: Date | null | undefined) => {
      if (!at) return;
      const current = lastActById.get(leadId) ?? null;
      if (!current || at > current) lastActById.set(leadId, at);
    };
    // La actividad de las personas asociadas también cuenta para el lead.
    const personIds = [...new Set(leadPeople.map((lp) => lp.person_id))];
    if (personIds.length) {
      const personTouches = await this.prisma.crmNote.groupBy({
        by: ['entity_id'],
        where: {
          entity_type: 'person',
          entity_id: { in: personIds },
          kind: { in: [...TOUCHPOINT_KINDS] },
        },
        _max: { created_at: true },
      });
      const maxByPerson = new Map(personTouches.map((t) => [t.entity_id, t._max.created_at]));
      for (const lp of leadPeople) fold(lp.lead_id, maxByPerson.get(lp.person_id) ?? null);
    }
    const nextTaskById = new Map<string, { id: string; title: string; due_date: Date | null }>();
    for (const t of tasks) {
      if (!nextTaskById.has(t.entity_id)) {
        nextTaskById.set(t.entity_id, { id: t.id, title: t.title, due_date: t.due_date });
      }
    }
    return { notesById, lastActById, nextTaskById };
  }

  private async closedStageSet(): Promise<Set<string>> {
    const stages = await this.prisma.pipelineStage.findMany({ select: { id: true, kind: true } });
    return new Set(stages.filter((s) => isClosedKind(s.kind)).map((s) => s.id));
  }

  /** Añade notes_count, salud derivada y próxima tarea a un lead ya aplanado. */
  private withMeta<
    T extends { id: string; owner: string | null; stage_id: string; stage_changed_at: Date },
  >(lead: T, meta: LeadMeta, closedSet: Set<string>) {
    const lastAct = meta.lastActById.get(lead.id) ?? null;
    const h = computeLeadHealth(
      lead.stage_changed_at,
      lastAct,
      lead.owner,
      closedSet.has(lead.stage_id),
    );
    return {
      ...lead,
      notes_count: meta.notesById.get(lead.id) ?? 0,
      last_activity_at: lastAct,
      health: h.band,
      health_reason: h.reason || undefined,
      next_task: meta.nextTaskById.get(lead.id) ?? null,
    };
  }

  async getLead(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: LEAD_PERSONS_INCLUDE,
    });
    if (!lead) throw new NotFoundException('Lead no encontrado');
    const [meta, closedSet] = await Promise.all([this.leadMeta([id]), this.closedStageSet()]);
    return this.withMeta(shapeLead(lead), meta, closedSet);
  }

  async createLead(input: CreateLeadInput) {
    await this.ensureStage(input.stage_id);
    const { person_ids, ...scalar } = input;
    // Lead + su evento inicial + sus personas van JUNTOS: si falla la segunda
    // escritura no puede quedar un lead invisible para la analítica.
    const created = await this.prisma.$transaction(async (tx) => {
      const last = await tx.lead.findFirst({
        where: { stage_id: input.stage_id },
        orderBy: { position: 'desc' },
      });
      return tx.lead.create({
        data: {
          ...normalizeLead(scalar),
          owner: input.owner?.toLowerCase() ?? null,
          position: (last?.position ?? -1) + 1,
          persons: { create: leadPersonRows(person_ids) },
          // Entrada inicial al embudo (from = null).
          stage_events: {
            create: [{ to_stage_id: input.stage_id, owner: input.owner?.toLowerCase() ?? null }],
          },
        },
        include: LEAD_PERSONS_INCLUDE,
      });
    });
    return shapeLead(created);
  }

  async updateLead(id: string, input: UpdateLeadInput) {
    const current = await this.getLead(id);
    if (input.stage_id) await this.ensureStage(input.stage_id);
    const { person_ids, ...scalar } = input;
    const stageChanged = Boolean(input.stage_id && input.stage_id !== current.stage_id);
    const data = normalizeLead(scalar);
    if (typeof data.owner === 'string') data.owner = data.owner.toLowerCase();
    if ('lost_reason' in data) data.lost_reason = canonicalLostReason(data.lost_reason);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.lead.update({
        where: { id },
        data: {
          ...data,
          ...(stageChanged ? { stage_changed_at: new Date() } : {}),
          // Las asociaciones se reemplazan solo cuando el llamador manda person_ids.
          ...(person_ids
            ? { persons: { deleteMany: {}, create: leadPersonRows(person_ids) } }
            : {}),
        },
        include: LEAD_PERSONS_INCLUDE,
      });
      if (stageChanged) {
        await tx.leadStageEvent.create({
          data: {
            lead_id: id,
            from_stage_id: current.stage_id,
            to_stage_id: input.stage_id as string,
            owner: current.owner,
          },
        });
      }
      return row;
    });
    return shapeLead(updated);
  }

  async deleteLead(id: string) {
    await this.getLead(id);
    // Las notas y tareas no tienen FK (referencia polimórfica): se borran a mano
    // en la misma transacción para no dejarlas colgando.
    await this.prisma.$transaction([
      this.prisma.crmNote.deleteMany({ where: { entity_type: 'lead', entity_id: id } }),
      this.prisma.crmTask.deleteMany({ where: { entity_type: 'lead', entity_id: id } }),
      this.prisma.lead.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  /**
   * Mueve un lead a `stage_id` en el índice `position` y re-secuencia la columna
   * destino a un 0..n limpio para que el orden se mantenga estable.
   */
  async moveLead(id: string, input: MoveLeadInput) {
    const current = await this.getLead(id);
    await this.ensureStage(input.stage_id);
    const stageChanged = input.stage_id !== current.stage_id;

    const siblings = await this.prisma.lead.findMany({
      where: { stage_id: input.stage_id, id: { not: id } },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    const order = siblings.map((s) => s.id);
    const idx = Math.max(0, Math.min(input.position, order.length));
    order.splice(idx, 0, id);

    await this.prisma.$transaction([
      ...order.map((leadId, position) =>
        this.prisma.lead.update({
          where: { id: leadId },
          data: {
            position,
            ...(leadId === id
              ? {
                  stage_id: input.stage_id,
                  ...(stageChanged ? { stage_changed_at: new Date() } : {}),
                }
              : {}),
          },
        }),
      ),
      ...(stageChanged
        ? [
            this.prisma.leadStageEvent.create({
              data: {
                lead_id: id,
                from_stage_id: current.stage_id,
                to_stage_id: input.stage_id,
                owner: current.owner,
              },
            }),
          ]
        : []),
    ]);
    return this.getLead(id);
  }

  /**
   * Recorrido por etapas de un lead, derivado del log lead_stage_events: cuándo
   * entró a cada etapa y cuántos días duró (la actual sigue corriendo). Las
   * estadías < 1 min se ocultan: son artefactos de un backfill o de un movimiento
   * corregido al instante, no una estadía real.
   */
  async leadStageHistory(id: string) {
    const [lead, events, stages] = await Promise.all([
      this.prisma.lead.findUnique({ where: { id }, select: { id: true } }),
      this.prisma.leadStageEvent.findMany({
        where: { lead_id: id },
        orderBy: { occurred_at: 'asc' },
      }),
      this.prisma.pipelineStage.findMany({ orderBy: { position: 'asc' } }),
    ]);
    if (!lead) throw new NotFoundException('Lead no encontrado');
    const stageById = new Map(stages.map((s) => [s.id, s]));
    const now = Date.now();
    const segments = events
      .map((e, i) => {
        const next = events[i + 1] ?? null;
        const end = next ? next.occurred_at.getTime() : now;
        const stage = stageById.get(e.to_stage_id);
        return {
          stage_id: e.to_stage_id,
          name: stage?.name ?? 'Etapa eliminada',
          color: stage?.color ?? 'slate',
          entered_at: e.occurred_at.toISOString(),
          left_at: next ? next.occurred_at.toISOString() : null,
          days: round1((end - e.occurred_at.getTime()) / DAY_MS),
        };
      })
      .filter((seg) => {
        if (seg.left_at === null) return true;
        return new Date(seg.left_at).getTime() - new Date(seg.entered_at).getTime() >= 60_000;
      });

    const daysByStage = new Map<string, number>();
    for (const seg of segments) {
      daysByStage.set(seg.stage_id, (daysByStage.get(seg.stage_id) ?? 0) + seg.days);
    }
    const totals = stages
      .filter((s) => daysByStage.has(s.id))
      .map((s) => ({
        stage_id: s.id,
        name: s.name,
        color: s.color,
        days: round1(daysByStage.get(s.id)!),
      }));
    return { segments, totals };
  }

  // ─────────────────────────── Analítica del embudo ───────────────────────────

  /**
   * Embudo: por etapa, cuántos leads hay hoy y cuántos pasaron alguna vez
   * (conversión etapa a etapa), valor ponderado, win-rate, ciclo de venta,
   * reporte de pérdidas, cuello de botella y violaciones del SLA de seguimiento.
   * "Alguna vez" sale del log de eventos; la ponderación es una heurística por
   * posición (transparente) hasta que haya historia suficiente para algo mejor.
   */
  async pipelineAnalytics(range?: { from?: Date; to?: Date }) {
    // Cohorte = leads CREADOS dentro de [from, to]; se les sigue hacia adelante.
    const leadWhere =
      range?.from || range?.to
        ? {
            created_at: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {};
    const [stages, leads, allEvents] = await Promise.all([
      this.prisma.pipelineStage.findMany({ orderBy: { position: 'asc' } }),
      this.prisma.lead.findMany({
        where: leadWhere,
        select: {
          id: true,
          stage_id: true,
          estimated_value: true,
          created_at: true,
          stage_changed_at: true,
          lost_reason: true,
        },
      }),
      this.prisma.leadStageEvent.findMany({
        select: { to_stage_id: true, from_stage_id: true, lead_id: true, occurred_at: true },
        orderBy: { occurred_at: 'asc' },
      }),
    ]);
    const cohort = new Set(leads.map((l) => l.id));
    const events = allEvents.filter((e) => cohort.has(e.lead_id));

    const wonIds = new Set(stages.filter((s) => s.kind === 'WON').map((s) => s.id));
    const lostIds = new Set(stages.filter((s) => s.kind === 'LOST').map((s) => s.id));

    // Leads distintos que alguna vez entraron a cada etapa.
    const reachedSets = new Map<string, Set<string>>();
    for (const e of events) {
      if (!reachedSets.has(e.to_stage_id)) reachedSets.set(e.to_stage_id, new Set());
      reachedSets.get(e.to_stage_id)!.add(e.lead_id);
    }

    // Días por etapa, histórico: estadías COMPLETADAS (entrada → siguiente
    // transición del mismo lead). Las < 1 min se descartan para no sesgar.
    const eventsByLead = new Map<string, typeof events>();
    for (const e of events) {
      const list = eventsByLead.get(e.lead_id) ?? [];
      list.push(e);
      eventsByLead.set(e.lead_id, list);
    }
    const histByStage = new Map<string, number[]>();
    for (const evs of eventsByLead.values()) {
      for (let i = 0; i < evs.length - 1; i++) {
        const ms = evs[i + 1].occurred_at.getTime() - evs[i].occurred_at.getTime();
        if (ms < 60_000) continue;
        const list = histByStage.get(evs[i].to_stage_id) ?? [];
        list.push(ms / DAY_MS);
        histByStage.set(evs[i].to_stage_id, list);
      }
    }

    const now = Date.now();
    // Probabilidad por etapa: posición relativa a la etapa WON (0 en la primera, 1 en WON).
    const wonIndex = stages.reduce((acc, s, i) => (wonIds.has(s.id) ? i : acc), 0);

    let openCount = 0;
    let openValue = 0;
    let weightedValue = 0;
    let wonCount = 0;
    let wonValue = 0;
    let lostCount = 0;
    const cycleDays: number[] = [];

    const stageRows = stages.map((s, i) => {
      const here = leads.filter((l) => l.stage_id === s.id);
      const currentValue = here.reduce((sum, l) => sum + (l.estimated_value ?? 0), 0);
      const ages = here.map((l) => (now - l.stage_changed_at.getTime()) / DAY_MS);
      const closed = isClosedKind(s.kind);

      if (!closed) {
        openCount += here.length;
        openValue += currentValue;
        const prob = wonIndex > 0 ? Math.min(1, i / wonIndex) : 0;
        weightedValue += currentValue * prob;
      } else if (s.kind === 'WON') {
        wonCount += here.length;
        wonValue += currentValue;
        for (const l of here) {
          cycleDays.push((l.stage_changed_at.getTime() - l.created_at.getTime()) / DAY_MS);
        }
      } else {
        lostCount += here.length;
      }

      const hist = histByStage.get(s.id) ?? [];
      return {
        id: s.id,
        name: s.name,
        color: s.color,
        position: s.position,
        kind: s.kind,
        current_count: here.length,
        current_value: currentValue,
        reached_count: reachedSets.get(s.id)?.size ?? 0,
        avg_days_in_stage: ages.length ? round1(avg(ages)) : null,
        hist_avg_days: hist.length ? round1(avg(hist)) : null,
        hist_n: hist.length,
      };
    });

    const withConversion = stageRows.map((row, i) => {
      const prev = i > 0 ? stageRows[i - 1].reached_count : 0;
      return {
        ...row,
        conversion_from_prev: i > 0 && prev > 0 ? round2(row.reached_count / prev) : null,
      };
    });

    // Reporte de fugas: desde qué etapa (última transición hacia LOST) y por qué.
    const stageById = new Map(stages.map((s) => [s.id, s]));
    const lostFromByLead = new Map<string, string | null>();
    for (const e of events)
      if (lostIds.has(e.to_stage_id)) lostFromByLead.set(e.lead_id, e.from_stage_id);
    type LossAcc = { key: string; color: string | null; count: number; value: number };
    const byStageAcc = new Map<string, LossAcc>();
    const byReasonAcc = new Map<string, LossAcc>();
    for (const l of leads.filter((l) => lostIds.has(l.stage_id))) {
      const value = l.estimated_value ?? 0;
      const fromId = lostFromByLead.get(l.id) ?? null;
      const from = fromId ? stageById.get(fromId) : undefined;
      const stageKey = from?.name ?? 'Directo';
      const s = byStageAcc.get(stageKey) ?? {
        key: stageKey,
        color: from?.color ?? null,
        count: 0,
        value: 0,
      };
      s.count += 1;
      s.value += value;
      byStageAcc.set(stageKey, s);
      const reasonKey = canonicalLostReason(l.lost_reason) ?? 'Sin razón';
      const r = byReasonAcc.get(reasonKey) ?? { key: reasonKey, color: null, count: 0, value: 0 };
      r.count += 1;
      r.value += value;
      byReasonAcc.set(reasonKey, r);
    }
    const byValueDesc = (a: LossAcc, b: LossAcc) => b.value - a.value || b.count - a.count;
    // Razones en el orden canónico, luego texto libre por valor, "Sin razón" al final.
    const reasonRank = (key: string) => {
      const i = (LOST_REASONS as readonly string[]).indexOf(key);
      if (i >= 0) return i;
      return key === 'Sin razón' ? Number.MAX_SAFE_INTEGER : LOST_REASONS.length;
    };
    const loss = {
      by_stage: [...byStageAcc.values()].sort(byValueDesc),
      reasons: [...byReasonAcc.values()].sort(
        (a, b) => reasonRank(a.key) - reasonRank(b.key) || byValueDesc(a, b),
      ),
    };

    // SLA de seguimiento: >SLA_DAYS en QUALIFY/PROPOSAL sin actividad. Se evalúa
    // sobre TODOS los leads que están hoy en esas etapas (no la cohorte): un lead
    // viejo estancado también viola el SLA aunque quede fuera del filtro de fechas.
    const slaStages = stages.filter((s) => s.kind === 'QUALIFY' || s.kind === 'PROPOSAL');
    let slaItems: {
      lead_id: string;
      company: string;
      owner: string | null;
      stage_id: string;
      stage_name: string;
      days_in_stage: number;
      days_since_activity: number | null;
    }[] = [];
    if (slaStages.length) {
      const slaStageById = new Map(slaStages.map((s) => [s.id, s]));
      const candidates = (
        await this.prisma.lead.findMany({
          where: { stage_id: { in: slaStages.map((s) => s.id) } },
          select: { id: true, company: true, owner: true, stage_id: true, stage_changed_at: true },
        })
      ).filter((l) => (now - l.stage_changed_at.getTime()) / DAY_MS > SLA_DAYS);
      const slaMeta = await this.leadMeta(candidates.map((l) => l.id));
      slaItems = candidates
        .map((l) => {
          const lastAct = slaMeta.lastActById.get(l.id) ?? null;
          return {
            lead_id: l.id,
            company: l.company,
            owner: l.owner,
            stage_id: l.stage_id,
            stage_name: slaStageById.get(l.stage_id)?.name ?? '',
            days_in_stage: Math.floor((now - l.stage_changed_at.getTime()) / DAY_MS),
            days_since_activity: lastAct ? Math.floor((now - lastAct.getTime()) / DAY_MS) : null,
          };
        })
        .filter((b) => b.days_since_activity == null || b.days_since_activity > SLA_DAYS)
        .sort((a, b) => b.days_in_stage - a.days_in_stage);
    }

    // Cuello de botella = etapa abierta con leads donde más tiempo se quedan.
    const openWithLeads = withConversion.filter(
      (s) => !isClosedKind(s.kind) && s.current_count > 0,
    );
    const bottleneckRow = openWithLeads.reduce<(typeof openWithLeads)[number] | null>(
      (worst, s) => ((s.avg_days_in_stage ?? 0) > (worst?.avg_days_in_stage ?? 0) ? s : worst),
      null,
    );

    const closedTotal = wonCount + lostCount;
    return {
      stages: withConversion,
      totals: {
        open_count: openCount,
        open_value: openValue,
        weighted_value: Math.round(weightedValue),
        won_count: wonCount,
        won_value: wonValue,
        win_rate: closedTotal > 0 ? round2(wonCount / closedTotal) : null,
        avg_cycle_days: cycleDays.length ? round1(avg(cycleDays)) : null,
      },
      loss,
      sla: {
        days: SLA_DAYS,
        stages: slaStages.map((s) => ({ id: s.id, name: s.name })),
        items: slaItems,
      },
      bottleneck: bottleneckRow
        ? {
            id: bottleneckRow.id,
            name: bottleneckRow.name,
            avg_days_in_stage: bottleneckRow.avg_days_in_stage,
            conversion_from_prev: bottleneckRow.conversion_from_prev,
            current_count: bottleneckRow.current_count,
          }
        : null,
    };
  }

  /**
   * Desempeño por persona en [from, to]. La actividad (prospectado, propuestas,
   * ganados, perdidos) se atribuye a quien era responsable en cada transición;
   * forecast y estancados son foto de hoy sobre los leads abiertos de cada uno.
   */
  async pipelinePerformance(range?: { from?: Date; to?: Date }) {
    const [stages, leads, events, teamUsers] = await Promise.all([
      this.prisma.pipelineStage.findMany({ orderBy: { position: 'asc' } }),
      this.prisma.lead.findMany({
        select: {
          id: true,
          owner: true,
          stage_id: true,
          estimated_value: true,
          created_at: true,
          stage_changed_at: true,
        },
      }),
      this.prisma.leadStageEvent.findMany({
        where:
          range?.from || range?.to
            ? {
                occurred_at: {
                  ...(range.from ? { gte: range.from } : {}),
                  ...(range.to ? { lte: range.to } : {}),
                },
              }
            : {},
        select: { lead_id: true, to_stage_id: true, owner: true, occurred_at: true },
      }),
      this.prisma.teamUser.findMany({ select: { email: true } }),
    ]);

    const leadById = new Map(leads.map((l) => [l.id, l]));
    // Solo miembros con cuenta (activa o desactivada) salen en el desglose; los
    // números de una cuenta eliminada siguen en el agregado "Equipo".
    const teamEmails = new Set(teamUsers.map((t) => t.email.toLowerCase()));

    const wonIds = new Set(stages.filter((s) => s.kind === 'WON').map((s) => s.id));
    const lostIds = new Set(stages.filter((s) => s.kind === 'LOST').map((s) => s.id));
    const qualifyStage = stages.find((s) => s.kind === 'QUALIFY') ?? null;
    const proposalStage = stages.find((s) => s.kind === 'PROPOSAL') ?? null;
    const wonIndex = stages.reduce((acc, s, i) => (wonIds.has(s.id) ? i : acc), 0);
    const stageIndex = new Map(stages.map((s, i) => [s.id, i]));
    const kindById = new Map(stages.map((s) => [s.id, s.kind]));

    type Acc = {
      prospected: Set<string>;
      proposals: Set<string>;
      won: Set<string>;
      lost: Set<string>;
      wonValue: number;
      cycle: number[];
    };
    const newAcc = (): Acc => ({
      prospected: new Set(),
      proposals: new Set(),
      won: new Set(),
      lost: new Set(),
      wonValue: 0,
      cycle: [],
    });
    type Snap = { open: number; openValue: number; forecast: number; stalled: number };
    const newSnap = (): Snap => ({ open: 0, openValue: 0, forecast: 0, stalled: 0 });

    const accs = new Map<string | null, Acc>();
    const accOf = (owner: string | null) =>
      accs.get(owner) ?? accs.set(owner, newAcc()).get(owner)!;
    const teamAcc = newAcc();

    for (const e of events) {
      const apply = (acc: Acc) => {
        if (qualifyStage && e.to_stage_id === qualifyStage.id) acc.prospected.add(e.lead_id);
        if (proposalStage && e.to_stage_id === proposalStage.id) acc.proposals.add(e.lead_id);
        if (wonIds.has(e.to_stage_id)) {
          acc.won.add(e.lead_id);
          const l = leadById.get(e.lead_id);
          if (l) {
            acc.wonValue += l.estimated_value ?? 0;
            acc.cycle.push((e.occurred_at.getTime() - l.created_at.getTime()) / DAY_MS);
          }
        }
        if (lostIds.has(e.to_stage_id)) acc.lost.add(e.lead_id);
      };
      apply(accOf(e.owner?.toLowerCase() ?? null));
      apply(teamAcc);
    }

    const now = Date.now();
    const snaps = new Map<string | null, Snap>();
    const snapOf = (owner: string | null) =>
      snaps.get(owner) ?? snaps.set(owner, newSnap()).get(owner)!;
    const teamSnap = newSnap();
    for (const l of leads) {
      const kind = kindById.get(l.stage_id);
      if (!kind || isClosedKind(kind)) continue;
      const v = l.estimated_value ?? 0;
      const i = stageIndex.get(l.stage_id) ?? 0;
      const prob = wonIndex > 0 ? Math.min(1, i / wonIndex) : 0;
      const stalled = (now - l.stage_changed_at.getTime()) / DAY_MS > STALLED_DAYS ? 1 : 0;
      for (const s of [snapOf(l.owner?.toLowerCase() ?? null), teamSnap]) {
        s.open += 1;
        s.openValue += v;
        s.forecast += v * prob;
        s.stalled += stalled;
      }
    }

    const toRow = (owner: string | null, a: Acc, s: Snap) => {
      const won = a.won.size;
      const lost = a.lost.size;
      const closedN = won + lost;
      return {
        owner,
        prospected: a.prospected.size,
        proposals: a.proposals.size,
        won,
        lost,
        win_rate: closedN > 0 ? round2(won / closedN) : null,
        won_value: a.wonValue,
        avg_ticket: won > 0 ? Math.round(a.wonValue / won) : null,
        avg_cycle_days: a.cycle.length ? round1(avg(a.cycle)) : null,
        open_count: s.open,
        open_value: s.openValue,
        forecast: Math.round(s.forecast),
        stalled: s.stalled,
      };
    };

    const ownerKeys = new Set<string | null>([...accs.keys(), ...snaps.keys()]);
    const owners = [...ownerKeys]
      .map((o) => toRow(o, accs.get(o) ?? newAcc(), snaps.get(o) ?? newSnap()))
      .filter((r) => r.prospected || r.proposals || r.won || r.lost || r.open_count)
      .filter((r) => r.owner === null || teamEmails.has(r.owner))
      .sort((a, b) => b.won_value - a.won_value || b.prospected - a.prospected);

    return {
      from: range?.from?.toISOString() ?? null,
      to: range?.to?.toISOString() ?? null,
      qualify_stage: qualifyStage ? { id: qualifyStage.id, name: qualifyStage.name } : null,
      proposal_stage: proposalStage ? { id: proposalStage.id, name: proposalStage.name } : null,
      stalled_days: STALLED_DAYS,
      owners,
      team: toRow(null, teamAcc, teamSnap),
    };
  }

  // ─────────────────────────── Meta mensual ───────────────────────────

  async getGoal(): Promise<{ monthly_goal: number | null }> {
    const row = await this.prisma.crmSetting.findUnique({ where: { key: 'goal' } });
    const cfg = (row?.config ?? {}) as { monthly_goal?: unknown };
    return { monthly_goal: typeof cfg.monthly_goal === 'number' ? cfg.monthly_goal : null };
  }

  async setGoal(input: { monthly_goal: number | null }) {
    await this.prisma.crmSetting.upsert({
      where: { key: 'goal' },
      create: { key: 'goal', config: input },
      update: { config: input },
    });
    return this.getGoal();
  }

  // ─────────────────────────── Señales + ICP ───────────────────────────

  /** Señales operativas (en riesgo / estancados / tareas vencidas) + ICP por industria y ciudad. */
  async crmInsights() {
    const [stages, leads, companies] = await Promise.all([
      this.prisma.pipelineStage.findMany({ select: { id: true, kind: true } }),
      this.prisma.lead.findMany({
        select: {
          id: true,
          company: true,
          owner: true,
          stage_id: true,
          estimated_value: true,
          stage_changed_at: true,
          company_id: true,
        },
      }),
      this.prisma.company.findMany({
        select: { id: true, industry: true, primary_location: true },
      }),
    ]);

    const closedSet = new Set(stages.filter((s) => isClosedKind(s.kind)).map((s) => s.id));
    const wonIds = new Set(stages.filter((s) => s.kind === 'WON').map((s) => s.id));
    const meta = await this.leadMeta(leads.map((l) => l.id));
    const now = Date.now();

    const atRisk: SignalLead[] = [];
    const stuck: SignalLead[] = [];
    for (const l of leads) {
      if (closedSet.has(l.stage_id)) continue;
      const dStage = Math.floor((now - l.stage_changed_at.getTime()) / DAY_MS);
      const h = computeLeadHealth(
        l.stage_changed_at,
        meta.lastActById.get(l.id) ?? null,
        l.owner,
        false,
      );
      if (h.band === 'at_risk') {
        atRisk.push({
          id: l.id,
          company: l.company,
          owner: l.owner,
          reason: h.reason,
          days: dStage,
        });
      }
      if (dStage >= STALLED_DAYS) {
        stuck.push({
          id: l.id,
          company: l.company,
          owner: l.owner,
          reason: `${dStage}d en esta etapa`,
          days: dStage,
        });
      }
    }
    const byDaysDesc = (a: SignalLead, b: SignalLead) => b.days - a.days;
    atRisk.sort(byDaysDesc);
    stuck.sort(byDaysDesc);

    const overdueRaw = await this.prisma.crmTask.findMany({
      where: { done: false, due_date: { lt: new Date() } },
      orderBy: { due_date: 'asc' },
      take: 15,
    });
    const labels = await this.entityLabels(overdueRaw);
    const overdue_tasks = overdueRaw.map((t) => ({
      id: t.id,
      title: t.title,
      due_date: t.due_date,
      entity_label: labels.get(`${t.entity_type}:${t.entity_id}`) ?? null,
      entity_type: t.entity_type,
      entity_id: t.entity_id,
      days_overdue: t.due_date ? Math.floor((now - t.due_date.getTime()) / DAY_MS) : 0,
    }));

    const companyById = new Map(companies.map((c) => [c.id, c]));
    return {
      signals: { at_risk: atRisk.slice(0, 10), stuck: stuck.slice(0, 10), overdue_tasks },
      icp_industry: this.aggregateIcp(leads, companyById, closedSet, wonIds, 'industry'),
      icp_city: this.aggregateIcp(
        leads,
        companyById,
        closedSet,
        wonIds,
        'primary_location',
        normalizeCity,
      ),
    };
  }

  private aggregateIcp(
    leads: { stage_id: string; estimated_value: number | null; company_id: string | null }[],
    companyById: Map<string, { industry: string | null; primary_location: string | null }>,
    closedSet: Set<string>,
    wonIds: Set<string>,
    field: 'industry' | 'primary_location',
    mapKey?: (v: string) => string | null,
  ) {
    const groups = new Map<
      string,
      { leads: number; won: number; closed: number; won_value: number }
    >();
    for (const l of leads) {
      const company = l.company_id ? companyById.get(l.company_id) : undefined;
      const raw = company?.[field]?.trim();
      const key = raw ? (mapKey ? mapKey(raw) : raw) : null;
      if (!key) continue;
      const g = groups.get(key) ?? { leads: 0, won: 0, closed: 0, won_value: 0 };
      g.leads += 1;
      if (closedSet.has(l.stage_id)) g.closed += 1;
      if (wonIds.has(l.stage_id)) {
        g.won += 1;
        g.won_value += l.estimated_value ?? 0;
      }
      groups.set(key, g);
    }
    return [...groups.entries()]
      .map(([key, g]) => ({
        key,
        leads: g.leads,
        won: g.won,
        won_value: g.won_value,
        win_rate: g.closed > 0 ? round2(g.won / g.closed) : null,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 8);
  }

  private async entityLabels(refs: { entity_type: string; entity_id: string }[]) {
    const ids = { lead: [] as string[], person: [] as string[], company: [] as string[] };
    for (const r of refs) {
      const bucket = ids[r.entity_type as keyof typeof ids];
      if (bucket) bucket.push(r.entity_id);
    }
    const [leads, people, companies] = await Promise.all([
      this.prisma.lead.findMany({
        where: { id: { in: ids.lead } },
        select: { id: true, company: true },
      }),
      this.prisma.person.findMany({
        where: { id: { in: ids.person } },
        select: { id: true, name: true },
      }),
      this.prisma.company.findMany({
        where: { id: { in: ids.company } },
        select: { id: true, name: true },
      }),
    ]);
    const labels = new Map<string, string>();
    for (const l of leads) labels.set(`lead:${l.id}`, l.company);
    for (const p of people) labels.set(`person:${p.id}`, p.name);
    for (const c of companies) labels.set(`company:${c.id}`, c.name);
    return labels;
  }
}

// ─────────────────────────── helpers ───────────────────────────

const DAY_MS = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Cadenas vacías → null, para que la base no acumule '' en columnas opcionales. */
function normalizeLead<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = v === '' ? null : v;
  return out as T;
}

// Personas asociadas del lead (ordenadas) para list/detail.
const LEAD_PERSONS_INCLUDE = {
  persons: {
    orderBy: { position: 'asc' as const },
    include: { person: { select: { id: true, name: true, email_addresses: true } } },
  },
};

type LeadWithPersons = {
  persons: { person: { id: string; name: string; email_addresses?: string[] } }[];
} & Record<string, unknown>;

/** Aplana las filas de la tabla de unión en `persons` + `person_ids`, que es lo que espera el cliente. */
export function shapeLead<T extends LeadWithPersons>(lead: T) {
  const { persons, ...rest } = lead;
  const refs = persons.map((lp) => lp.person);
  return { ...rest, persons: refs, person_ids: refs.map((p) => p.id) };
}

/** Filas ordenadas para la tabla de unión a partir de una lista de ids (sin duplicados). */
function leadPersonRows(personIds: string[] = []) {
  return [...new Set(personIds)].map((person_id, position) => ({ person_id, position }));
}

interface LeadMeta {
  notesById: Map<string, number>;
  lastActById: Map<string, Date | null>;
  nextTaskById: Map<string, { id: string; title: string; due_date: Date | null }>;
}
