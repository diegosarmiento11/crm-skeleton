#!/usr/bin/env node
/**
 * Inyecta las reglas de la zona justo antes de que se escriba un archivo de esa zona.
 *
 * Las skills son consultivas: se cargan cuando el modelo juzga que aplican, y ese juicio es más
 * débil justo en el caso que más importa: crear un archivo que todavía no existe, porque no hay
 * nada que leer que hubiera traído las reglas. Un hook corre sobre la llamada a la herramienta,
 * decida lo que decida el modelo, y es el único mecanismo que cubre la creación desde cero.
 *
 * Recuerda; no bloquea. Las excepciones:
 *   - editar una migración que ya está en el historial → pregunta (se corrige hacia adelante),
 *   - escribir un secreto (`.env`, `*.pem`, `service-account*.json`) → pregunta,
 *   - escribir a mano dentro de `components/ui/` → recuerda que se añade con shadcn.
 *
 * Registrado en .claude/settings.json (PreToolUse · Write|Edit). Probar a mano:
 *   echo '{"tool_name":"Write","tool_input":{"file_path":"'$PWD'/apps/server/src/crm/x.controller.ts"}}' \
 *     | node .claude/hooks/rules-for-path.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Una entrada por zona. `rules` lleva lo que más se rompe ahí, no todo el conjunto: un
 * recordatorio que nadie lee es peor que ninguno; el conjunto completo vive en la skill.
 *
 * **Toda entrada que coincida aplica**, no solo la primera: un `*.spec.ts` dentro de
 * `apps/server/src/crm/` recibe las reglas del servidor y las de pruebas.
 */
