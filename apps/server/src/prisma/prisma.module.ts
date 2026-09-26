import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global: todo módulo puede inyectar PrismaService sin importar PrismaModule.
// Lo que NO es global es el permiso de tocar tablas de otro dominio: eso pasa
// por el servicio exportado del módulo dueño (o por su puerto).
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
