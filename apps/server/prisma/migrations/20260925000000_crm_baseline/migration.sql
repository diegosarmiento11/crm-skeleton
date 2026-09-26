-- Línea base del CRM de referencia. Una sola migración porque el repo nace aquí;
-- a partir de esta, cada cambio de esquema va en su propia carpeta con marca de
-- tiempo posterior y un comentario como este que diga POR QUÉ existe.
--
-- Decisiones que encierra:
--   · Los datos de contacto viven en companies/people, no en leads (modelo Attio).
--   · lead_stage_events es append-only y es la fuente de toda la analítica.
--   · pipeline_stages.kind reemplaza "adivinar por el nombre" qué etapa es ganado.
--   · Las FKs internas del CRM sí existen (Postgres las mantiene consistentes).

-- Enums (espejo de packages/shared/src/enums)
CREATE TYPE "TeamRole" AS ENUM ('GERENTE', 'COMERCIAL', 'PENDIENTE');
CREATE TYPE "StageKind" AS ENUM ('OPEN', 'QUALIFY', 'PROPOSAL', 'WON', 'LOST');
CREATE TYPE "ContactStatus" AS ENUM ('CONTACTAR', 'NO_CONTACTAR', 'DE_BAJA');

-- Equipo ---------------------------------------------------------------------
CREATE TABLE "team_users" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "email"         TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "role"          "TeamRole" NOT NULL DEFAULT 'PENDIENTE',
    "is_active"     BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "team_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "team_users_email_key" ON "team_users"("email");

-- Pipeline -------------------------------------------------------------------
CREATE TABLE "pipeline_stages" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "name"       TEXT NOT NULL,
    "color"      TEXT NOT NULL DEFAULT 'slate',
    "position"   INTEGER NOT NULL,
    "kind"       "StageKind" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pipeline_stages_position_idx" ON "pipeline_stages"("position");

