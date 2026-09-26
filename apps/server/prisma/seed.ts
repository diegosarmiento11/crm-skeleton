import { PrismaClient } from '@prisma/client';

// Semilla de desarrollo. Idempotente: se puede correr las veces que haga falta.
// Crea un GERENTE (para poder asignar roles) y un COMERCIAL, y un par de
// registros de muestra para que el pipeline no arranque vacío en local.
const prisma = new PrismaClient();

async function main() {
  const gerente = await prisma.teamUser.upsert({
    where: { email: 'gerente@example.com' },
    update: { role: 'GERENTE', is_active: true },
    create: { email: 'gerente@example.com', name: 'Gerente Demo', role: 'GERENTE' },
  });
  const comercial = await prisma.teamUser.upsert({
    where: { email: 'comercial@example.com' },
    update: { role: 'COMERCIAL', is_active: true },
    create: { email: 'comercial@example.com', name: 'Comercial Demo', role: 'COMERCIAL' },
  });
  console.log(`Seed: equipo listo (${gerente.email}, ${comercial.email})`);

  const stages = await prisma.pipelineStage.findMany({ orderBy: { position: 'asc' } });
  if (stages.length === 0) {
    throw new Error('No hay etapas: corre las migraciones antes del seed (pnpm migrate:deploy).');
  }

  const existing = await prisma.lead.count();
  if (existing > 0) {
    console.log(`Seed: ya hay ${existing} lead(s); no se crean datos de muestra.`);
    return;
  }

  const acme = await prisma.company.create({
    data: {
      name: 'Acme S.A.S.',
      domain: 'acme.example',
      industry: 'Manufactura',
      primary_location: 'Bogotá',
      email_addresses: ['contacto@acme.example'],
      phone_numbers: [],
      source: 'manual',
    },
  });
  const ana = await prisma.person.create({
    data: {
      name: 'Ana Pérez',
      job_title: 'Gerente de Operaciones',
      email_addresses: ['ana@acme.example'],
      phone_numbers: [],
      company_id: acme.id,
      source: 'manual',
    },
  });
  const first = stages[0];
  await prisma.lead.create({
    data: {
      company: acme.name,
      stage_id: first.id,
      position: 0,
      estimated_value: 12_000_000,
      owner: comercial.email,
      company_id: acme.id,
      sector: acme.industry,
      source: 'Referido',
      persons: { create: [{ person_id: ana.id, position: 0 }] },
      // Entrada inicial al embudo (from = null): sin esto la analítica no cuenta el lead.
      stage_events: { create: [{ to_stage_id: first.id, owner: comercial.email }] },
    },
  });
  console.log('Seed: empresa, persona y lead de muestra creados.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
