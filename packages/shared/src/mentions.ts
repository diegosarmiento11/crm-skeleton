// Las @menciones en comentarios se guardan como un token estable `@[memberId]`
// donde memberId es el correo del miembro. El nombre se resuelve al pintar, así
// la mención sigue apuntando a la persona correcta aunque cambie de nombre.

/** Coincide con un token de mención; el grupo 1 es el id (correo). */
export const MENTION_TOKEN_RE = /@\[([^\]]+)\]/g;

/** Ids únicos, en minúscula, mencionados en el cuerpo de un comentario. */
export function extractMentionIds(body: string): string[] {
  const ids = new Set<string>();
  for (const m of body.matchAll(MENTION_TOKEN_RE)) {
    const id = m[1].trim().toLowerCase();
    if (id) ids.add(id);
  }
  return [...ids];
}
