import { MENTION_TOKEN_RE, type CrmNote, type CrmTask } from '@crm/shared';
import { normalizeMemberId } from '@/lib/members';

// Lógica pura del feed de actividad, separada del componente para poder probarla
// sin DOM (y para que ActivityFeed.tsx exporte solo componentes: react-refresh).

export interface NoteThread {
  root: CrmNote;
  /** Respuestas en orden cronológico (la más vieja primero), como un chat. */
  replies: CrmNote[];
}

/**
 * Agrupa las notas en hilos de UN nivel: raíces (más nuevas arriba) con sus
 * respuestas debajo. Una respuesta cuya raíz ya no existe (se borró) se promueve
 * a raíz para que nunca desaparezca del historial.
 */
export function groupNotes(notes: CrmNote[]): NoteThread[] {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const repliesByParent = new Map<string, CrmNote[]>();
  const roots: CrmNote[] = [];
  for (const n of notes) {
    if (n.parent_id && byId.has(n.parent_id)) {
      const arr = repliesByParent.get(n.parent_id) ?? [];
      arr.push(n);
      repliesByParent.set(n.parent_id, arr);
    } else {
      roots.push(n);
    }
  }
  const time = (n: CrmNote) => new Date(n.created_at).getTime();
  roots.sort((a, b) => time(b) - time(a));
  return roots.map((root) => ({
    root,
    replies: (repliesByParent.get(root.id) ?? []).sort((a, b) => time(a) - time(b)),
  }));
}

/** Solo el autor edita o borra su nota; la identidad estable es el correo (author_id). */
export function isOwnNote(note: Pick<CrmNote, 'author_id'>, myEmail: string | null | undefined): boolean {
  if (!note.author_id || !myEmail) return false;
  return normalizeMemberId(note.author_id) === normalizeMemberId(myEmail);
}

export type MentionSegment = { type: 'text'; value: string } | { type: 'mention'; id: string };

/** Parte el cuerpo de una nota en texto plano y tokens `@[correo]`, para pintarlos distinto. */
export function splitMentions(body: string): MentionSegment[] {
  const re = new RegExp(MENTION_TOKEN_RE.source, 'g');
  const out: MentionSegment[] = [];
  let last = 0;
  for (const m of body.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ type: 'text', value: body.slice(last, idx) });
    out.push({ type: 'mention', id: m[1].trim().toLowerCase() });
    last = idx + m[0].length;
  }
  if (last < body.length) out.push({ type: 'text', value: body.slice(last) });
  return out;
}

export interface MentionQuery {
  /** Índice del `@` en el texto. */
  at: number;
  /** Lo escrito después del `@`, en minúscula. */
  text: string;
}

/**
 * Detecta si el cursor está escribiendo una mención: un `@` al inicio o tras un
 * espacio, seguido de texto sin espacios hasta el cursor. Un `@[` ya cerrado no
 * cuenta (el token ya está insertado).
 */
export function detectMention(text: string, caret: number): MentionQuery | null {
  const m = /(^|\s)@([^\s@[\]]*)$/.exec(text.slice(0, caret));
  if (!m) return null;
  return { at: caret - m[2].length - 1, text: m[2].toLowerCase() };
}

/** Inserta el token `@[id] ` en lugar de lo que se venía escribiendo tras el `@`. */
export function insertMention(text: string, caret: number, query: MentionQuery, id: string): { text: string; caret: number } {
  const before = text.slice(0, query.at);
  const inserted = `@[${id}] `;
  return { text: before + inserted + text.slice(caret), caret: (before + inserted).length };
}

/** Pendientes primero (la más próxima arriba, sin fecha al final); hechas después, la más reciente arriba. */
export function sortTasks(tasks: CrmTask[]): CrmTask[] {
  const due = (t: CrmTask) => (t.due_date ? new Date(t.due_date).getTime() : Number.POSITIVE_INFINITY);
  const created = (t: CrmTask) => new Date(t.created_at).getTime();
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (!a.done) return due(a) - due(b) || created(b) - created(a);
    return created(b) - created(a);
  });
}
