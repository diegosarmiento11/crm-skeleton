import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { IDENTITY_PROVIDER } from './identity.port';
import { HeaderIdentityProvider, UnconfiguredIdentityProvider } from './header-identity.provider';
import { TeamGuard } from '../common/guards/team.guard';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { MeController } from './me.controller';

/**
 * Registra el IdentityProvider y los guards. Para conectar un proveedor real
 * (Firebase, Auth0, JWT propio…): implementa `IdentityProvider` y cámbialo en la
 * factoría de abajo cuando `AUTH_ENABLED=true`. Nada más del CRM cambia.
 */
@Global()
@Module({
  controllers: [MeController],
  providers: [
    {
      provide: IDENTITY_PROVIDER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        config.auth.enabled ? new UnconfiguredIdentityProvider() : new HeaderIdentityProvider(),
    },
    TeamGuard,
    ApiKeyGuard,
  ],
  exports: [IDENTITY_PROVIDER, TeamGuard, ApiKeyGuard],
})
export class AuthModule {}
