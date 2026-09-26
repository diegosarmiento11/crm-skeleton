import { Injectable } from '@nestjs/common';
import type { Lead, Person, Prisma } from '@prisma/client';
import { isClosedKind, type ContactStatus } from '@crm/shared';
import { PrismaService } from '../prisma/prisma.service';

export type PersonWithCompany = Prisma.PersonGetPayload<{ include: { company: true } }>;

/** Referencia polimórfica a un registro del CRM (lead | person | company). */
export interface EntityRef {
  entity_type: string | null;
  entity_id: string | null;
}

export type PipelineOverview = {
  stages: { name: string; kind: string; leads: number; value: number }[];
  total_leads: number;
  total_value: number;
  by_owner: { owner: string; leads: number; value: number }[];
};

/**
 * Frontera del CRM hacia el resto del sistema: lo que otro módulo (un inbox, un
 * agente, un módulo de clientes) necesita saber o cambiar de un Lead/Person sin
 * tocar `prisma.lead|person|company` directamente.
 *
 * Existe para poder mover el CRM a su propio servicio o base de datos algún día
 * sin reescribir a quien lo consume: ese día, esta interfaz se implementa con un
 * cliente HTTP en vez de Prisma. Regla: si un módulo ajeno escribe en tablas del
 * CRM, pasa por aquí (o por el servicio exportado), nunca por Prisma directo.
 */
export interface CrmPort {
  findPersonById(id: string): Promise<Person | null>;
  /** Empareja por correo o teléfono exacto (`email_addresses` / `phone_numbers`). */
  findPersonByContact(contact: { email?: string; phone?: string }): Promise<Person | null>;
  /** Lote, con la empresa incluida: para personalizar un envío. */
  findPeopleByEmails(emails: string[]): Promise<PersonWithCompany[]>;
  /** Crea sin buscar primero (el llamador ya sabe que no existe). Sin nombre real. */
  createPersonFromEmail(email: string): Promise<PersonWithCompany>;
  /** Un sistema de envío marca DE_BAJA al recibir un rebote duro / queja. */
  updatePersonContactStatus(id: string, status: ContactStatus): Promise<void>;
  /** Responsable del lead más recientemente asociado a esta persona, si hay uno. */
  ownerForPerson(personId: string): Promise<string | null>;
  namesForPersonIds(ids: string[]): Promise<Map<string, string>>;

  findLeadById(id: string): Promise<Lead | null>;
  /** El negocio ganado más reciente de una empresa (para un módulo de clientes). */
  findWonDealForCompany(
    companyId: string,
  ): Promise<{ estimated_value: number; company_name: string } | null>;

  pipelineOverview(): Promise<PipelineOverview>;

  /** Etiqueta para mostrar por referencia polimórfica (notas, tareas, notificaciones). */
  labelsFor(refs: EntityRef[]): Promise<Map<string, string>>;
}

@Injectable()
export class CrmPortService implements CrmPort {
  constructor(private readonly prisma: PrismaService) {}

  findPersonById(id: string): Promise<Person | null> {
    return this.prisma.person.findUnique({ where: { id } });
  }

  findPersonByContact(contact: { email?: string; phone?: string }): Promise<Person | null> {
    if (contact.email) {
      return this.prisma.person.findFirst({
        where: { email_addresses: { has: contact.email.toLowerCase() } },
      });
    }
    if (contact.phone) {
      return this.prisma.person.findFirst({ where: { phone_numbers: { has: contact.phone } } });
    }
    return Promise.resolve(null);
  }

  findPeopleByEmails(emails: string[]): Promise<PersonWithCompany[]> {
    if (emails.length === 0) return Promise.resolve([]);
    return this.prisma.person.findMany({
      where: { email_addresses: { hasSome: emails.map((e) => e.toLowerCase()) } },
      include: { company: true },
    });
  }

  createPersonFromEmail(email: string): Promise<PersonWithCompany> {
    // Sin nombre real se deja VACÍO (no el correo): así una plantilla que salude
    // por {{name}} no termina diciendo "Hola foo@bar.com".
    return this.prisma.person.create({
      data: { name: '', email_addresses: [email.toLowerCase()], phone_numbers: [] },
      include: { company: true },
    });
  }

