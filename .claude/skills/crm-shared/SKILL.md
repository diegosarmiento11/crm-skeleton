---
name: crm-shared
description: Reglas del paquete de contrato @crm/shared (packages/shared) — schemas Zod, enums, ROLE_AREAS y helpers puros que comparten servidor y cliente. Cárgala antes de añadir un campo, un schema, un enum o un permiso, y cuando algo compile en el cliente pero falle en el servidor (o al revés).
---

# El contrato compartido

`packages/shared` es lo único que ven los dos lados. Un campo existe cuando existe aquí.

## 1. Cómo se resuelve, y por qué engaña

| Consumidor | Lee | Consecuencia |
|---|---|---|
| Servidor (build y runtime) | `packages/shared/dist` | un cambio **no** se ve hasta `pnpm --filter @crm/shared build` |
| Servidor (Jest) | `packages/shared/src` vía `moduleNameMapper` | las pruebas ven el cambio al instante |
| Cliente (Vite y tsc) | `packages/shared/src` vía alias/paths | el cliente lo ve al instante |

Por eso "los tests pasan pero el server arranca con el tipo viejo": falta el build. El hook de
verificación lo corre solo cuando el turno tocó `packages/shared`.

## 2. Qué vive aquí

- `src/schemas/<dominio>.schema.ts`: schemas Zod de request y response, con su tipo inferido.
  `crm.schema.ts` (etapas, leads, analítica, empresas, personas), `comments.schema.ts` (notas y
  tareas), `team.schema.ts`, `view-pref.schema.ts`.
- `src/enums/index.ts`: enums de dominio como `const` + tipo (`TEAM_ROLES`, `STAGE_KINDS`,
  `STAGE_COLORS`), **espejo del `enum` de Prisma**; `ROLE_AREAS`; listas sugeridas
  (`LEAD_SERVICES`, `LEAD_SECTORS`, `LEAD_SOURCES`, `DATA_SOURCES`); `CRM_CURRENCY`/`CRM_LOCALE`;
  normalizadores puros (`normalizeSource`, `normalizeCity`, `normalizeDomain`,
  `formatPersonName`, `cargoGroup`, `corporateDomainFromEmail`, `isPublicEmailDomain`).
- `src/health.ts`: `computeLeadHealth`, la única definición de la salud de un lead.
- `src/mentions.ts`: el token `@[correo]` y su extractor.
- `ROLE_AREAS`: la matriz rol → áreas. El guard del servidor y `config/nav.ts` + `RequireArea`
  del cliente la leen; **cambiar un permiso es cambiar esta tabla**, no dos archivos.
- Nada que importe Nest, React, Prisma ni un SDK: solo funciones puras y Zod.

## 3. Un campo nuevo, en orden

1. Añádelo al schema (`CreateXSchema`, `UpdateXSchema` y el de respuesta si lo devuelve).
2. Exporta schema y tipo desde `src/index.ts` (está agrupado por dominio: busca el bloque).
3. Si tiene lógica (normalizar, derivar), una prueba en `src/**/*.test.ts` (vitest).
4. `pnpm --filter @crm/shared build`.
5. Servidor: DTO en `dto/`, columna en Prisma si persiste (carga `crm-db`).
6. Cliente: el hook del dominio ya recibe el tipo; la pantalla lo usa.

Un campo opcional en el schema y obligatorio en la columna (o al revés) es el error típico:
mira las dos definiciones juntas. `nullish()` en el input, `nullable()` en la respuesta.

## 4. Lo que no entra

- Componentes, hooks, nada de React.
- Lógica de negocio que necesite datos (eso es un servicio).
- Tipos de respuesta escritos a mano en el cliente que ya existen aquí. Si el cliente necesita
  un shape que el servidor devuelve, el shape se declara aquí.
- Nada específico de un país o un cliente en el código: `KNOWN_CITIES` y las listas sugeridas
  son el sitio para configurar, no las funciones.

## Lista de comprobación

- [ ] Schema y tipo exportados desde `src/index.ts`.
- [ ] `pnpm --filter @crm/shared build` corrido antes de arrancar el servidor.
- [ ] Enum nuevo espejado en Prisma (y viceversa).
- [ ] Permiso nuevo solo en `ROLE_AREAS`.
- [ ] Sin imports de runtime (Nest, React, Prisma, SDKs).
- [ ] Helper nuevo con su `*.test.ts` y `pnpm --filter @crm/shared test` en verde.
