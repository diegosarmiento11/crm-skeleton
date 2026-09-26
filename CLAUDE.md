# CLAUDE.md

Guía para Claude Code en este repositorio. Lo que está aquí es lo que no se deduce del código;
lo que sí se deduce, no está.

## Qué es este repo

Un **CRM de referencia**: pipeline (kanban con etapas configurables), personas, empresas,
notas y tareas, analítica del embudo y equipo con permisos por área. Existe para mostrar **cómo
se construye** (contrato compartido, log de etapas, puertos hacia fuera, guards por área) y
**qué reglas de negocio** tiene un CRM comercial. Está extraído de un producto real y limpiado
de todo lo específico de ese negocio: lo que quedó es lo que cualquier CRM necesita.

- `packages/shared` (`@crm/shared`): el contrato. Schemas Zod, enums, `ROLE_AREAS`, salud del lead.
- `apps/server`: NestJS 10 + Prisma 5 sobre PostgreSQL. Puerto **8082**.
- `apps/client` (`@crm/client`): Vite + React 18 + TanStack Query + shadcn/ui. Puerto 5173.

Las reglas de negocio están en **`docs/reglas-de-negocio.md`**; la arquitectura y sus porqués en
`docs/arquitectura.md` y `docs/decisiones/`. Léelos antes de cambiar algo que toque etapas,
leads, permisos o la asociación persona↔empresa.

UI, comentarios y commits van en **español**; identificadores en inglés. Commits
`tipo(alcance): descripción` (`feat(crm):`, `fix(ui):`, …). Solo se confirma cuando la persona
lo pide.

## IMPORTANTE: carga la skill antes de escribir

Las reglas del repositorio viven en skills que se cargan por zona. Varias protegen contra fallos
que **no producen error** sino endpoints abiertos, analítica falsa o asociaciones equivocadas.

| Vas a tocar | Carga |
|---|---|
| `apps/server/src/**`: controlador, servicio, guard, job, consulta Prisma | `crm-api` |
| `apps/server/prisma/**`: esquema, migraciones, seed | `crm-db` |
| `packages/shared/**`: schemas Zod, enums, `ROLE_AREAS`, helpers | `crm-shared` |
| `apps/client/src/**`: página, componente, hook, estilo | `crm-ui` |
| pruebas, commit, variables de entorno | `crm-delivery` |
| una página del Docu (wiki interno, si aplica) | `docu-writing` |

**Cada skill termina con una lista de comprobación. Recórrela antes de dar el trabajo por terminado.**

## Cómo se trabaja un bloque

| | |
|---|---|
| `/spec <qué>` | entrevista y escribe `specs/<nombre>.md`: alcance, qué queda fuera, archivos que toca, reglas de negocio, criterios de aceptación, verificación de punta a punta |
| `/build specs/<nombre>.md` | implementa contra ella **en sesión nueva**, capa por capa (shared → prisma → server → client), verificando cada una |
| `/review` | `crm-auditor` (y `security-reviewer` si toca auth/guards/jobs/uploads/SQL) en contexto limpio, más los criterios uno por uno |
| `/wrap` | actualiza solo la documentación que el cambio afecta, verifica, confirma |

Para una corrección de una línea sobra la especificación. Sirve cuando el trabajo toca varios
archivos o hay más de una forma razonable de resolverlo. Para una feature nueva también está la
skill `plan-with-fable-implement-with-opus` (planear con un modelo, implementar con otro); las dos
rutas terminan en `/review`.

## Lo que corre solo

Tres puertas deterministas en `.claude/hooks/`, registradas en `.claude/settings.json`:

- **Antes de escribir un archivo**, `rules-for-path` inyecta las reglas de esa zona y nombra su
  skill. Editar una migración ya integrada o un archivo de secretos **pregunta antes**.
- **Antes de un comando**, `guard-bash` niega `prisma migrate reset` / `db push` y reescribir
  `main`; pide confirmación para `DROP`/`TRUNCATE`/`DELETE` sin `WHERE`, `rm -rf` sobre el árbol,
  `git reset --hard` y cualquier `psql`/`prisma` contra una base que no sea `localhost`.
- **Al cerrar un turno que tocó código**, `verify` corre tipos, lint de los archivos tocados y
  pruebas **del workspace tocado**, y el turno no termina en rojo. Un turno de conversación no
  paga nada.

Subagentes en `.claude/agents/`: `crm-auditor` (reglas) y `security-reviewer` (guards, identidad,
SQL, uploads, secretos). Úsalos antes de integrar: ven el código sin el razonamiento que lo produjo.

