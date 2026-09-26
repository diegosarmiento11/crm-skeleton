import { Module } from '@nestjs/common';
import { CrmPortModule } from '../crm/crm-port.module';
import { NotifierModule } from '../jobs/notifier.module';
import { CommentsService } from './comments.service';

/**
 * Notas y tareas de seguimiento sobre cualquier entidad. Vive fuera de `crm/`
 * aunque hoy solo el CRM lo use: así otro módulo puede colgar comentarios de sus
 * entidades sin depender del CRM.
 *
 * Importa `CrmPortModule` (no `CrmModule`) para la etiqueta del registro y el
 * responsable del lead: `CrmModule` importa `CommentsModule`, así que importar
 * `CrmModule` de vuelta cerraría el grafo en círculo. `CrmPortModule` es una hoja.
 */
@Module({
  imports: [CrmPortModule, NotifierModule],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
