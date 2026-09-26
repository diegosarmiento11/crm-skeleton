import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

// Una línea por petición con id de correlación, método, ruta (sin query string:
// ahí pueden viajar secretos), estado y duración.
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const requestId = req.get('x-request-id') ?? randomUUID();
    const url = (req.originalUrl ?? req.url).split('?')[0];

    res.setHeader('x-request-id', requestId);
    const startedAt = Date.now();
    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log(
            `[${requestId}] ${req.method} ${url} ${res.statusCode} ${Date.now() - startedAt}ms`,
          ),
        error: (err: Error) =>
          this.logger.warn(
            `[${requestId}] ${req.method} ${url} falló: ${err.message} (${Date.now() - startedAt}ms)`,
          ),
      }),
    );
  }
}
