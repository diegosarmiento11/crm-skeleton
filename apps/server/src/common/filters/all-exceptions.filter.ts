import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Único filtro de errores. Los HttpException (negocio, validación Zod) salen con
 * su código y su mensaje; todo lo demás es un 500 con mensaje genérico hacia el
 * cliente y el detalle completo en el log. Aquí es donde se engancharía una
 * alerta (Slack, correo) para los ≥500: los servicios no capturan para loguear.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = isHttp ? exception.getResponse() : null;
    const message =
      typeof raw === 'string'
        ? raw
        : ((raw as { message?: unknown } | null)?.message ??
          (status >= 500 ? 'Error interno' : 'Solicitud inválida'));

    const err = exception as Error;
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status} ${err?.message ?? ''}`,
        err?.stack,
      );
    } else if (typeof raw !== 'string') {
      // 4xx con detalle (p. ej. Zod): se registra qué campo se rechazó sin
      // tener que reproducir la petición.
      this.logger.warn(`${request.method} ${request.url} → ${status} ${JSON.stringify(message)}`);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    });
  }
}
