#!/usr/bin/env node
/**
 * Puerta determinista para los comandos que no admiten "ya lo sabía".
 *
 * Las reglas de CLAUDE.md son consultivas y un modelo con el contexto lleno las olvida. Lo que
 * destruye datos, salta el flujo de migraciones o reescribe la historia pasa por aquí, decida lo
 * que decida el modelo:
 *
 *   deny  — nunca, sin importar quién lo pida por chat:
 *           · `prisma migrate reset` / `prisma db push` (saltan las migraciones a mano)
 *           · `git push --force` a `main`
 *   ask   — irreversible o hacia afuera; lo decide la persona:
 *           · `DROP`, `TRUNCATE`, `DELETE FROM` sin `WHERE` contra Postgres
 *           · `rm -rf` sobre el árbol del repositorio o `migrations/`
 *           · `git push --force` a cualquier otra rama, `git reset --hard`, `git checkout -- .`
 *           · `psql`/`prisma` apuntando a una URL que no sea localhost
 *
 * Registrado en .claude/settings.json (PreToolUse · Bash). Probar a mano:
 *   echo '{"tool_name":"Bash","tool_input":{"command":"pnpm prisma migrate reset"}}' \
 *     | node .claude/hooks/guard-bash.mjs
 */
import { readFileSync } from 'node:fs';

/**
 * Quita el CUERPO de un heredoc citado (`<<'EOF' … EOF`) antes de juzgar el comando. Ese cuerpo
 * es texto literal (el mensaje de un commit, el body de un PR), nunca algo que el shell ejecute.
 * Sin este filtro, un mensaje que EXPLICA una regla ("niega `prisma migrate reset`") dispara la
 * regla que describe. Un heredoc SIN comillas permite interpolación y no se toca.
 */
function stripQuotedHeredocs(cmd) {
  return cmd.replace(/<<-?\s*(['"])(\w+)\1([\s\S]*?)\n\2\b/g, (_m, _q, tag) => `<<'${tag}'\n${tag}`);
}

function read() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

const data = read();
if (!data || data.tool_name !== 'Bash') process.exit(0);

const cmd = String(data.tool_input?.command ?? '');
const flat = stripQuotedHeredocs(cmd).replace(/\s+/g, ' ').trim();

const DENY = [
  {
    test: /prisma (migrate reset|db push)/,
    reason:
      'Este repositorio lleva migraciones SQL revisadas a mano: `migrate reset` borra la base local ' +
      'y `db push` deja el esquema sin migración. Usa `pnpm migrate:dev` para crear una migración ' +
      'nueva y revísala antes de fiarte de ella.',
  },
  {
    test: /git push\b.*(--force\b|-f\b|--force-with-lease\b).*\b(origin\s+)?main\b|git push\b.*\bmain\b.*(--force\b|-f\b)/,
    reason: 'Nunca se reescribe `main`. Si hace falta deshacer algo, `git revert`.',
  },
];

const ASK = [
  {
    test: /\b(drop (table|database|schema)|truncate)\b/i,
    reason: 'Destruye datos. Confirma contra qué base corre.',
  },
  {
    test: /\bdelete from\s+\S+\s*(;|$|")/i,
    reason: 'Un `DELETE` sin `WHERE`. Confirma.',
  },
  {
    test: /rm -rf?\s+(\/|~|\.\s|\.$|\*|apps\b|packages\b|\S*migrations\b|\S*prisma\b)/,
    reason: 'Borra parte del árbol del repositorio. Confirma la ruta.',
  },
  {
    test: /git (push\b.*(--force|-f\b)|reset --hard|checkout -- \.|clean -fd|branch -D)/,
    reason: 'Descarta trabajo de forma irreversible. Confirma.',
  },
  {
    test: /\b(psql|prisma)\b.*postgres(ql)?:\/\/(?!localhost|127\.0\.0\.1)/,
    reason: 'Sesión o migración contra una base que no es la local. Confirma.',
  },
];

function decide(permissionDecision, reason) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason: reason },
    }),
  );
  process.exit(0);
}

for (const { test, reason } of DENY) if (test.test(flat)) decide('deny', reason);
for (const { test, reason } of ASK) if (test.test(flat)) decide('ask', reason);

process.exit(0);
