import { Injectable, Logger } from '@nestjs/common';
import { corporateDomainFromEmail, normalizeDomain } from '@crm/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Enlaza personas SIN empresa a la Company cuyo `domain` coincide con el dominio
 * corporativo de alguno de sus correos. Solo enlaza cuando el dominio identifica
 * a UNA sola empresa (si hay varias, se salta: eso es material de revisión
 * humana). Un dominio de webmail (gmail, hotmail…) nunca cuenta.
 *
 * `matchByDomain` es el barrido (idempotente, se puede correr cuando sea);
 * `companyForEmails` es la versión puntual que usa el alta/edición de una persona.
 */
@Injectable()
export class PersonMatcherService {
  private readonly logger = new Logger(PersonMatcherService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Id de la única empresa cuyo dominio coincide con alguno de los correos, o null. */
  async companyForEmails(emails: string[] | undefined): Promise<string | null> {
    const domains = [
      ...new Set(
        (emails ?? []).map(corporateDomainFromEmail).filter((d): d is string => Boolean(d)),
      ),
    ];
    for (const domain of domains) {
      const id = await this.resolveDomain(domain);
      if (id) return id;
    }
    return null;
  }

  private async resolveDomain(domain: string): Promise<string | null> {
    const matches = await this.prisma.company.findMany({
      where: { domain: { equals: domain, mode: 'insensitive' } },
      select: { id: true, domain: true },
      take: 2,
    });
    // Doble guardia: aunque alguien haya guardado una empresa con dominio público,
    // nunca es objetivo válido.
    const valid = matches.filter((m) => normalizeDomain(m.domain) === domain);
    return valid.length === 1 ? valid[0].id : null;
  }

  async matchByDomain(
    limit = 2000,
  ): Promise<{ scanned: number; linked: number; ambiguous: number }> {
    const people = await this.prisma.person.findMany({
      where: { company_id: null, NOT: { email_addresses: { isEmpty: true } } },
      select: { id: true, email_addresses: true },
      take: limit,
    });

    const cache = new Map<string, string | null>();
    let linked = 0;
    let ambiguous = 0;
    for (const p of people) {
      const domains = [
        ...new Set(
          p.email_addresses.map(corporateDomainFromEmail).filter((d): d is string => Boolean(d)),
        ),
      ];
      let companyId: string | null = null;
      for (const d of domains) {
        if (!cache.has(d)) cache.set(d, await this.resolveDomain(d));
        companyId = cache.get(d) ?? null;
        if (companyId) break;
      }
      if (companyId) {
        await this.prisma.person.update({ where: { id: p.id }, data: { company_id: companyId } });
        linked++;
      } else if (domains.length) {
        ambiguous++; // tenía dominio corporativo pero sin match único
      }
    }
    if (linked)
      this.logger.log(`${linked} persona(s) enlazadas por dominio (${people.length} sin empresa)`);
    return { scanned: people.length, linked, ambiguous };
  }
}
