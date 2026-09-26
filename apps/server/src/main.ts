import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import * as express from 'express';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { validateEnv } from './config/env.validation';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  validateEnv(process.env);

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(AppConfigService);

  // CORS antes de los parsers: un 413 del parser debe llegar al navegador con cabeceras CORS.
  app.enableCors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Team-Email',
      'X-Team-Name',
      'X-Impersonate-Role',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
    credentials: false,
    maxAge: 3600,
  });

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Un solo pipe de validación: los DTOs son `createZodDto(Schema)` del contrato.
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.listen(config.port, '0.0.0.0');
  logger.log(
    `CRM API escuchando en :${config.port} (env=${config.nodeEnv}, auth=${config.auth.enabled})`,
  );
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error fatal al arrancar:', err);
  process.exit(1);
});
