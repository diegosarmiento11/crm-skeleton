import { describe, expect, it } from 'vitest';
import {
  cargoGroup,
  corporateDomainFromEmail,
  formatPersonName,
  isAllCaps,
  isPublicEmailDomain,
  normalizeCity,
  normalizeDomain,
  normalizeSource,
  roleCanAccess,
} from './index';
import { canonicalLostReason } from '../schemas/crm.schema';

describe('formatPersonName', () => {
  it('baja MAYÚSCULA sostenida a Title Case natural', () => {
    expect(formatPersonName('ALBERTO GALINDO PEÑA')).toBe('Alberto Galindo Peña');
  });

  it('deja los conectores (de, del, la, los, y) en minúscula, salvo al inicio', () => {
    expect(formatPersonName('MARIA DE LOS ANGELES RESTREPO')).toBe('Maria de los Angeles Restrepo');
    expect(formatPersonName('DE LA CRUZ JUAN')).toBe('De la Cruz Juan');
  });

  it('no inventa tildes pero conserva las que ya vienen', () => {
    expect(formatPersonName('JOSE')).toBe('Jose');
    expect(formatPersonName('JOSÉ PÉREZ')).toBe('José Pérez');
  });

  it('capitaliza cada segmento de nombres compuestos y es idempotente', () => {
    expect(formatPersonName('JEAN-PAUL SARTRE')).toBe('Jean-Paul Sartre');
    expect(formatPersonName('  PEDRO   GOMEZ  ')).toBe('Pedro Gomez');
    expect(formatPersonName('Alberto Galindo')).toBe('Alberto Galindo');
    expect(formatPersonName(null)).toBe('');
  });
});

describe('isAllCaps', () => {
  it('true solo si hay letras y ninguna minúscula', () => {
    expect(isAllCaps('ALBERTO')).toBe(true);
    expect(isAllCaps('JOSÉ')).toBe(true);
    expect(isAllCaps('Alberto')).toBe(false);
    expect(isAllCaps('123 - 456')).toBe(false);
    expect(isAllCaps('')).toBe(false);
  });
});

describe('dominios de correo', () => {
  it('un webmail no es dominio corporativo', () => {
    expect(isPublicEmailDomain('gmail.com')).toBe(true);
    expect(corporateDomainFromEmail('ana@gmail.com')).toBeNull();
    expect(corporateDomainFromEmail('ana@acme.com')).toBe('acme.com');
    expect(corporateDomainFromEmail('sin-arroba')).toBeNull();
  });

  it('normaliza el dominio de una empresa a solo host', () => {
    expect(normalizeDomain('https://www.acme.com/about')).toBe('acme.com');
    expect(normalizeDomain('  ACME.COM ')).toBe('acme.com');
    expect(normalizeDomain(null)).toBeNull();
  });
});

describe('normalizadores', () => {
  it('normalizeSource pasa a slug', () => {
    expect(normalizeSource('Feria Andina')).toBe('feria_andina');
    expect(normalizeSource('  ')).toBeNull();
  });

  it('normalizeCity aplica Title Case cuando no hay ciudad canónica', () => {
    expect(normalizeCity('  ciudad   de   mexico ')).toBe('Ciudad De Mexico');
    expect(normalizeCity('')).toBeNull();
  });

  it('cargoGroup agrupa cargos libres en familias', () => {
    expect(cargoGroup('Gerente General')).toBe('Gerencia');
    expect(cargoGroup('Directora de Operaciones')).toBe('Dirección');
    expect(cargoGroup('')).toBe('Sin cargo');
    expect(cargoGroup('Astronauta')).toBe('Otros');
  });

  it('canonicalLostReason colapsa sinónimos y conserva desconocidos', () => {
    expect(canonicalLostReason('precio')).toBe('Presupuesto / Precio');
    expect(canonicalLostReason('Competencia')).toBe('Competencia');
    expect(canonicalLostReason('Se mudó a Marte')).toBe('Se mudó a Marte');
    expect(canonicalLostReason('  ')).toBeNull();
  });
});

describe('ROLE_AREAS', () => {
  it('COMERCIAL opera el CRM pero no administra el equipo; PENDIENTE no entra a nada', () => {
    expect(roleCanAccess('COMERCIAL', 'crm')).toBe(true);
    expect(roleCanAccess('COMERCIAL', 'equipo')).toBe(false);
    expect(roleCanAccess('GERENTE', 'equipo')).toBe(true);
    expect(roleCanAccess('PENDIENTE', 'crm')).toBe(false);
  });
});
