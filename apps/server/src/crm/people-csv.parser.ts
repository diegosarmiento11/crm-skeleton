import { parse } from 'csv-parse/sync';

// Parser del CSV de importación de personas. Tolerante a BOM, a columnas extra y
// a cabeceras en español o inglés. Columnas reconocidas (cualquier combinación):
//   name | nombre · first_name/last_name | nombres/apellidos · email | correo
//   phone | phone_number | telefono · job_title | cargo · company | empresa
export interface ImportedPerson {
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  company: string | null;
}

const pick = (r: Record<string, string>, keys: string[]): string => {
  for (const k of keys) {
    const v = r[k];
    if (v && v.trim()) return v.trim();
  }
  return '';
};

export function parsePeopleCsv(input: string | Buffer): ImportedPerson[] {
  const text = typeof input === 'string' ? input : input.toString('utf8');
  const records = parse(text, {
    columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
    skip_empty_lines: true,
    bom: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const out: ImportedPerson[] = [];
  for (const r of records) {
    const composed = [pick(r, ['first_name', 'nombres']), pick(r, ['last_name', 'apellidos'])]
      .filter(Boolean)
      .join(' ')
      .trim();
    const name = pick(r, ['name', 'nombre']) || composed;
    const email = pick(r, ['email', 'correo']).toLowerCase() || null;
    if (!name && !email) continue; // fila vacía: ni llave ni etiqueta
    out.push({
      name: name || (email as string),
      email,
      phone: pick(r, ['phone', 'phone_number', 'telefono', 'teléfono']) || null,
      job_title: pick(r, ['job_title', 'cargo']) || null,
      company: pick(r, ['company', 'empresa']) || null,
    });
  }
  return out;
}