CREATE TABLE "companies" (
    "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
    "name"             TEXT NOT NULL,
    "contact_status"   "ContactStatus" NOT NULL DEFAULT 'CONTACTAR',
    "email_addresses"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "phone_numbers"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "domain"           TEXT,
    "description"      TEXT,
    "industry"         TEXT,
    "primary_location" TEXT,
    "linkedin"         TEXT,
    "instagram"        TEXT,
    "facebook"         TEXT,
    "twitter"          TEXT,
    "source"           TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "companies_source_idx" ON "companies"("source");
CREATE INDEX "companies_industry_idx" ON "companies"("industry");
CREATE INDEX "companies_primary_location_idx" ON "companies"("primary_location");

CREATE TABLE "people" (
    "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
    "name"             TEXT NOT NULL,
    "contact_status"   "ContactStatus" NOT NULL DEFAULT 'CONTACTAR',
    "email_addresses"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "phone_numbers"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "description"      TEXT,
    "company_id"       UUID,
    "job_title"        TEXT,
    "source"           TEXT,
    "industry"         TEXT,
    "primary_location" TEXT,
    "linkedin"         TEXT,
    "instagram"        TEXT,
    "facebook"         TEXT,
    "twitter"          TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "people_company_id_idx" ON "people"("company_id");
CREATE INDEX "people_source_idx" ON "people"("source");
ALTER TABLE "people" ADD CONSTRAINT "people_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "leads" (
    "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
    "company"          TEXT NOT NULL,
    "stage_id"         UUID NOT NULL,
    "position"         INTEGER NOT NULL DEFAULT 0,
    "target_service"   TEXT,
    "sector"           TEXT,
    "source"           TEXT,
    "estimated_value"  INTEGER,
    "owner"            TEXT,
    "company_id"       UUID,
    "lost_reason"      TEXT,
    "stage_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "leads_stage_id_position_idx" ON "leads"("stage_id", "position");
CREATE INDEX "leads_owner_idx" ON "leads"("owner");
CREATE INDEX "leads_company_id_idx" ON "leads"("company_id");
-- Restrict: una etapa con leads no se puede borrar (el servicio lo traduce a 409).
ALTER TABLE "leads" ADD CONSTRAINT "leads_stage_id_fkey"
    FOREIGN KEY ("stage_id") REFERENCES "pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Log append-only de transiciones: de aquí sale toda la analítica del embudo.
CREATE TABLE "lead_stage_events" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "lead_id"       UUID NOT NULL,
    "from_stage_id" UUID,
    "to_stage_id"   UUID NOT NULL,
    "owner"         TEXT,
    "occurred_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lead_stage_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lead_stage_events_lead_id_occurred_at_idx" ON "lead_stage_events"("lead_id", "occurred_at");
CREATE INDEX "lead_stage_events_to_stage_id_idx" ON "lead_stage_events"("to_stage_id");
ALTER TABLE "lead_stage_events" ADD CONSTRAINT "lead_stage_events_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "lead_persons" (
    "lead_id"    UUID NOT NULL,
    "person_id"  UUID NOT NULL,
    "position"   INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lead_persons_pkey" PRIMARY KEY ("lead_id", "person_id")
);
CREATE INDEX "lead_persons_person_id_idx" ON "lead_persons"("person_id");
ALTER TABLE "lead_persons" ADD CONSTRAINT "lead_persons_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_persons" ADD CONSTRAINT "lead_persons_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Actividad ------------------------------------------------------------------
CREATE TABLE "crm_notes" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" TEXT NOT NULL,
    "entity_id"   UUID NOT NULL,
    "kind"        TEXT NOT NULL DEFAULT 'comment',
    "body"        TEXT NOT NULL,
    "author"      TEXT,
    "author_id"   TEXT,
    "parent_id"   UUID,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_notes_entity_type_entity_id_idx" ON "crm_notes"("entity_type", "entity_id");
CREATE INDEX "crm_notes_parent_id_idx" ON "crm_notes"("parent_id");

CREATE TABLE "crm_tasks" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" TEXT NOT NULL,
    "entity_id"   UUID NOT NULL,
    "title"       TEXT NOT NULL,
    "done"        BOOLEAN NOT NULL DEFAULT false,
    "due_date"    TIMESTAMP(3),
    "assignees"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_tasks_entity_type_entity_id_idx" ON "crm_tasks"("entity_type", "entity_id");
CREATE INDEX "crm_tasks_done_due_date_idx" ON "crm_tasks"("done", "due_date");

-- Preferencias y ajustes -----------------------------------------------------
CREATE TABLE "crm_view_prefs" (
    "user_email" TEXT NOT NULL,
    "entity"     TEXT NOT NULL,
    "config"     JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_view_prefs_pkey" PRIMARY KEY ("user_email", "entity")
);

CREATE TABLE "crm_settings" (
    "key"        TEXT NOT NULL,
    "config"     JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_settings_pkey" PRIMARY KEY ("key")
);

-- Etapas por defecto: solo si la tabla está vacía, para que re-correr sea seguro.
-- QUALIFY y PROPOSAL son las etapas que vigila el SLA; WON define el ciclo de venta.
INSERT INTO "pipeline_stages" ("name", "color", "position", "kind", "updated_at")
SELECT s.name, s.color, s.position, s.kind::"StageKind", CURRENT_TIMESTAMP FROM (VALUES
    ('Nuevo',             'slate',  0, 'OPEN'),
    ('Diagnóstico',       'blue',   1, 'QUALIFY'),
    ('Propuesta enviada', 'amber',  2, 'PROPOSAL'),
    ('Negociación',       'teal',   3, 'OPEN'),
    ('En pausa',          'slate',  4, 'OPEN'),
    ('Ganado',            'green',  5, 'WON'),
    ('Perdido',           'red',    6, 'LOST')
) AS s(name, color, position, kind)
WHERE NOT EXISTS (SELECT 1 FROM "pipeline_stages");
