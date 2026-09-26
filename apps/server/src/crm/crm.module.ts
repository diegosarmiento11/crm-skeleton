import { Module } from '@nestjs/common';
import { CommentsModule } from '../comments/comments.module';
import { CrmPortModule } from './crm-port.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { PersonMatcherService } from './person-matcher.service';
import { EngagementController } from './engagement.controller';
import { ViewPrefsController } from './view-prefs.controller';

@Module({
  imports: [CommentsModule, CrmPortModule],
  controllers: [
    CrmController,
    CompaniesController,
    PeopleController,
    EngagementController,
    ViewPrefsController,
  ],
  providers: [CrmService, CompaniesService, PeopleService, PersonMatcherService],
  // Otro módulo consume el CRM por estos servicios (o por CrmPortService), nunca
  // importando archivos internos ni tocando sus tablas con Prisma.
  exports: [CrmService, CompaniesService, PeopleService, PersonMatcherService, CrmPortModule],
})
export class CrmModule {}
