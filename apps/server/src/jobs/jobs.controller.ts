import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { CrmDigestJob } from './crm-digest.job';

// Jobs: los dispara una máquina (cron), no una persona. Por eso llevan ApiKeyGuard
// y no TeamGuard. Cada job devuelve un resumen con conteos y es idempotente.
@Controller('api/v1/jobs')
@UseGuards(ApiKeyGuard)
export class JobsController {
  constructor(private readonly crmDigest: CrmDigestJob) {}

  @Post('crm-digest')
  crmDigestRun() {
    return this.crmDigest.run();
  }
}
