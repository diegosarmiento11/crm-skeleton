import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { NotifierModule } from './notifier.module';
import { JobsController } from './jobs.controller';
import { CrmDigestJob } from './crm-digest.job';

@Module({
  imports: [CrmModule, NotifierModule],
  controllers: [JobsController],
  providers: [CrmDigestJob],
})
export class JobsModule {}