## Comandos

```bash
pnpm install
cp .env.example apps/server/.env      # ajusta DATABASE_URL a tu usuario local
cp apps/client/.env.example apps/client/.env
createdb crm_skeleton_dev
pnpm dev:all                          # Postgres + shared build + migrate + seed + server + client

pnpm verify                           # shared build → lint → typecheck → test (los tres workspaces)
pnpm --filter server test -- crm.service.spec.ts     # una prueba del server
pnpm --filter server test -- -t "SLA"                # por nombre
pnpm test:e2e                         # supertest contra la base local (usa apps/server/.env)
pnpm --filter @crm/client test -- src/lib/dates.test.ts
pnpm --filter @crm/shared test        # vitest de los helpers puros (salud, nombres, dominios)

pnpm migrate:dev --name <nombre>      # prisma migrate dev (solo DB local); luego edita el SQL
pnpm --filter @crm/shared build       # obligatorio tras tocar packages/shared, antes de arrancar el server
pnpm seed                             # semilla idempotente: gerente@example.com y comercial@example.com
```

Identidad en desarrollo (`AUTH_ENABLED=false`): cabecera `X-Team-Email: gerente@example.com`
o `comercial@example.com`. En el cliente, la pantalla de login pide ese correo. Un GERENTE puede
enviar `X-Impersonate-Role: COMERCIAL` (en el cliente, el selector "Ver como") para ver la app
como otro rol.

Postgres nativo (Homebrew `postgresql@15`); **no hay docker-compose** a propósito. Node 22
(`.nvmrc`), pnpm 9.

## Lo que no se deduce del código

- **`@crm/shared` se resuelve de dos formas.** Server build/runtime usa `dist`; Jest del server,
  Vite y `tsc` del cliente apuntan a `src`. Un cambio en shared se ve al instante en tests y
  cliente, pero el server necesita `pnpm --filter @crm/shared build`.
- **Dos guards, ninguno global.** `TeamGuard` (equipo; siempre con `@RequireArea` a nivel de
  clase) y `ApiKeyGuard` (jobs, cabecera `X-Jobs-Key`). Sin guard = público. Solo `/health` y,
  a propósito, `/me` sin área (para que un `PENDIENTE` sepa que espera rol).
- **Autorización por área, no por rango.** `ROLE_AREAS` en `packages/shared/src/enums` es la
  única matriz; el server la aplica con `@RequireArea` y el cliente con `<RequireArea>` y
  `config/nav.ts`. Las acciones de dirección llevan además `@RequireRole('GERENTE')`.
- **Identidad enchufable.** `auth/identity.port.ts` define `IdentityProvider`; en desarrollo
  `HeaderIdentityProvider` confía en `X-Team-Email`. Para producción se implementa el puerto
  (Firebase, Auth0, JWT propio) y se registra en `AuthModule`; `validateEnv` rechaza
  `AUTH_ENABLED=false` en producción.
- **El log de etapas es la analítica.** Todo cambio de etapa escribe `lead_stage_events` en la
  misma transacción. Las etapas declaran su papel con `kind`; nada decide por el nombre.
- **Actividad = punto de contacto.** Solo las notas `email|whatsapp|call` cuentan para la salud
  del lead y para "contactado"; un comentario no.
- **`comments/` no importa `CrmModule`** (ciclo): importa `CrmPortModule`. Otro módulo que
  necesite leads o personas pasa por `CrmPortService` o por el servicio exportado, nunca por
  Prisma directo sobre tablas del CRM.
- **Notificaciones por puerto.** `jobs/notifier.port.ts`; por defecto `LogNotifier`. El digest
  (`POST /api/v1/jobs/crm-digest`) lo dispara un cron externo con `X-Jobs-Key`.
- **El seed no crea etapas**: van en la migración base con `WHERE NOT EXISTS`.

## Lo que no se hace

- `prisma migrate reset` / `db push`; editar una migración ya integrada.
- Escribir a mano en `apps/client/src/components/ui/`: `pnpm dlx shadcn@latest add <nombre>`.
- Decidir en la analítica por el nombre de una etapa; escribir un lead sin su evento de etapa.
- Asociar una persona a una empresa por un dominio de correo público.
- Commitear `.env`, `*.pem`, `service-account*.json`, `.claude/settings.local.json`.
- docker-compose para desarrollo local.

## Al compactar

Conserva la lista de archivos modificados, los comandos de verificación que ya pasaron, la
especificación en curso (`specs/`) y las decisiones tomadas con la persona.
