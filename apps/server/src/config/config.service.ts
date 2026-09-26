import { Injectable } from '@nestjs/common';
import type { EnvVars } from './env.validation';

@Injectable()
export class AppConfigService {
  constructor(private readonly env: EnvVars) {}

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get nodeEnv(): EnvVars['NODE_ENV'] {
    return this.env.NODE_ENV;
  }

  get port(): number {
    return this.env.PORT;
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get corsOrigins(): string[] {
    return this.env.CORS_ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  get auth() {
    return {
      enabled: this.env.AUTH_ENABLED,
      teamEmailDomain: this.env.TEAM_EMAIL_DOMAIN,
    };
  }

  get jobs() {
    return { apiKey: this.env.JOBS_API_KEY };
  }
}
