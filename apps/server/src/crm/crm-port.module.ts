import { Module } from '@nestjs/common';
import { CrmPortService } from './crm.port';

/**
 * `CrmPortService` vive en su propio módulo, separado de `CrmModule`, para que
 * `comments/` pueda consumirlo sin crear un ciclo: `CrmModule` importa
 * `CommentsModule` (para servir notas y tareas bajo /crm), así que si
 * `CommentsModule` importara `CrmModule` de vuelta el grafo se cerraría en
 * círculo. Este módulo solo depende de Prisma: es una hoja.
 */
@Module({
  providers: [CrmPortService],
  exports: [CrmPortService],
})
export class CrmPortModule {}
