---
name: crm-api
description: Reglas para escribir o cambiar un endpoint, servicio, guard o job del servidor NestJS del CRM (apps/server). Cárgala antes de tocar un controlador, un servicio, un job de src/jobs, un guard o cualquier consulta Prisma. Cubre guards por área y rol, DTOs Zod desde el contrato, transacciones, el log de etapas, paginación, errores y cómo se prueba.
---

# API del servidor

Monolito NestJS 10 con un módulo por dominio bajo `apps/server/src/`, registrados en
`app.module.ts`. Cada módulo es una carpeta con `*.module.ts`, `*.controller.ts`, `*.service.ts`,
`dto/` y sus `*.spec.ts` al lado. Hoy: `auth`, `team`, `crm`, `comments`, `jobs`, `health`.

## 1. Un endpoint nuevo, en orden

1. **El contrato primero.** El schema Zod del body y del response nacen en
   `packages/shared/src/schemas/<dominio>.schema.ts` y se exportan desde `src/index.ts` con su
   tipo. Carga `crm-shared`.
2. **El DTO** en `dto/<dominio>.dto.ts`: `export class CreateXDto extends createZodDto(CreateXSchema) {}`.
   El `ZodValidationPipe` global valida solo; nada de `class-validator`.
3. **El controlador** declara ruta `api/v1/<dominio>/...`, guard y área **a nivel de clase**:

   ```ts
   @Controller('api/v1/crm/companies')
   @UseGuards(TeamGuard)
   @RequireArea('crm')
   export class CompaniesController { … }
   ```

   Las acciones de dirección llevan además `@RequireRole('GERENTE')` por método: analítica del
   embudo, crear/editar/borrar etapas, fijar la meta, administrar el equipo. La matriz
   rol→áreas es `ROLE_AREAS` en `packages/shared/src/enums`; **no se replica** en un guard.
   Las rutas fijas (`facets`, `reorder`, `pending`) van declaradas **antes** de `:id`.
4. **El servicio** recibe tipos del contrato, habla con Prisma y devuelve el shape del contrato.
   Nada de lógica en el controlador más allá de parsear `@Query` (multi-valor separado por coma,
   con `splitCsv`).
5. **La prueba** `*.spec.ts` al lado, con Prisma sustituido por `jest.fn()`.

## 2. Guards: quién entra

| Guard | Audiencia | Adjunta | Regla |
|---|---|---|---|
| `TeamGuard` | el equipo | `req.teamUser` | siempre con `@RequireArea`. Sin área, cualquier `PENDIENTE` entra (solo `/me` lo permite a propósito) |
| `ApiKeyGuard` | máquinas (`X-Jobs-Key`) | nada | comparación en tiempo constante; solo bajo `/api/v1/jobs` |

Un controlador sin guard es público. Si de verdad debe serlo (`/health`), lo dice en un comentario.

**Identidad ≠ autorización.** Quién eres lo resuelve el `IdentityProvider`
(`auth/identity.port.ts`); qué puedes hacer lo deciden `team_users` + `ROLE_AREAS`. Para
conectar Firebase, Auth0 o un JWT propio se implementa el puerto y se registra en `AuthModule`;
ningún controlador cambia. El seam `X-Team-Email` vive SOLO en `HeaderIdentityProvider`
(`AUTH_ENABLED=false`) y `validateEnv` impide esa combinación en producción.

**Impersonación** (`X-Impersonate-Role`): cambia solo el rol, nunca la identidad, y solo la puede
pedir un GERENTE. Sirve para ver la app como otro rol.

## 3. Datos

- **Escrituras relacionadas van juntas**: `prisma.$transaction(async (tx) => { … })`. Lead +
  `LeadStageEvent` + personas; mover un lead (re-secuenciar + evento); borrar un registro + sus
  notas y tareas (no tienen FK: referencia polimórfica).
- **Cada cambio de etapa deja un `LeadStageEvent`** (`from_stage_id`, `to_stage_id`, `owner`
  del momento). Es append-only: de ahí sale conversión, días en etapa, ciclo y desempeño.
  Un lead creado directamente en una etapa lleva su evento inicial con `from = null`.
