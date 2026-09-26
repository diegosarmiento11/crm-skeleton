---
name: crm-delivery
description: Cómo se entrega en este CRM — verificación local (pnpm verify), cómo se escriben las pruebas (unidad, e2e contra Postgres local), ramas y mensajes de commit en español, variables de entorno y qué queda en manos de una persona. Cárgala antes de un commit, de escribir una prueba o de tocar la configuración de entorno.
---

# Entrega

## 1. Verificación

```
pnpm verify        # shared build → lint → typecheck → test, en ese orden
pnpm lint          # eslint en las dos apps, --max-warnings=0
pnpm typecheck     # tsc --noEmit en server y client
pnpm test          # vitest (shared) + jest (server) + vitest (client)
pnpm test:e2e      # supertest contra la base local (apps/server/.env)
```

El hook `verify` corre esto acotado al workspace tocado al cerrar cada turno que escribió código.
Si está en rojo, **se corrige la causa**: no se añade `eslint-disable`, no se relaja una regla, no
se borra la prueba. El baseline está en cero errores y cero warnings: se mantiene así.

## 2. Pruebas

- Unidad al lado del archivo (`x.service.spec.ts`, `x.test.tsx`). Nombres en español que dicen el
  comportamiento y el riesgo: `it('no deja borrar una etapa con leads (409)')`.
- Dependencias con `jest.fn()` / `vi.fn()` tipadas `as unknown as Service`. Sin Nest ni Prisma en
  unidad. `$transaction` se sustituye aceptando arreglo o callback.
- **Se rompe a propósito** antes de darla por buena: cambia la condición que vigila y mira que se
  ponga en rojo por ese motivo.
- Una prueba que recorre archivos o filas **afirma cuántos** encontró antes de afirmar sobre ellos.
- e2e (`apps/server/test/crm.e2e-spec.ts`, supertest) para lo que cruza guards y pipes: 401 sin
  identidad, 403 por rol, 400 del pipe Zod, y los flujos que tocan varias tablas (crear y mover un
  lead deja dos eventos). Corre contra `DATABASE_URL` y se salta sola si no hay base.
- Lo que más vale la pena cubrir cuando se añade algo: reglas que no producen error si se rompen
  (un guard olvidado, un evento de etapa que no se escribe, una asociación por dominio público).

## 3. Ramas y commits

- Cambios de varios archivos en una rama `feat/<nombre>` o `fix/<nombre>`; una corrección de una
  línea puede ir directo.
- Mensajes **en español**, `tipo(alcance): descripción`, en presente y diciendo qué cambia para
  quien lo usa: `feat(crm): capturar la razón de pérdida al mover un lead a Perdido`,
  `fix(crm): el SLA no cuenta los leads cerrados`. Tipos: `feat`, `fix`, `refactor`, `style`,
  `docs`, `chore`, `test`. Alcances: `crm`, `comments`, `team`, `auth`, `shared`, `db`, `ui`,
  `jobs`, `infra`.
- Solo se confirma cuando la persona lo pide. `main` no se reescribe nunca.
- No se confirman `.env`, `*.pem`, `service-account*.json`, `.claude/settings.local.json`.

## 4. Entorno

- Node 22 (`.nvmrc`), pnpm 9, Postgres 15 local (Homebrew; sin docker-compose a propósito).
- `apps/server/.env` desde `apps/server/.env.example`; `apps/client/.env` desde su ejemplo.
  Una variable nueva: en los dos `.env.example`, en `config/env.validation.ts` (schema Zod) y en
  `AppConfigService`.
- `pnpm dev:all` levanta todo (Postgres, migraciones, seed, server en :8082, client en :5173).
- Identidad en desarrollo: `X-Team-Email: gerente@example.com` (o `comercial@example.com`),
  creados por el seed. En producción `AUTH_ENABLED=true` exige un `IdentityProvider` real.

## 5. Lo que solo hace una persona

- Push y PR.
- Migrar y desplegar producción: la migración corre antes del deploy y no tiene rollback; se
  probó en local contra datos parecidos. El hook `guard-bash` pide confirmación ante cualquier
  base que no sea `localhost`.
- Rotar `JOBS_API_KEY` y programar los jobs en el cron externo.

## Lista de comprobación

- [ ] `pnpm verify` en verde (o el hook lo confirmó).
- [ ] Prueba nueva rota a propósito una vez.
- [ ] e2e si el cambio cruza guards, pipes o varias tablas.
- [ ] Commit en español con tipo y alcance, solo si la persona lo pidió.
- [ ] Nada secreto en el diff (`git diff --cached --name-only`).
- [ ] Variable nueva en los `.env.example`, en `env.validation.ts` y en `AppConfigService`.
