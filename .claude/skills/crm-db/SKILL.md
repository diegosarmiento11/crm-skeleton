---
name: crm-db
description: Reglas para cambiar el esquema de datos del CRM (apps/server/prisma/schema.prisma) y escribir sus migraciones SQL revisadas a mano. Cárgala antes de añadir o cambiar una tabla, columna, enum, índice o relación, y antes de tocar cualquier archivo bajo prisma/migrations.
---

# Base de datos

Prisma 5 sobre PostgreSQL 15. Las migraciones son **SQL revisado a mano** en carpetas con marca
de tiempo (`20260925000000_crm_baseline/migration.sql`). En local corre Postgres de Homebrew; en
producción `prisma migrate deploy` corre **antes** del despliegue, sin plan de rollback: una
migración que falla deja el deploy a medias.

## 1. Convenciones del esquema

```prisma
// Log append-only de cada transición de etapa (y la entrada inicial, from=null).
// De aquí sale TODA la analítica del embudo. Nunca se edita ni se borra.
model LeadStageEvent {
  id            String   @id @default(uuid()) @db.Uuid
  lead_id       String   @db.Uuid
  from_stage_id String?  @db.Uuid
  to_stage_id   String   @db.Uuid
  owner         String?
  occurred_at   DateTime @default(now())

  lead Lead @relation(fields: [lead_id], references: [id], onDelete: Cascade)

  @@index([lead_id, occurred_at])
  @@map("lead_stage_events")
}
```

- **Modelo en PascalCase, tabla y columnas en `snake_case`**, `@@map` siempre.
- PK `String @id @default(uuid()) @db.Uuid`. `created_at` / `updated_at` en toda tabla que se edite.
- **Comentario `//` en español encima del modelo** que diga para qué existe y qué decisión encierra.
  La migración repite ese porqué con `--`.
- **Toda FK con `onDelete` explícito y su `@@index`** (Postgres no indexa FKs solo). Elige a
  conciencia: `Cascade` para hijos sin valor propio (eventos de un lead, filas de unión),
  `SetNull` para enlaces blandos (persona → empresa, lead → empresa), **`Restrict` para lo que no
  debe desaparecer por arrastre** (lead → etapa: una etapa con leads no se borra).
- **Referencias polimórficas** (`crm_notes`, `crm_tasks`: `entity_type` + `entity_id`) no tienen
  FK: quien borra el registro padre borra sus notas y tareas en la misma transacción.
- **Un enum vive en tres sitios** y tienen que coincidir: `enum` en Prisma, `const` + `z.enum`
  en `packages/shared/src/enums`. Cambiar uno sin los otros compila y falla en runtime.
  Hoy: `TeamRole`, `StageKind`, `ContactStatus`.
- Arreglos de texto (`email_addresses`, `phone_numbers`, `assignees`) se guardan normalizados
  (correos en minúscula, teléfonos E.164) para poder filtrar con `has`/`hasSome`.
- `JSONB` solo para datos que de verdad no tienen forma (`crm_view_prefs.config`,
  `crm_settings.config`), y validados con Zod al entrar.

## 2. Una migración, en orden

1. Cambia `schema.prisma`.
2. `pnpm migrate:dev --name <snake_case_en_espanol>` genera la carpeta y aplica en local.
3. **Abre el SQL generado y edítalo**: comentario `--` con el porqué al inicio, `IF NOT EXISTS` y
   `ON CONFLICT DO NOTHING` donde tenga sentido, y los `UPDATE` de relleno de datos que Prisma no
   sabe escribir.
4. La marca de tiempo va **después de la última migración que ya está en `main`**: comprueba con
   `git fetch origin && ls apps/server/prisma/migrations | tail -3`. Una migración con fecha anterior
   a una ya desplegada no se aplica nunca.
5. `pnpm prisma:generate` y `pnpm --filter @crm/shared build` si tocaste enums.

**Una migración ya integrada no se edita.** Producción la marcó como aplicada; editarla deja los
entornos distintos sin ninguna señal. Se corrige hacia adelante con otra migración. Única
excepción: una que falló a medias y no puede reejecutarse; se dice en el commit. El hook
`rules-for-path` pregunta antes de dejar editar una.

**Nunca `prisma db push` ni `prisma migrate reset`.** El hook `guard-bash` los bloquea.

## 3. Semilla

`prisma/seed.ts` es idempotente (upserts, y no crea datos de muestra si ya hay leads). Se corre
con `pnpm seed` (carga `.env`). Las etapas por defecto NO van en el seed: van en la migración
base con `WHERE NOT EXISTS`, porque sin etapas el CRM no funciona.

## 4. Rendimiento

- Toda agregación que hoy se haga en memoria debe poder ser un `groupBy` o un `$queryRaw`
  taggeado cuando la tabla crezca. Las facetas de personas usan un índice ligero (3 columnas)
  a propósito; si `people` supera decenas de miles de filas, se pasa a SQL.
- Índices para los filtros: `leads(stage_id, position)`, `leads(owner)`,
  `lead_stage_events(lead_id, occurred_at)`, `crm_notes(entity_type, entity_id)`,
  `crm_tasks(done, due_date)`, `companies(industry)`, `companies(primary_location)`.

## Lista de comprobación

- [ ] `@@map`, `snake_case`, UUID, `created_at`/`updated_at`, comentario en español.
- [ ] FK con `onDelete` deliberado y `@@index`. Restrict donde el borrado por arrastre sería un error.
- [ ] Enum replicado en `packages/shared/src/enums` y `shared` reconstruido.
- [ ] Migración SQL revisada: comentario `--`, idempotencia, relleno de datos.
- [ ] Marca de tiempo posterior a la última en `main`.
- [ ] Ninguna migración integrada editada.
- [ ] `pnpm --filter server test` en verde tras `prisma generate`; e2e si cambió una tabla del CRM.
