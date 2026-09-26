import { Injectable, NotFoundException } from '@nestjs/common';
import {
  TOUCHPOINT_KINDS,
  cargoGroup,
  formatPersonName,
  isAllCaps,
  normalizeCity,
  normalizeSource,
  type CreatePersonInput,
  type UpdatePersonInput,
} from '@crm/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parsePeopleCsv } from './people-csv.parser';
import { PersonMatcherService } from './person-matcher.service';
import { shapeLead } from './crm.service';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const MAX_FACETS = 300;

interface PeopleFilters {
  q?: string;
  companyId?: string;
  source?: string[];
  location?: string[];
  cargo?: string[];
  industry?: string[];
  /** 'yes' = tiene al menos un punto de contacto registrado; 'no' = ninguno. */
  contacted?: 'yes' | 'no';
  page?: number;
  limit?: number;
}

@Injectable()
export class PeopleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matcher: PersonMatcherService,
  ) {}

  /**
   * Importa un CSV de personas. Dedup por correo: si ya existe una persona con
   * ese correo se salta (no se pisa lo que el equipo ya editó). Las filas sin
   * correo no se importan: no hay llave de dedup ni canal de contacto. Al final,
   * un barrido enlaza las recién creadas a su empresa por dominio.
   */
  async importCsv(buffer: Buffer, source = 'importacion') {
    const rows = parsePeopleCsv(buffer);
    const withEmail = rows.filter((g) => g.email);
    const emails = [...new Set(withEmail.map((g) => g.email as string))];

    const existing = new Set<string>();
    if (emails.length) {
      const found = await this.prisma.person.findMany({
        where: { email_addresses: { hasSome: emails } },
        select: { email_addresses: true },
      });
      for (const r of found) for (const e of r.email_addresses) existing.add(e.toLowerCase());
    }

    let created = 0;
    let skipped = 0;
    const seen = new Set<string>();
    for (const g of withEmail) {
      const email = g.email as string;
      if (existing.has(email) || seen.has(email)) {
        skipped++;
        continue;
      }
      seen.add(email);
      await this.prisma.person.create({
        data: {
          name: formatPersonName(g.name),
          source: normalizeSource(source),
          job_title: g.job_title,
          email_addresses: [email],
          phone_numbers: g.phone ? [g.phone] : [],
        },
      });
      created++;
    }
    const matched = await this.matcher.matchByDomain().catch(() => ({ linked: 0 }));
    return { total: rows.length, created, skipped, linked: matched.linked };
  }

  /**
   * Backfill de formato de nombres: SOLO los que están en MAYÚSCULA sostenida
   * (típicos de importaciones) pasan a Title Case. Idempotente.
   */
  async formatNames(): Promise<{ scanned: number; updated: number }> {
    const people = await this.prisma.person.findMany({ select: { id: true, name: true } });
    let updated = 0;
    for (const p of people) {
      if (!isAllCaps(p.name)) continue;
      const formatted = formatPersonName(p.name);
      if (formatted && formatted !== p.name) {
        await this.prisma.person.update({ where: { id: p.id }, data: { name: formatted } });
        updated++;
      }
    }
    return { scanned: people.length, updated };
  }

  /**
   * Ids de personas "contactadas" = con al menos un punto de contacto registrado
   * (nota de tipo email/whatsapp/call). Misma señal que pinta "Última interacción".
   */
  private async contactedPersonIds(): Promise<string[]> {
    const rows = await this.prisma.crmNote.groupBy({
      by: ['entity_id'],
      where: { entity_type: 'person', kind: { in: [...TOUCHPOINT_KINDS] } },
    });
    return rows.map((r) => r.entity_id);
  }

  /**
   * Índice ligero de TODAS las personas con sus atributos facetables. Cargo
   * (familia) e industria (heredada de la empresa) son derivados, así que se
   * calculan en JS: así las facetas cuentan sobre el total y el filtrado es exacto.
   */
  private async facetIndex() {
    const [persons, contactedIds] = await Promise.all([
      this.prisma.person.findMany({
        select: {
          id: true,
          job_title: true,
          industry: true,
          source: true,
          primary_location: true,
          company: { select: { industry: true } },
        },
      }),
      this.contactedPersonIds(),
    ]);
    const contacted = new Set(contactedIds);
    return persons.map((p) => ({
      id: p.id,
      cargo: cargoGroup(p.job_title),
      industry: p.industry?.trim() || p.company?.industry?.trim() || null,
      source: p.source ?? 'none',
      location: p.primary_location ?? null,
      contacted: contacted.has(p.id),
    }));
  }

  /**
   * Valores distintos para los filtros + conteos CONTEXTUALES: cada faceta cuenta
   * sobre las personas que pasan los OTROS filtros activos (excluye su propia
   * dimensión, para poder alternar valores dentro de ella).
   */
  async facets(filters: Omit<PeopleFilters, 'q' | 'companyId' | 'page' | 'limit'> = {}) {
    const rows = await this.facetIndex();
    type Row = (typeof rows)[number];

    const sourceSet = filters.source?.length ? new Set(filters.source) : null;
    const locationSet = filters.location?.length ? new Set(filters.location) : null;
    const cargoSet = filters.cargo?.length ? new Set(filters.cargo) : null;
    const industrySet = filters.industry?.length ? new Set(filters.industry) : null;
    const contacted = filters.contacted;

    const mSource = (r: Row) => !sourceSet || sourceSet.has(r.source);
    const mLocation = (r: Row) =>
      !locationSet || (r.location != null && locationSet.has(r.location));
    const mCargo = (r: Row) => !cargoSet || cargoSet.has(r.cargo);
    const mIndustry = (r: Row) =>
      !industrySet || (r.industry != null && industrySet.has(r.industry));
    const mContacted = (r: Row) => !contacted || (contacted === 'yes' ? r.contacted : !r.contacted);

    const tally = (sel: (r: Row) => string | null, pred: (r: Row) => boolean) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        if (!pred(r)) continue;
        const v = sel(r);
        if (v == null) continue;
        m.set(v, (m.get(v) ?? 0) + 1);
      }
      return [...m.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_FACETS);
    };

    let sinContacto = 0;
    let contactado = 0;
    for (const r of rows) {
      if (!(mSource(r) && mLocation(r) && mCargo(r) && mIndustry(r))) continue;
      if (r.contacted) contactado++;
      else sinContacto++;
    }

    return {
      contact: [
        { value: 'Sin contacto', count: sinContacto },
        { value: 'Contactado', count: contactado },
      ],
      sources: tally(
        (r) => r.source,
        (r) => mLocation(r) && mCargo(r) && mIndustry(r) && mContacted(r),
      ),
      locations: tally(
        (r) => r.location,
        (r) => mSource(r) && mCargo(r) && mIndustry(r) && mContacted(r),
      ),
      cargos: tally(
        (r) => r.cargo,
        (r) => mSource(r) && mLocation(r) && mIndustry(r) && mContacted(r),
      ),
      industries: tally(
        (r) => r.industry,
        (r) => mSource(r) && mLocation(r) && mCargo(r) && mContacted(r),
      ),
    };
  }

  private async whereFor(filters: PeopleFilters): Promise<Prisma.PersonWhereInput> {
    const and: Prisma.PersonWhereInput[] = [];
    if (filters.companyId) and.push({ company_id: filters.companyId });
    if (filters.location?.length) and.push({ primary_location: { in: filters.location } });
    if (filters.source?.length) {
      const wantsNone = filters.source.includes('none');
      const named = filters.source.filter((s) => s !== 'none');
      const or: Prisma.PersonWhereInput[] = [];
      if (named.length) or.push({ source: { in: named } });
      if (wantsNone) or.push({ source: null });
      if (or.length) and.push({ OR: or });
    }
    // Cargo (familia) e industria efectiva son derivados: se resuelven a un set de
    // ids sobre el índice completo y se añaden como restricción a la query.
    if (filters.cargo?.length || filters.industry?.length) {
      const index = await this.facetIndex();
      const cargoSet = filters.cargo?.length ? new Set(filters.cargo) : null;
      const industrySet = filters.industry?.length ? new Set(filters.industry) : null;
      const ids = index
        .filter(
          (r) =>
            (!cargoSet || cargoSet.has(r.cargo)) &&
            (!industrySet || (r.industry != null && industrySet.has(r.industry))),
        )
        .map((r) => r.id);
      and.push({ id: { in: ids } });
    }
    if (filters.contacted === 'yes' || filters.contacted === 'no') {
      const contacted = await this.contactedPersonIds();
      and.push(
        filters.contacted === 'yes' ? { id: { in: contacted } } : { id: { notIn: contacted } },
      );
    }
    if (filters.q?.trim()) {
      const q = filters.q.trim();
      // `email_addresses` es text[]: para buscar substring dentro del arreglo
      // hace falta SQL crudo (taggeado, parámetros escapados por Prisma).
      const like = `%${escapeLike(q)}%`;
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "people"
        WHERE name ILIKE ${like}
           OR EXISTS (SELECT 1 FROM unnest(email_addresses) AS e WHERE e ILIKE ${like})
        LIMIT 500
      `;
      and.push({ id: { in: rows.map((r) => r.id) } });
    }
    return and.length ? { AND: and } : {};
  }

  async list(filters: PeopleFilters) {
    const limit = Math.min(Math.max(filters.limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const page = Math.max(filters.page || 1, 1);
    const where = await this.whereFor(filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.person.findMany({
        where,
        // Más nuevas arriba: al filtrar "sin contacto" quedan primero las últimas en llegar.
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { company: { select: { id: true, name: true, industry: true } } },
      }),
      this.prisma.person.count({ where }),
    ]);
    return { items: await this.withLastTouch(items), total, page, limit };
  }

  /** Anota cada persona con su último punto de contacto registrado. */
  private async withLastTouch<T extends { id: string }>(items: T[]) {
    if (items.length === 0) return items;
    const notes = await this.prisma.crmNote.findMany({
      where: {
        entity_type: 'person',
        entity_id: { in: items.map((p) => p.id) },
        kind: { in: [...TOUCHPOINT_KINDS] },
      },
      orderBy: { created_at: 'desc' },
      distinct: ['entity_id'],
      select: { entity_id: true, kind: true, created_at: true },
    });
    const byPerson = new Map(notes.map((n) => [n.entity_id, n]));
    return items.map((p) => {
      const n = byPerson.get(p.id);
      return { ...p, last_touch_at: n?.created_at ?? null, last_touch_kind: n?.kind ?? null };
    });
  }

  async get(id: string) {
    const person = await this.prisma.person.findUnique({
      where: { id },
      include: {
        company: true,
        lead_links: {
          orderBy: { lead: { updated_at: 'desc' } },
          include: {
            lead: {
              include: {
                persons: {
                  orderBy: { position: 'asc' },
                  include: { person: { select: { id: true, name: true, email_addresses: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!person) throw new NotFoundException('Persona no encontrada');
    const { lead_links, ...rest } = person;
    return { ...rest, leads: lead_links.map(({ lead }) => shapeLead(lead)) };
  }

  async create(data: CreatePersonInput) {
    const norm = normalize(data);
    // Auto-asociar a una empresa por el dominio corporativo del correo si no se indicó una.
    if (!norm.company_id) {
      const cid = await this.matcher.companyForEmails(norm.email_addresses as string[] | undefined);
      if (cid) norm.company_id = cid;
    }
    return this.prisma.person.create({ data: norm });
  }

  async update(id: string, data: UpdatePersonInput) {
    const existing = await this.ensure(id);
    const norm = normalize(data);
    // Solo se auto-asocia si el usuario NO tocó la empresa en esta edición y la
    // persona aún no tiene una: una asociación (o desasociación) manual siempre gana.
    const touchesCompany = 'company_id' in norm;
    if (!touchesCompany && !existing.company_id) {
      const emails = (
        'email_addresses' in norm ? norm.email_addresses : existing.email_addresses
      ) as string[] | undefined;
      const cid = await this.matcher.companyForEmails(emails);
      if (cid) norm.company_id = cid;
    }
    return this.prisma.person.update({ where: { id }, data: norm });
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.$transaction([
      this.prisma.crmNote.deleteMany({ where: { entity_type: 'person', entity_id: id } }),
      this.prisma.crmTask.deleteMany({ where: { entity_type: 'person', entity_id: id } }),
      this.prisma.person.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  private async ensure(id: string) {
    const p = await this.prisma.person.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Persona no encontrada');
    return p;
  }
}

/** Cadenas vacías → null; ciudad canónica; origen a slug; correos en minúscula. */
function normalize<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = v === '' ? null : v;
  if (typeof out.primary_location === 'string')
    out.primary_location = normalizeCity(out.primary_location);
  if (typeof out.source === 'string') out.source = normalizeSource(out.source);
  if (Array.isArray(out.email_addresses)) {
    out.email_addresses = (out.email_addresses as string[]).map((e) => e.trim().toLowerCase());
  }
  return out as T;
}

/** Escapa los comodines de LIKE en el término del usuario: `%`, `_` y `\`. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}
