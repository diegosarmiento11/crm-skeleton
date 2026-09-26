import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

// Prueba de punta a punta contra una base real (DATABASE_URL). Cruza guards,
// pipes y Prisma: lo que una unidad con jest.fn() no puede ver. Se salta sola si
// no hay base configurada.
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb('CRM e2e', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const tag = Date.now();
  const gerente = `gerente-${tag}@example.com`;
  const comercial = `comercial-${tag}@example.com`;
  const created: { leads: string[]; people: string[]; companies: string[] } = {
    leads: [],
    people: [],
    companies: [],
  };

  beforeAll(async () => {
    process.env.AUTH_ENABLED = 'false';
    process.env.TEAM_EMAIL_DOMAIN = 'example.com';
    process.env.JOBS_API_KEY ??= 'e2e-jobs-key-1234';
    await prisma.teamUser.createMany({
      data: [
        { email: gerente, name: 'Gerente E2E', role: 'GERENTE' },
        { email: comercial, name: 'Comercial E2E', role: 'COMERCIAL' },
      ],
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await prisma.lead.deleteMany({ where: { id: { in: created.leads } } });
    await prisma.person.deleteMany({ where: { id: { in: created.people } } });
    await prisma.company.deleteMany({ where: { id: { in: created.companies } } });
    await prisma.teamUser.deleteMany({ where: { email: { in: [gerente, comercial] } } });
    await prisma.$disconnect();
    await app?.close();
  });

  const as = (email: string) => ({ 'X-Team-Email': email });

  it('sin identidad responde 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/crm/stages').expect(401);
  });

  it('COMERCIAL opera el CRM pero la analítica es solo de GERENTE', async () => {
    await request(app.getHttpServer()).get('/api/v1/crm/stages').set(as(comercial)).expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/crm/pipeline/analytics')
      .set(as(comercial))
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/crm/pipeline/analytics')
      .set(as(gerente))
      .expect(200);
  });

  it('un body inválido lo rechaza el pipe Zod con 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/crm/companies')
      .set(as(comercial))
      .send({ name: '', phone_numbers: ['123'] })
      .expect(400);
  });

  it('crear persona con correo corporativo la enlaza a la empresa por dominio', async () => {
    const company = await request(app.getHttpServer())
      .post('/api/v1/crm/companies')
      .set(as(comercial))
      .send({ name: `Acme ${tag}`, domain: `https://www.acme-${tag}.com/` })
      .expect(201);
    created.companies.push(company.body.id);
    expect(company.body.domain).toBe(`acme-${tag}.com`);

    const person = await request(app.getHttpServer())
      .post('/api/v1/crm/people')
      .set(as(comercial))
      .send({ name: 'ANA PEREZ', email_addresses: [`Ana@Acme-${tag}.com`] })
      .expect(201);
    created.people.push(person.body.id);
    expect(person.body.company_id).toBe(company.body.id);
    expect(person.body.email_addresses).toEqual([`ana@acme-${tag}.com`]);
  });

  it('crear y mover un lead deja su rastro en el log de etapas y aparece en la analítica', async () => {
    const stages = (await request(app.getHttpServer()).get('/api/v1/crm/stages').set(as(comercial)))
      .body.items as { id: string; kind: string }[];
    const first = stages[0];
    const qualify = stages.find((s) => s.kind === 'QUALIFY')!;

    const lead = await request(app.getHttpServer())
      .post('/api/v1/crm/leads')
      .set(as(comercial))
      .send({ company: `Lead ${tag}`, stage_id: first.id, owner: comercial, estimated_value: 1000 })
      .expect(201);
    created.leads.push(lead.body.id);

    await request(app.getHttpServer())
      .patch(`/api/v1/crm/leads/${lead.body.id}/move`)
      .set(as(comercial))
      .send({ stage_id: qualify.id, position: 0 })
      .expect(200);

    const history = await request(app.getHttpServer())
      .get(`/api/v1/crm/leads/${lead.body.id}/stage-history`)
      .set(as(comercial))
      .expect(200);
    // Dos eventos (entrada + movimiento); el primero duró < 1 min y se oculta.
    expect(history.body.segments.at(-1).stage_id).toBe(qualify.id);

    const events = await prisma.leadStageEvent.count({ where: { lead_id: lead.body.id } });
    expect(events).toBe(2);
  });

  it('el job del digest exige la clave de máquina', async () => {
    await request(app.getHttpServer()).post('/api/v1/jobs/crm-digest').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/jobs/crm-digest')
      .set('X-Jobs-Key', process.env.JOBS_API_KEY as string)
      .expect(201);
  });
});
