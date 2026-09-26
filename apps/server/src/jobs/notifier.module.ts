import { Injectable, Logger, Module } from '@nestjs/common';
import { NOTIFIER, type Notification, type NotifierPort } from './notifier.port';

/** Implementación por defecto: deja la notificación en el log. */
@Injectable()
export class LogNotifier implements NotifierPort {
  private readonly logger = new Logger('Notifier');

  async notify(n: Notification): Promise<void> {
    const to = n.recipients.length ? n.recipients.join(', ') : 'equipo';
    this.logger.log(
      `[${n.type}] → ${to}${n.entity_label ? ` · ${n.entity_label}` : ''}: ${n.body.slice(0, 120)}`,
    );
  }
}

@Module({
  providers: [{ provide: NOTIFIER, useClass: LogNotifier }],
  exports: [NOTIFIER],
})
export class NotifierModule {}
