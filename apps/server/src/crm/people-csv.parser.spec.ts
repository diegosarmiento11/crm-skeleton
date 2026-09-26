import { parsePeopleCsv } from './people-csv.parser';

describe('parsePeopleCsv', () => {
  it('mapea nombre, correo (minúsculas), teléfono, cargo y empresa', () => {
    const csv = [
      'name,email,phone,job_title,company',
      'Raul Gomez,Raul@ACME.com,+57 300 123,Gerente,Acme',
    ].join('\n');
    const rows = parsePeopleCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      name: 'Raul Gomez',
      email: 'raul@acme.com',
      phone: '+57 300 123',
      job_title: 'Gerente',
      company: 'Acme',
    });
  });

  it('acepta cabeceras en español y arma el nombre desde nombres/apellidos', () => {
    const csv = ['Nombres,Apellidos,Correo,Cargo', 'Santiago,Luque,s@x.co,Director'].join('\n');
    const r = parsePeopleCsv(csv)[0];
    expect(r.name).toBe('Santiago Luque');
    expect(r.job_title).toBe('Director');
  });

  it('salta filas sin nombre ni correo y tolera BOM y columnas extra', () => {
    const csv = ['﻿name,email,extra', ',,x', 'Ana,,y'].join('\n');
    const rows = parsePeopleCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Ana');
    expect(rows[0].email).toBeNull();
  });
});