  async updatePersonContactStatus(id: string, status: ContactStatus): Promise<void> {
    await this.prisma.person.update({ where: { id }, data: { contact_status: status } });
  }

  async ownerForPerson(personId: string): Promise<string | null> {
    const link = await this.prisma.leadPerson.findFirst({
      where: { person_id: personId },
      orderBy: { lead: { updated_at: 'desc' } },
      include: { lead: { select: { owner: true } } },
    });
    return link?.lead?.owner ?? null;
  }

  async namesForPersonIds(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const people = await this.prisma.person.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(people.map((p) => [p.id, p.name]));
  }

  findLeadById(id: string): Promise<Lead | null> {
    return this.prisma.lead.findUnique({ where: { id } });
  }

  async findWonDealForCompany(
    companyId: string,
  ): Promise<{ estimated_value: number; company_name: string } | null> {
    const lead = await this.prisma.lead.findFirst({
      where: { company_id: companyId, estimated_value: { not: null }, stage: { kind: 'WON' } },
      orderBy: { stage_changed_at: 'desc' },
      select: { estimated_value: true, company: true },
    });
    if (!lead || lead.estimated_value == null) return null;
    return { estimated_value: lead.estimated_value, company_name: lead.company };
  }

  async pipelineOverview(): Promise<PipelineOverview> {
    const [stages, byStage, byOwner, totals] = await Promise.all([
      this.prisma.pipelineStage.findMany({
        orderBy: { position: 'asc' },
        select: { id: true, name: true, kind: true },
      }),
      this.prisma.lead.groupBy({
        by: ['stage_id'],
        _count: { _all: true },
        _sum: { estimated_value: true },
      }),
      this.prisma.lead.groupBy({
        by: ['owner'],
        _count: { _all: true },
        _sum: { estimated_value: true },
      }),
      this.prisma.lead.aggregate({ _count: { _all: true }, _sum: { estimated_value: true } }),
    ]);
    const countByStage = new Map(byStage.map((s) => [s.stage_id, s]));
    return {
      stages: stages.map((s) => ({
        name: s.name,
        kind: s.kind,
        leads: countByStage.get(s.id)?._count._all ?? 0,
        value: countByStage.get(s.id)?._sum.estimated_value ?? 0,
      })),
      total_leads: totals._count._all,
      total_value: totals._sum.estimated_value ?? 0,
      by_owner: byOwner.map((o) => ({
        owner: o.owner ?? 'Sin responsable',
        leads: o._count._all,
        value: o._sum.estimated_value ?? 0,
      })),
    };
  }

  async labelsFor(refs: EntityRef[]): Promise<Map<string, string>> {
    const ids = { lead: [] as string[], person: [] as string[], company: [] as string[] };
    for (const r of refs) {
      const bucket = ids[r.entity_type as keyof typeof ids];
      if (bucket && r.entity_id) bucket.push(r.entity_id);
    }
    const labels = new Map<string, string>();
    if (!ids.lead.length && !ids.person.length && !ids.company.length) return labels;

    const [leads, people, companies] = await Promise.all([
      ids.lead.length
        ? this.prisma.lead.findMany({
            where: { id: { in: ids.lead } },
            select: { id: true, company: true },
          })
        : [],
      ids.person.length
        ? this.prisma.person.findMany({
            where: { id: { in: ids.person } },
            select: { id: true, name: true },
          })
        : [],
      ids.company.length
        ? this.prisma.company.findMany({
            where: { id: { in: ids.company } },
            select: { id: true, name: true },
          })
        : [],
    ]);
    for (const l of leads) labels.set(`lead:${l.id}`, l.company);
    for (const p of people) labels.set(`person:${p.id}`, p.name);
    for (const c of companies) labels.set(`company:${c.id}`, c.name);
    return labels;
  }
}

/** Reexportado para que quien use el puerto no importe @crm/shared solo por esto. */
export { isClosedKind };
