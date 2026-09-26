import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { TeamModule } from './team/team.module';
import { CommentsModule } from './comments/comments.module';
import { CrmModule } from './crm/crm.module';
import { JobsModule } from './jobs/jobs.module';

// Un módulo por dominio, registrado aquí. Cada uno es una carpeta con
// *.module.ts, *.controller.ts, *.service.ts, dto/ y sus *.spec.ts al lado.
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuthModule,
    TeamModule,
    CommentsModule,
    CrmModule,
    JobsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