const AREAS = [
  // ── Servidor ────────────────────────────────────────────────────────────────
  {
    test: /apps\/server\/src\/.*\.controller\.ts$/,
    skill: 'crm-api',
    rules: [
      'Todo controlador declara `@UseGuards(TeamGuard)` y `@RequireArea(...)` A NIVEL DE CLASE (o `ApiKeyGuard` si lo llama una máquina). Sin guard = endpoint público.',
      'El body se valida con un DTO `createZodDto(Schema)` cuyo schema vive en `packages/shared/src/schemas`. Nada de `@Body() body: any`.',
      'Rutas bajo `api/v1/`, en inglés, kebab-case. Las rutas fijas (`facets`, `reorder`) van ANTES de `:id`. El controlador parsea query y delega: la lógica va al servicio.',
      'Acciones de dirección (analítica, etapas, equipo) llevan además `@RequireRole(\'GERENTE\')`.',
    ],
  },
  {
    test: /apps\/server\/src\/.*\.service\.ts$/,
    skill: 'crm-api',
    rules: [
      'Varias escrituras que deben ir juntas van en `prisma.$transaction` (lead + evento de etapa; borrar un registro + sus notas/tareas sin FK).',
      'Cada cambio de etapa de un lead deja un `LeadStageEvent`: de ahí sale toda la analítica. Nunca se edita ni se borra un evento.',
      'Los listados se paginan (`page`/`limit` con tope) y filtran en SQL, no en memoria.',
      'Nada de `$queryRawUnsafe` ni SQL concatenado con datos. `$queryRaw` con template solo si Prisma no alcanza; en `ILIKE`, escapar `%`, `_` y `\\`.',
      'Otro módulo se usa por su servicio exportado o por `CrmPortService`, no importando archivos internos ni tocando tablas ajenas con Prisma.',
      'Errores de negocio con las excepciones de Nest, mensaje en español para la persona. Nada de `console.*`: `Logger`.',
    ],
  },
  {
    test: /apps\/server\/src\/jobs\/.*\.ts$/,
    skill: 'crm-api',
    rules: [
      'Un job es idempotente: correr dos veces el mismo día no duplica ni cambia datos por segunda vez.',
      'Va bajo `POST /api/v1/jobs/*` con `ApiKeyGuard` (clave de máquina), nunca con `TeamGuard`, y devuelve un resumen con conteos.',
      'Nunca falla en silencio: lanza (el filtro global lo registra) o devuelve un resultado que diga que falló.',
    ],
  },
  {
    test: /apps\/server\/src\/(auth|common\/guards)\/.*\.ts$/,
    skill: 'crm-api',
    rules: [
      'La identidad la resuelve el `IdentityProvider`; el guard solo autoriza contra `ROLE_AREAS`. No mezclar las dos cosas.',
      'El seam `X-Team-Email` existe SOLO con `AUTH_ENABLED=false`; `validateEnv` impide que llegue a producción. No añadas otro camino sin verificar.',
      'La impersonación cambia solo el rol, nunca la identidad, y solo la puede pedir un GERENTE.',
    ],
  },
  // ── Datos ───────────────────────────────────────────────────────────────────
  {
    test: /apps\/server\/prisma\/schema\.prisma$/,
    skill: 'crm-db',
    rules: [
      'Columnas `snake_case`, PK `String @id @default(uuid()) @db.Uuid`, tabla con `@@map("snake_case")`.',
      'Toda FK con `onDelete` explícito y su `@@index`. Toda tabla con `created_at`/`updated_at` y un comentario `//` en español que diga para qué existe.',
      'Un cambio aquí trae su migración SQL en el mismo cambio, revisada y comentada.',
      'Un enum nuevo se declara también en `packages/shared/src/enums` (Prisma + const + Zod): los tres tienen que coincidir.',
    ],
  },
  {
    test: /apps\/server\/prisma\/migrations\/.*\.sql$/,
    skill: 'crm-db',
    rules: [
      'La migración empieza con un comentario `--` en español que dice por qué existe el cambio.',
      'La marca de tiempo va DESPUÉS de la última migración que ya está en `main`.',
      'Lo que pueda escribirse idempotente (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `WHERE NOT EXISTS`) se escribe así.',
    ],
  },
  // ── Contrato compartido ─────────────────────────────────────────────────────
  {
    test: /packages\/shared\/src\/.*\.ts$/,
    skill: 'crm-shared',
    rules: [
      'Un campo nuevo nace aquí (schema Zod) antes que en el servidor o el cliente, y se exporta desde `src/index.ts` con su tipo inferido.',
      'El servidor corre contra `dist`: tras cambiar algo aquí, `pnpm --filter @crm/shared build` antes de arrancarlo o de fiarse de sus tipos.',
      '`ROLE_AREAS` es la única matriz de permisos: los dos lados la leen. No se duplica en `nav.ts` ni en un guard.',
      'Aquí solo hay funciones puras: nada que importe Nest, React, Prisma o un SDK.',
    ],
  },
  // ── Cliente ─────────────────────────────────────────────────────────────────
  {
    test: /apps\/client\/src\/components\/ui\/.*\.tsx$/,
    skill: 'crm-ui',
    rules: [
      '`components/ui/` no se escribe a mano: `pnpm dlx shadcn@latest add <nombre>`. Aquí solo se ajusta lo que shadcn generó.',
      'Una pieza de `ui/` no nombra el negocio ni importa de hooks/, pages/ ni lib/api.',
    ],
  },
  {
    test: /apps\/client\/src\/(?!components\/ui\/).*\.tsx$/,
    skill: 'crm-ui',
    rules: [
      'Ningún color, radio ni tamaño escrito a mano: clases Tailwind sobre los tokens de `index.css`. Radios: controles `md`, tarjetas `xl`, modales `2xl`, pills `full`.',
      'Los datos llegan por el hook de su dominio en `src/hooks/` (TanStack Query). Nada de `useEffect` + `useState` + `api.get`.',
      'Copy en español, tuteo, sin exclamaciones. Identificadores en inglés.',
      'Una página nueva se registra en `App.tsx` con `lazyWithReload` y con el `<RequireArea>` (y `roles`) que `config/nav.ts` declara.',
      'Overlays con `Dialog`/`Popover`/`Sheet` de `ui/`; confirmaciones con `useConfirm()`, nunca `window.confirm`.',
    ],
  },
  {
    test: /apps\/client\/src\/hooks\/.*\.ts$/,
    skill: 'crm-ui',
    rules: [
      'Un hook por dominio. Claves de query como tuplas declaradas como constantes al inicio del archivo.',
      'Las mutaciones invalidan por prefijo de dominio (`queryClient.invalidateQueries({ queryKey: CRM_KEY })`), no clave por clave.',
      'Los tipos de request/response vienen de `@crm/shared`; nada tipado a mano que ya exista en el contrato.',
    ],
  },
  // ── Pruebas ─────────────────────────────────────────────────────────────────
  {
    test: /\.(spec|test)\.(ts|tsx)$/,
    skill: 'crm-delivery',
    rules: [
      '`describe`/`it` en español y dicen el comportamiento y el riesgo, no el método (`"rechaza un parent_id ajeno"`, no `"createNote"`).',
      'Los servicios se sustituyen con objetos `jest.fn()`/`vi.fn()` tipados `as unknown as Service`; no se levanta Nest ni Prisma para una unidad. Lo que cruza guards y pipes va en `test/*.e2e-spec.ts`.',
      'La prueba se rompe a propósito antes de darla por buena, y se comprueba que se pone en rojo por el motivo que dice vigilar.',
      'Una prueba que recorre archivos o filas afirma primero CUÁNTOS encontró: una lista vacía cumple cualquier comprobación.',
    ],
  },
  // ── Especificaciones y decisiones ───────────────────────────────────────────
  {
    test: /(specs\/.*\.md|docs\/decisiones\/.*\.md)$/,
    skill: 'spec',
    rules: [
      'Una especificación se sostiene sola: nombra los archivos que toca, dice qué queda fuera y termina con una verificación de punta a punta ejecutable.',
      'Una decisión (`docs/decisiones/<fecha>-<tema>.md`) dice qué se eligió, qué se descartó y POR QUÉ, para que no vuelva a proponerse sin nueva información.',
    ],
  },
];

