import { Inject, Injectable, Logger } from '@nestjs/common';
import { CrmService } from '../crm/crm.service';
import { NOTIFIER, type NotifierPort } from './notifier.port';

/**
 * Digest del CRM: resumen corto de las señales operativas (leads en riesgo,
 * estancados, tareas vencidas) para el canal del equipo. Pensado para correr una
 * vez al día desde un programador externo (cron, Cloud Scheduler) vía
 * POST /api/v1/jobs/crm-digest. Idempotente: correrlo dos veces manda dos
 * mensajes iguales, nunca cambia datos.
 */
@Injectable()
export class CrmDigestJob {
  private readonly logger = new Logger(CrmDigestJob.name);

  constructor(
    private readonly crm: CrmService,
    @Inject(NOTIFIER) private readonly notifier: NotifierPort,
  ) {}

  async run(): Promise<{ status: 'success'; meta: Record<string, number> }> {
    const { signals } = await this.crm.crmInsights();
    const { at_risk, stuck, overdue_tasks } = signals;

    const top = (items: { company: string; reason: string }[]) =>
      items
        .slice(0, 5)
        .map((l) => `   · ${l.company} (${l.reason})`)
        .join('\n');

    const lines = [
      '📊 Digest CRM',
      `🔴 En riesgo: ${at_risk.length}`,
      at_risk.length ? top(at_risk) : null,
      `🟠 Estancados: ${stuck.length}`,
      stuck.length ? top(stuck) : null,
      `⏰ Tareas vencidas: ${overdue_tasks.length}`,
      overdue_tasks.length
        ? overdue_tasks
            .slice(0, 5)
            .map(
              (t) =>
                `   · ${t.title}${t.entity_label ? ` — ${t.entity_label}` : ''} (${t.days_overdue}d)`,
            )
            .join('\n')
        : null,
    ].filter((l): l is string => Boolean(l));

    await this.notifier.notify({ type: 'digest', recipients: [], body: lines.join('\n') });
    const meta = { at_risk: at_risk.length, stuck: stuck.length, overdue: overdue_tasks.length };
    this.logger.log(`Digest enviado ${JSON.stringify(meta)}`);
    return { status: 'success', meta };
  }
}