- **La analítica decide por `kind`** (`WON`, `LOST`, `QUALIFY`, `PROPOSAL`), nunca por el nombre
  de la etapa.
- **Listados paginados** (`page`, `limit` con tope 200) y **filtrados en SQL**. Las facetas se
  calculan con `groupBy` o sobre un índice ligero (id + 3 columnas), nunca cargando filas enteras.
- **`$queryRaw` taggeado solo cuando Prisma no alcanza** (buscar dentro de un `text[]`), con
  comentario. Nunca `$queryRawUnsafe`. En `ILIKE`, `escapeLike` sobre el término del usuario.
- **Otro módulo se consume por su servicio exportado** en `exports:` de su `*.module.ts`, o por
  `CrmPortService` (`crm/crm.port.ts`), que es la frontera del CRM hacia fuera. No se importan
  archivos internos ni se tocan tablas ajenas con Prisma: esa costura es la que permitiría sacar
  el CRM a su propio servicio.
- **`comments/` no importa `CrmModule`** (ciclo): importa `CrmPortModule`, que es una hoja.
- Todo lo que el filtro o el matcher comparan se guarda **ya normalizado** al escribir: correos en
  minúscula, `domain` a solo host, `source` a slug, ciudad canónica, `''` → `null`.

## 4. Errores, logs, notificaciones

- Errores de negocio con las excepciones de Nest: `NotFoundException('Empresa no encontrada')`,
  `ConflictException` (etapa con leads, segunda etapa WON), `BadRequestException`. Mensajes en
  español, para la persona.
- Los ≥500 los captura `AllExceptionsFilter` y devuelve un genérico; el detalle va al log. No
  hace falta `try/catch` para loguear; sí para **traducir** un error externo a uno de negocio.
- `Logger` de Nest con el contexto de la clase. Nada de `console.*`.
- Un `catch` que traga silenciosamente es un defecto: o relanza, o devuelve un resultado que dice
  que falló, o loguea con `warn` y explica por qué se tolera (las notificaciones son best-effort
  y lo dicen).
- Avisar a alguien pasa por el `NotifierPort` (`jobs/notifier.port.ts`); el canal (Slack, correo)
  se registra en `NotifierModule`.

## 5. Jobs (`src/jobs/`)

- `POST /api/v1/jobs/<nombre>` con `ApiKeyGuard`. Idempotente por diseño: correr dos veces el
  mismo día no duplica ni cambia datos por segunda vez.
- Devuelve un resumen con conteos (`{ status, meta: { at_risk, stuck, overdue } }`).
- El comentario del handler dice cómo se programa (cron externo) y con qué frecuencia.

## 6. Cómo se prueba

- Unidad: instancia la clase con sus dependencias sustituidas:
  `new CrmService(prisma as unknown as PrismaService)` con `prisma = { lead: { findMany: jest.fn() } }`.
  `$transaction` se sustituye aceptando arreglo o callback (mira `crm.service.spec.ts`).
  No levantes `Test.createTestingModule` ni Prisma para una unidad.
- `describe`/`it` en español y hablan del comportamiento y del riesgo que vigilan.
- e2e en `apps/server/test/crm.e2e-spec.ts` con supertest contra la base local para lo que cruza
  guards y pipes (401/403/400, asociación por dominio, log de etapas). Se salta solo si no hay
  `DATABASE_URL`.
- Correr una sola: `pnpm --filter server test -- people.service.spec.ts`.

## Lista de comprobación

- [ ] Schema Zod en `packages/shared`, exportado, y `pnpm --filter @crm/shared build` corrido.
- [ ] Controlador con guard y `@RequireArea` a nivel de clase; `@RequireRole('GERENTE')` en lo de dirección.
- [ ] `@Body()` tipado con un DTO `createZodDto`.
- [ ] Escrituras relacionadas dentro de `$transaction`; cambio de etapa con su `LeadStageEvent`.
- [ ] La analítica lee `kind`, no el nombre.
- [ ] Listado paginado y filtrado en SQL; `ILIKE` escapado.
- [ ] Sin importar archivos internos de otro módulo; tablas ajenas por su servicio o por el puerto.
- [ ] Job: `ApiKeyGuard`, idempotente, comentario de programación.
- [ ] Spec al lado, en español, que se rompe si se rompe la regla.