/** Una migración ya en el historial es la edición que necesita a una persona. */
function isTrackedMigration(path) {
  if (!/apps\/server\/prisma\/migrations\/.*\.sql$/.test(path)) return false;
  try {
    execFileSync('git', ['cat-file', '-e', `HEAD:${path}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const SECRET = /(^|\/)(\.env(\.[^/]+)?|service-account[^/]*\.json|[^/]+\.pem)$/;

function read() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

const data = read();
if (!data) process.exit(0);

const tool = data.tool_name ?? '';
if (tool !== 'Write' && tool !== 'Edit') process.exit(0);

/**
 * La ruta, dos veces: la absoluta para decidir (los patrones no van anclados y aciertan viva
 * donde viva el repositorio) y una corta para el mensaje.
 */
const absolute = (data.tool_input?.file_path ?? '').replaceAll('\\', '/');
const root = (process.env.CLAUDE_PROJECT_DIR ?? '').replaceAll('\\', '/');
const path =
  root && absolute.startsWith(root)
    ? absolute.slice(root.length + 1)
    : (/(?:^|\/)((?:apps|packages|docs|specs|scripts|\.claude)\/.*)$/.exec(absolute)?.[1] ?? absolute);

function ask(reason) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

if (SECRET.test(path) && !/\.env\.example$/.test(path)) {
  ask(
    `«${path}» es un archivo de secretos. Claude no debería escribirlo: pide a la persona ` +
      'que lo edite (o que ejecute el comando con `!`). Si es intencional, aprueba.',
  );
}

if (tool === 'Edit' && isTrackedMigration(path)) {
  ask(
    'Una migración ya integrada no se modifica: se corrige hacia adelante con una migración ' +
      'nueva. Editarla deja producción y local en estados distintos sin ninguna señal ' +
      '(`prisma migrate deploy` ya la marcó como aplicada).\n\nÚnica excepción: una migración que ' +
      'falló a medias y no puede volver a ejecutarse. Si es ese el caso, dilo en el commit.',
  );
}

const areas = AREAS.filter(({ test }) => test.test(absolute));
if (areas.length === 0) process.exit(0);

const skills = [...new Set(areas.map(({ skill }) => skill))];
const plural = skills.length > 1;

const reminder = [
  `REGLAS DE ESTA ZONA (hook automático): aplican a ${path}:`,
  '',
  ...areas.flatMap(({ rules }) => rules).map((rule) => `- ${rule}`),
  '',
  `Son las que más se saltan aquí, no todas. El conjunto completo y su lista de comprobación`,
  `están en ${skills.map((s) => `\`${s}\``).join(' y ')}: ${plural ? 'cárgalas' : 'cárgala'} si no ${plural ? 'las' : 'la'} has cargado en esta sesión.`,
].join('\n');

console.log(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: reminder },
    suppressOutput: true,
  }),
);
