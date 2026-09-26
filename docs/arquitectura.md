# Arquitectura

Monorepo pnpm con tres workspaces y un solo contrato. Lo que está aquí es lo que no se deduce
del código; lo que sí se deduce, no está.

```
crm-skeleton/
├── packages/shared/          @crm/shared — el contrato: schemas Zod, enums, ROLE_AREAS, helpers puros
│   └── src/{schemas,enums,health.ts,mentions.ts,index.ts}
├── apps/server/              NestJS 10 + Prisma 5 (Postgres)
│   ├── prisma/{schema.prisma, migrations/, seed.ts}
│   └── src/
│       ├── auth/             IdentityProvider (puerto) · HeaderIdentityProvider (dev) · decoradores · /me
│       ├── common/guards/    TeamGuard (área + rol + impersonación) · ApiKeyGuard (jobs)
│       ├── common/{filters,interceptors}/  errores y log de peticiones
│       ├── config/           env.validation (Zod) · AppConfigService
│       ├── team/             directorio y administración de miembros
│       ├── crm/              etapas, leads, empresas, personas, matcher, view-prefs, CrmPort
│       ├── comments/         notas (hilos, menciones) y tareas: motor genérico por entidad
│       ├── jobs/             NotifierPort (puerto) · LogNotifier · crm-digest
│       └── health/
├── apps/client/              Vite + React 18 + TanStack Query 5 + shadcn/ui + Tailwind
│   └── src/{auth,config,hooks,lib,layouts,pages,components/{ui,common,crm,team,layout}}
├── docs/                     reglas-de-negocio.md · arquitectura.md · decisiones/
├── specs/                    una especificación por bloque de trabajo (/spec → /build → /review → /wrap)
└── .claude/                  skills por zona, agentes auditores y hooks deterministas
```

## Las cuatro ideas que sostienen el diseño

### 1. El contrato vive en un solo sitio

`packages/shared` es lo único que ven los dos lados. Un campo existe cuando existe ahí: el
servidor lo valida con un DTO `createZodDto(Schema)` y el cliente lo tipa desde el mismo schema.
Los enums de Prisma tienen su espejo `const` + `z.enum` ahí (`TeamRole`, `StageKind`,
`ContactStatus`), y la matriz de permisos `ROLE_AREAS` también. Hay una sola definición de la
salud del lead (`health.ts`) para que servidor y cliente pinten la misma banda.

Trampa conocida: el servidor consume `dist` (hay que `pnpm --filter @crm/shared build`); Jest,
Vite y `tsc` del cliente consumen `src`. Por eso "los tests pasan pero el server arranca con el
tipo viejo".

### 2. El log de etapas es la fuente de verdad de la analítica

`lead_stage_events` es append-only: cada transición (y la entrada inicial) deja una fila con
origen, destino, responsable y hora, escrita en la **misma transacción** que el lead. Toda la
analítica (conversión, días por etapa, ciclo, pérdidas por etapa, desempeño por persona) se
deriva de ahí, no del estado actual. Y las etapas declaran su papel con `kind`, así que la
analítica nunca adivina por el nombre.

### 3. Puertos hacia fuera

El CRM expone tres costuras para no acoplarse a lo que hay alrededor:

| Puerto | Archivo | Para qué | Implementación por defecto |
|---|---|---|---|
| `IdentityProvider` | `auth/identity.port.ts` | quién llama (Firebase, Auth0, JWT propio…) | `HeaderIdentityProvider` (solo `AUTH_ENABLED=false`) |
| `CrmPort` | `crm/crm.port.ts` | lo que otro módulo necesita saber o cambiar de un lead/persona sin tocar Prisma | `CrmPortService` (mismo proceso, misma base) |
| `NotifierPort` | `jobs/notifier.port.ts` | avisar a alguien (menciones, respuestas, digest) | `LogNotifier` |

Regla: un módulo ajeno al CRM (un inbox, un agente, clientes) pasa por `CrmPortService` o por el
servicio exportado del módulo; nunca importa archivos internos ni escribe en tablas del CRM. Ese
día en que el CRM viva en su propio servicio, el puerto se implementa con HTTP y nadie más cambia.

`comments/` es un motor genérico (entidad polimórfica) que el CRM consume; para no cerrar el
grafo en círculo, `CommentsModule` importa `CrmPortModule` (una hoja) y no `CrmModule`.

### 4. Autorización por área, no por rango

`TeamGuard` resuelve la identidad, busca la fila en `team_users` (auto-provisiona `PENDIENTE` a
los correos del dominio) y autoriza contra `ROLE_AREAS` leyendo `@RequireArea` (a nivel de
clase) y `@RequireRole` (acciones de dirección). El cliente aplica la misma matriz en
`config/nav.ts` y `<RequireArea>` para no pintar pantallas rotas; los datos los protege el
servidor. `X-Impersonate-Role` deja a un GERENTE ver la app como otro rol sin cambiar de
identidad.

## Flujo de una petición

```
cliente ── X-Team-Email / Bearer ──▶ TeamGuard ──▶ IdentityProvider.verify()
                                        │            └─▶ correo verificado
                                        ├─▶ team_users (rol, activo) + ROLE_AREAS
                                        └─▶ controlador ──▶ ZodValidationPipe(DTO) ──▶ servicio ──▶ Prisma
                                                                                              └─▶ $transaction cuando hay >1 escritura
```

Errores: `AllExceptionsFilter` deja pasar los `HttpException` con su código y mensaje en español;
todo lo demás es un 500 genérico con el detalle en el log. `LoggingInterceptor` escribe una línea
por petición con id de correlación, sin la query string.

## Cliente

- **Un hook por dominio** (`hooks/useCrm.ts`, `useComments.ts`, `useTeam.ts`) con claves
  constantes e invalidación por prefijo. Una nota o tarea nueva invalida también los leads,
  porque la tarjeta muestra contador, salud y próxima tarea.
- **Rutas lazy** con `lazyWithReload` (reintenta una vez si el chunk cambió tras un deploy) y
  gating por área/rol replicado de `config/nav.ts`.
- **shadcn/ui** en `components/ui/` (generado, no se escribe a mano); tokens HSL en `index.css`
  con dos temas; radios por escala; colores de etapa como cadenas de clase completas.
- **Identidad** en `lib/api.ts`: `Authorization: Bearer` si hay token, si no `X-Team-Email`
  (desarrollo). Conectar un proveedor real es poner su token en `session.token`.

## Lo que sale adrede

Prospección en frío, inbox, enriquecimiento con LLM, importadores de registros públicos,
notificaciones in-app. Están descritos en `docs/reglas-de-negocio.md` («Qué NO está») y en
`docs/decisiones/`. Se integran por los puertos.
