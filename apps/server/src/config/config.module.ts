import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './config.service';
import { validateEnv } from './env.validation';

@Global()
@Module({
  providers: [
    {
      provide: AppConfigService,
      useFactory: () => new AppConfigService(validateEnv(process.env)),
    },
  ],
  exports: [AppConfigService],
})
export class AppConfigModule {}
