# crm-skeleton

CRM de referencia: pipeline con etapas configurables, personas, empresas, notas y tareas,
analítica del embudo y equipo con permisos por área. Sirve como **ejemplo de cómo construir un
CRM** (contrato compartido, log de etapas, puertos hacia fuera, autorización por área) y como
**catálogo de sus reglas de negocio**. Está extraído de un producto en producción y limpiado de
lo específico de ese negocio.

## Empezar

Requisitos: Node 22, pnpm 9, PostgreSQL 15 local.

```bash
pnpm install
cp .env.example apps/server/.env          # ajusta DATABASE_URL a tu usuario de Postgres
cp apps/client/.env.example apps/client/.env
createdb crm_skeleton_dev
pnpm dev:all                              # migra, siembra y levanta server (:8082) y client (:5173)
```

Entra en `http://localhost:5173` con `gerente@example.com` (todo) o `comercial@example.com`
(opera el CRM, sin analítica ni administración). La identidad en desarrollo es una cabecera
(`X-Team-Email`); para producción se enchufa un proveedor real (ver `docs/arquitectura.md`).

## Qué hay

| Workspace | Qué es |
|---|---|
| `packages/shared` | `@crm/shared`: schemas Zod, enums, `ROLE_AREAS`, salud del lead. Lo único que ven los dos lados. |
| `apps/server` | NestJS 10 + Prisma 5. Módulos `auth`, `team`, `crm`, `comments`, `jobs`. |
| `apps/client` | Vite + React 18 + TanStack Query 5 + shadcn/ui. Pipeline, Personas, Empresas, Embudo, Equipo. |

## Documentación

- **`docs/reglas-de-negocio.md`**: qué debe pasar (etapas, log de eventos, salud, SLA, pérdidas,
  asociación persona↔empresa, permisos, hilos y menciones), con el archivo dueño y la prueba que
  lo vigila.
- **`docs/arquitectura.md`**: estructura, las cuatro ideas del diseño, flujo de una petición.
- **`docs/decisiones/`**: por qué se eligió cada cosa y qué se descartó.
- **`CLAUDE.md`** y **`.claude/`**: cómo se trabaja con Claude Code aquí (skills por zona,
  `/spec → /build → /review → /wrap`, agentes auditores, hooks deterministas).

## Verificar

```bash
pnpm verify        # shared build → lint → typecheck → test (shared, server, client)
pnpm test:e2e      # supertest contra la base local: guards, pipes, log de etapas
```

## Extender

Tres puertos para no acoplarse a lo que hay alrededor:

- `apps/server/src/auth/identity.port.ts`: quién llama (Firebase, Auth0, JWT propio…).
- `apps/server/src/crm/crm.port.ts`: lo que otro módulo (inbox, agente, clientes) necesita del CRM.
- `apps/server/src/jobs/notifier.port.ts`: a dónde van los avisos (Slack, correo, in-app).

Lo que sale adrede (prospección en frío, inbox, enriquecimiento con LLM) se integra por esos
puertos, nunca escribiendo en las tablas del CRM desde fuera.
