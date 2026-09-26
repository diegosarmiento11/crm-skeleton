#!/usr/bin/env node
/**
 * Cierra el ciclo de verificación: un turno que cambió código no termina hasta que sus
 * comprobaciones pasan.
 *
 * Sin una comprobación que pueda correr, "parece terminado" es la única señal disponible y la
 * persona se convierte en el ciclo: cada error espera a que alguien lo note. Esto corre las
 * mismas comprobaciones que `pnpm verify`, pero **acotadas a lo que el turno tocó**, para que
 * el costo aterrice donde hubo trabajo:
 *
 *   --mark   PostToolUse (Write|Edit). Anota qué archivo cambió. No cuesta nada.
 *   --check  Stop. Si hay anotaciones, deduce los workspaces tocados y corre, por workspace:
 *              shared  → build + vitest (el servidor consume `dist`)
 *              server  → tsc --noEmit · eslint de los archivos tocados · jest
 *              client  → tsc --noEmit · eslint de los archivos tocados · vitest
 *              prisma  → prisma validate (y recuerda la migración si cambió el schema)
 *            Borra las anotaciones cuando todo pasa; si algo falla, bloquea el cierre del turno
 *            con la salida, para que se corrija la causa en el mismo turno.
 *
 * Un turno de conversación no paga nada; un turno que tocó código paga una vez (~20-40 s).
 *
 * Registrado en .claude/settings.json.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HOOKS, '..', '..');
const PENDING = join(HOOKS, '..', '.verify-pending');

/** Solo lo que las comprobaciones de abajo pueden juzgar. */
const CHECKED = /\.(ts|tsx|prisma|sql)$/;

function read() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

function loadPending() {
  try {
    return JSON.parse(readFileSync(PENDING, 'utf8'));
  } catch {
    return { files: [] };
  }
}

const mode = process.argv[2];
const data = read();
if (!data) process.exit(0);

if (mode === '--mark') {
  const file = String(data.tool_input?.file_path ?? '').replaceAll('\\', '/');
  if (CHECKED.test(file)) {
    const pending = loadPending();
    const rel = relative(ROOT, file).replaceAll('\\', '/');
    if (!pending.files.includes(rel)) pending.files.push(rel);
    mkdirSync(dirname(PENDING), { recursive: true });
    writeFileSync(PENDING, JSON.stringify(pending));
  }
  process.exit(0);
}

if (mode !== '--check') process.exit(0);

// El Stop hook re-entrando sobre sí mismo se quedaría en bucle con un fallo que no se arregla
// por correr otra vez.
if (data.stop_hook_active) process.exit(0);
if (!existsSync(PENDING)) process.exit(0);

const { files } = loadPending();
const existing = files.filter((f) => existsSync(join(ROOT, f)));

const touched = {
  shared: files.some((f) => f.startsWith('packages/shared/')),
  server: files.some((f) => f.startsWith('apps/server/') && !f.includes('/prisma/')),
  client: files.some((f) => f.startsWith('apps/client/')),
  schema: files.some((f) => f.endsWith('schema.prisma')),
  migration: files.some((f) => /apps\/server\/prisma\/migrations\/.*\.sql$/.test(f)),
};
// Un cambio en el contrato compromete a los dos consumidores.
if (touched.shared) touched.server = touched.client = true;

const lintable = (prefix) =>
  existing.filter((f) => f.startsWith(prefix) && /\.(ts|tsx)$/.test(f)).map((f) => f.slice(prefix.length));

const checks = [];
if (touched.shared) {
  checks.push({ label: 'Contrato compartido: build', cwd: 'packages/shared', command: 'pnpm build' });
  checks.push({ label: 'Contrato compartido: pruebas', cwd: 'packages/shared', command: 'npx vitest run' });
}
if (touched.schema) {
  checks.push({ label: 'Prisma: validate', cwd: 'apps/server', command: 'npx prisma validate' });
}
if (touched.server) {
  const list = lintable('apps/server/');
  checks.push({ label: 'Servidor: tipos', cwd: 'apps/server', command: 'npx tsc --noEmit -p tsconfig.json' });
  if (list.length)
    checks.push({
      label: 'Servidor: eslint (archivos tocados)',
      cwd: 'apps/server',
      command: `npx eslint --max-warnings=0 ${list.map((f) => JSON.stringify(f)).join(' ')}`,
    });
  checks.push({ label: 'Servidor: pruebas', cwd: 'apps/server', command: 'npx jest --silent' });
}
if (touched.client) {
  const list = lintable('apps/client/');
  checks.push({ label: 'Cliente: tipos', cwd: 'apps/client', command: 'npx tsc --noEmit' });
  if (list.length)
    checks.push({
      label: 'Cliente: eslint (archivos tocados)',
      cwd: 'apps/client',
      command: `npx eslint --max-warnings=0 ${list.map((f) => JSON.stringify(f)).join(' ')}`,
    });
  checks.push({ label: 'Cliente: pruebas', cwd: 'apps/client', command: 'npx vitest run' });
}

const failures = [];
for (const { label, cwd, command } of checks) {
  try {
    execSync(command, { cwd: join(ROOT, cwd), stdio: 'pipe', env: { ...process.env, CI: '1', FORCE_COLOR: '0' } });
  } catch (error) {
    const output = [error.stdout?.toString() ?? '', error.stderr?.toString() ?? ''].join('\n');
    failures.push(`### ${label}: \`${command}\` (en ${cwd})\n\n${output.trim().slice(-3000)}`);
  }
}

const notes = [];
if (touched.schema && !touched.migration) {
  notes.push(
    '`schema.prisma` cambió y este turno no escribió ninguna migración en ' +
      '`apps/server/prisma/migrations/`. Si el cambio toca columnas o tablas, falta ' +
      '`pnpm migrate:dev` y revisar el SQL con su comentario.',
  );
}

if (failures.length === 0) {
  rmSync(PENDING, { force: true });
  if (notes.length) console.log(JSON.stringify({ systemMessage: notes.join('\n') }));
  process.exit(0);
}

console.log(
  JSON.stringify({
    decision: 'block',
    reason: [
      'La verificación de este cambio está en rojo, así que el trabajo no está terminado.',
      'Son las mismas comprobaciones que corre `pnpm verify`, acotadas a los workspaces que tocó este turno.',
      '',
      'Corrige la causa; no silencies la comprobación.',
      '',
      ...notes,
      ...failures,
    ].join('\n'),
  }),
);
