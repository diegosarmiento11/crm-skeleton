import { PeopleService, escapeLike } from './people.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PersonMatcherService } from './person-matcher.service';

// La auto-asociación persona → empresa por dominio de correo es cómoda y peligrosa:
// mal hecha, arrastra a todos los @gmail.com a la misma empresa o pisa una
// asociación que el equipo quitó a mano. Aquí se vigila cuándo SÍ y cuándo NO.
describe('PeopleService — asociación automática a empresa', () => {
  let prisma: { person: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock } };
  let matcher: { companyForEmails: jest.Mock };
  let svc: PeopleService;

  beforeEach(() => {
    prisma = {
      person: {
        create: jest.fn(async ({ data }: { data: object }) => ({ id: 'p1', ...data })),
        update: jest.fn(async ({ data }: { data: object }) => ({ id: 'p1', ...data })),
        findUnique: jest.fn(),
      },
    };
    matcher = { companyForEmails: jest.fn().mockResolvedValue('c-acme') };
    svc = new PeopleService(
      prisma as unknown as PrismaService,
      matcher as unknown as PersonMatcherService,
    );
  });

  it('al crear sin empresa, la toma del dominio del correo (y normaliza el correo)', async () => {
    await svc.create({
      name: 'Ana',
      contact_status: 'CONTACTAR',
      email_addresses: ['Ana@ACME.com'],
      phone_numbers: [],
    });
    expect(matcher.companyForEmails).toHaveBeenCalledWith(['ana@acme.com']);
    expect(prisma.person.create.mock.calls[0][0].data.company_id).toBe('c-acme');
  });

  it('al crear CON empresa explícita no consulta el matcher', async () => {
    await svc.create({
      name: 'Ana',
      contact_status: 'CONTACTAR',
      email_addresses: ['ana@acme.com'],
      phone_numbers: [],
      company_id: '22222222-2222-4222-8222-222222222222',
    });
    expect(matcher.companyForEmails).not.toHaveBeenCalled();
  });

  it('al editar, una desasociación manual (company_id: null) gana sobre el matcher', async () => {
    prisma.person.findUnique.mockResolvedValue({
      id: 'p1',
      company_id: null,
      email_addresses: ['a@acme.com'],
    });
    await svc.update('p1', { company_id: null });
    expect(matcher.companyForEmails).not.toHaveBeenCalled();
    expect(prisma.person.update.mock.calls[0][0].data.company_id).toBeNull();
  });

  it('al editar sin tocar la empresa y sin empresa previa, intenta asociar', async () => {
    prisma.person.findUnique.mockResolvedValue({
      id: 'p1',
      company_id: null,
      email_addresses: ['a@acme.com'],
    });
    await svc.update('p1', { job_title: 'CEO' });
    expect(matcher.companyForEmails).toHaveBeenCalledWith(['a@acme.com']);
    expect(prisma.person.update.mock.calls[0][0].data.company_id).toBe('c-acme');
  });

  it('al editar una persona que YA tiene empresa no la cambia', async () => {
    prisma.person.findUnique.mockResolvedValue({
      id: 'p1',
      company_id: 'c-otra',
      email_addresses: ['a@acme.com'],
    });
    await svc.update('p1', { job_title: 'CEO' });
    expect(matcher.companyForEmails).not.toHaveBeenCalled();
    expect(prisma.person.update.mock.calls[0][0].data.company_id).toBeUndefined();
  });

  it('las cadenas vacías se guardan como null y el origen como slug', async () => {
    matcher.companyForEmails.mockResolvedValue(null);
    await svc.create({
      name: 'Ana',
      contact_status: 'CONTACTAR',
      email_addresses: [],
      phone_numbers: [],
      job_title: '',
      source: 'Feria Andina',
    });
    const data = prisma.person.create.mock.calls[0][0].data;
    expect(data.job_title).toBeNull();
    expect(data.source).toBe('feria_andina');
  });
});

describe('escapeLike', () => {
  it('escapa los comodines para que el término del usuario no se vuelva patrón', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
  });
});
