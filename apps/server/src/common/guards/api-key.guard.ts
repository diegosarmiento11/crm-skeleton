import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import type { Request } from 'express';
import { AppConfigService } from '../../config/config.service';

/**
 * Guard para máquinas (jobs programados, integraciones): clave compartida en la
 * cabecera `X-Jobs-Key`, comparada en tiempo constante. No adjunta identidad de
 * persona: lo que se haga con este guard se atribuye al sistema.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.get('x-jobs-key');
    if (!provided) throw new UnauthorizedException('Falta X-Jobs-Key');
    const a = Buffer.from(provided);
    const b = Buffer.from(this.config.jobs.apiKey);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Clave inválida');
    }
    return true;
  }
}
