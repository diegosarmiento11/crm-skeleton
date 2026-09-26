import { Injectable, NotFoundException } from '@nestjs/common';
import {
  normalizeCity,
  normalizeDomain,
  normalizeSource,
  type CreateCompanyInput,
  type UpdateCompanyInput,
} from '@crm/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { shapeLead } from './crm.service';

interface CompanyFilters {
  q?: string;
  industry?: string[];
  city?: string[];
  source?: string[]; // valores crudos de source; 'none' = sin origen
  domain?: string[]; // 'with' (tiene dominio) | 'without'
  page?: number;
  limit?: number;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const MAX_FACETS = 300; // corta la cola de valores raros en los filtros

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filters: CompanyFilters): Prisma.CompanyWhereInput {
    const and: Prisma.CompanyWhereInput[] = [];
    if (filters.q) and.push({ name: { contains: filters.q, mode: 'insensitive' } });
    if (filters.industry?.length) and.push({ industry: { in: filters.industry } });
    if (filters.city?.length) and.push({ primary_location: { in: filters.city } });
    if (filters.source?.length) {
      const wantsNone = filters.source.includes('none');
      const named = filters.source.filter((s) => s !== 'none');
      const or: Prisma.CompanyWhereInput[] = [];
      if (named.length) or.push({ source: { in: named } });
      if (wantsNone) or.push({ source: null });
      if (or.length) and.push({ OR: or });
    }
    if (filters.domain?.length) {
      const or: Prisma.CompanyWhereInput[] = [];
      if (filters.domain.includes('with'))
        or.push({ AND: [{ domain: { not: null } }, { domain: { not: '' } }] });
      if (filters.domain.includes('without')) or.push({ OR: [{ domain: null }, { domain: '' }] });
      if (or.length) and.push({ OR: or });
    }
    return and.length ? { AND: and } : {};
  }

  /** Listado paginado y filtrado en SQL: nunca se carga la tabla entera en memoria. */
  async list(filters: CompanyFilters = {}) {
    const limit = Math.min(Math.max(filters.limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const page = Math.max(filters.page || 1, 1);
    const where = this.buildWhere(filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.company.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /** Valores distintos (con conteo) para poblar los filtros sin cargar todas las filas. */
  async facets() {
    const [industries, locations, sources, withDomain, total] = await Promise.all([
      this.prisma.company.groupBy({
        by: ['industry'],
        where: { industry: { not: null } },
        _count: true,
      }),
      this.prisma.company.groupBy({
        by: ['primary_location'],
        where: { primary_location: { not: null } },
        _count: true,
      }),
      this.prisma.company.groupBy({ by: ['source'], _count: true }),
      this.prisma.company.count({
        where: { AND: [{ domain: { not: null } }, { domain: { not: '' } }] },
      }),
      this.prisma.company.count(),
    ]);
    const top = (rows: { value: string; count: number }[]) =>
      rows.sort((a, b) => b.count - a.count).slice(0, MAX_FACETS);
    return {
      industries: top(industries.map((r) => ({ value: r.industry as string, count: r._count }))),
      locations: top(
        locations.map((r) => ({ value: r.primary_location as string, count: r._count })),
      ),
      sources: sources
        .map((r) => ({ value: r.source ?? 'none', count: r._count }))
        .sort((a, b) => b.count - a.count),
      domain: [
        { value: 'with', count: withDomain },
        { value: 'without', count: total - withDomain },
      ],
    };
  }

  async get(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        people: {
          orderBy: { name: 'asc' },
          select: { id: true, name: true, job_title: true, email_addresses: true },
        },
        leads: {
          orderBy: { updated_at: 'desc' },
          include: {
            persons: {
              orderBy: { position: 'asc' },
              include: { person: { select: { id: true, name: true, email_addresses: true } } },
            },
          },
        },
      },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    const { leads, ...rest } = company;
    return { ...rest, leads: leads.map((l) => shapeLead(l)) };
  }

  create(data: CreateCompanyInput) {
    return this.prisma.company.create({ data: normalize(data) });
  }

  async update(id: string, data: UpdateCompanyInput) {
    await this.ensure(id);
    return this.prisma.company.update({ where: { id }, data: normalize(data) });
  }

  async remove(id: string) {
    await this.ensure(id);
    // Las personas y los leads quedan (FK SetNull); las notas y tareas de la
    // empresa no tienen FK y se limpian en la misma transacción.
    await this.prisma.$transaction([
      this.prisma.crmNote.deleteMany({ where: { entity_type: 'company', entity_id: id } }),
      this.prisma.crmTask.deleteMany({ where: { entity_type: 'company', entity_id: id } }),
      this.prisma.company.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  private async ensure(id: string) {
    const c = await this.prisma.company.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Empresa no encontrada');
    return c;
  }
}

/**
 * Cadenas vacías → null; ciudad canónica; origen a slug; dominio a solo host y
 * correos en minúscula. Todo lo que el filtro y el matcher comparan se guarda
 * ya normalizado: así no hay que normalizar al consultar.
 */
function normalize<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = v === '' ? null : v;
  if (typeof out.primary_location === 'string')
    out.primary_location = normalizeCity(out.primary_location);
  if (typeof out.source === 'string') out.source = normalizeSource(out.source);
  if (typeof out.domain === 'string') out.domain = normalizeDomain(out.domain);
  if (Array.isArray(out.email_addresses)) {
    out.email_addresses = (out.email_addresses as string[]).map((e) => e.trim().toLowerCase());
  }
  return out as T;
}
