import { describe, expect, it } from 'vitest';
import type { CrmNote, CrmTask } from '@crm/shared';
import { detectMention, groupNotes, insertMention, isOwnNote, sortTasks, splitMentions } from './activityLogic';

const note = (id: string, created: string, parent: string | null = null): CrmNote => ({
  id,
  entity_type: 'lead',
  entity_id: '11111111-1111-4111-8111-111111111111',
  kind: 'comment',
  body: id,
  author: 'Ana',
  author_id: 'ana@acme.com',
  parent_id: parent,
  created_at: created,
});

describe('groupNotes', () => {
  it('ordena raíces de más nueva a más vieja y respuestas en orden cronológico', () => {
    const threads = groupNotes([
      note('a', '2026-01-01T10:00:00Z'),
      note('b', '2026-01-03T10:00:00Z'),
      note('a2', '2026-01-02T12:00:00Z', 'a'),
      note('a1', '2026-01-02T09:00:00Z', 'a'),
    ]);
    expect(threads.map((t) => t.root.id)).toEqual(['b', 'a']);
    expect(threads[1].replies.map((r) => r.id)).toEqual(['a1', 'a2']);
  });

  it('promueve a raíz una respuesta huérfana (su raíz se borró)', () => {
    const threads = groupNotes([note('x', '2026-01-01T10:00:00Z', 'missing')]);
    expect(threads).toHaveLength(1);
    expect(threads[0].root.id).toBe('x');
  });
});

describe('isOwnNote', () => {
  it('compara el correo sin importar mayúsculas', () => {
    expect(isOwnNote({ author_id: 'Ana@Acme.com' }, 'ana@acme.com')).toBe(true);
    expect(isOwnNote({ author_id: 'otro@acme.com' }, 'ana@acme.com')).toBe(false);
    expect(isOwnNote({ author_id: null }, 'ana@acme.com')).toBe(false);
  });
});

describe('menciones', () => {
  it('parte el cuerpo en texto y tokens', () => {
    expect(splitMentions('Hola @[ana@acme.com], mira esto')).toEqual([
      { type: 'text', value: 'Hola ' },
      { type: 'mention', id: 'ana@acme.com' },
      { type: 'text', value: ', mira esto' },
    ]);
  });

  it('detecta una mención en curso solo al inicio o tras un espacio', () => {
    expect(detectMention('hola @an', 8)).toEqual({ at: 5, text: 'an' });
    expect(detectMention('@', 1)).toEqual({ at: 0, text: '' });
    expect(detectMention('correo@acme', 11)).toBeNull();
    expect(detectMention('ya @[ana@acme.com]', 18)).toBeNull();
  });

  it('inserta el token en lugar del texto parcial y deja el cursor después', () => {
    const q = detectMention('hola @an fin', 8)!;
    const r = insertMention('hola @an fin', 8, q, 'ana@acme.com');
    expect(r.text).toBe('hola @[ana@acme.com]  fin');
    expect(r.caret).toBe('hola @[ana@acme.com] '.length);
  });
});

describe('sortTasks', () => {
  const task = (id: string, done: boolean, due: string | null, created: string): CrmTask => ({
    id,
    entity_type: 'lead',
    entity_id: '11111111-1111-4111-8111-111111111111',
    title: id,
    done,
    due_date: due,
    assignees: [],
    created_at: created,
  });

  it('pendientes por fecha (sin fecha al final) y hechas al final', () => {
    const sorted = sortTasks([
      task('done', true, null, '2026-01-05T00:00:00Z'),
      task('nodate', false, null, '2026-01-01T00:00:00Z'),
      task('late', false, '2026-02-01T00:00:00Z', '2026-01-01T00:00:00Z'),
      task('soon', false, '2026-01-10T00:00:00Z', '2026-01-01T00:00:00Z'),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(['soon', 'late', 'nodate', 'done']);
  });
});
