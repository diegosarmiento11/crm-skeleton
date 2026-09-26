---
name: crm-ui
description: Reglas del cliente React del CRM (apps/client) — shadcn/ui + Tailwind con tokens HSL, hooks TanStack Query por dominio, rutas lazy con gating por área y rol, copy en español. Cárgala antes de crear o tocar una página, un componente, un hook de datos o cualquier estilo.
---

# Interfaz

Vite 5 + React 18 + React Router 6 + TanStack Query 5 + React Hook Form + Zod + shadcn/ui.

## 1. Estructura

| Carpeta | Qué va | Qué no va |
|---|---|---|
| `pages/<módulo>/` | una ruta = un archivo; compone y no sabe de `api` | componentes reutilizables, fetching directo |
| `components/<módulo>/` | piezas del módulo (`crm/`, `team/`, `layout/`) | piezas de otro módulo (si dos las usan, suben a `components/common/`) |
| `components/ui/` | **solo lo que genera `pnpm dlx shadcn@latest add <nombre>`** | nada escrito a mano, nada que nombre el negocio |
| `components/common/` | piezas genéricas propias (`PillSelect`, `DatePicker`, `MultiPillSelect`) | |
| `hooks/use<Dominio>.ts` | todo el acceso a datos del dominio (`useCrm`, `useComments`, `useTeam`) | UI |
| `lib/` | `api.ts` (axios + identidad), `crm.ts` (formato y colores), `members.ts`, `dates.ts`, `utils.ts` | estado |
| `auth/` | `AuthContext` (`useAuth`), `RequireArea`, `session` | |
| `config/nav.ts` | menú y área/roles de cada ruta | |

## 2. Datos

- **Un hook por dominio**, y las claves de query como constantes al inicio del archivo:

  ```ts
  export const LEADS_KEY = ['crm', 'leads'] as const;
  export function useLeads(filters: LeadFilters) {
    return useQuery<LeadListResponse>({
      queryKey: [...LEADS_KEY, filters],
      queryFn: async () => (await api.get<LeadListResponse>('/crm/leads', { params: filters })).data,
    });
  }
  ```

- Mutaciones invalidan **por prefijo** del dominio: `invalidateQueries({ queryKey: CRM_KEY })`.
  Claves crudas inline repartidas por el archivo son la fuente de invalidaciones que no invalidan.
- Una nota o tarea nueva invalida también los leads (`useComments.ts` ya lo hace): la tarjeta
  muestra el contador, la salud y la próxima tarea.
- Tipos de request/response **de `@crm/shared`**. Si falta el tipo, se crea allí (carga `crm-shared`).
- Nada de `useEffect` + `useState` + `api.get`. Nada de estado global nuevo: los contextos que
  existen (`AuthContext`, `ConfirmProvider`, `CrmProfilesProvider`) son la lista cerrada.
- Listas largas (personas, empresas): paginadas desde el servidor; filas con `memo`.
- La salud del lead viene calculada del servidor (`lead.health`, `lead.health_reason`); el cliente
  no la recalcula.

## 3. Rutas y permisos

- Toda página se registra en `App.tsx` con **`lazyWithReload`** (recarga una vez si el chunk
  cambió tras un deploy). Solo `LoginPage` y `DashboardLayout` van estáticas.
- El `area` (y `roles`) que `config/nav.ts` declara para una ruta se aplica **también** en
  `App.tsx` con `<RequireArea area="crm" roles={['GERENTE']}>`. Si el menú oculta algo a un rol,
  la ruta tampoco se le abre.
- El servidor manda: el gating del cliente evita pantallas rotas, no protege datos.
- La identidad viaja en `lib/api.ts` (`Authorization: Bearer` o, en desarrollo, `X-Team-Email`).
  Conectar un proveedor real = poner su token en `session.token`; nada más cambia.

## 4. Diseño

- Tokens HSL de `src/index.css` por clases Tailwind: `bg-primary`, `text-muted-foreground`,
  `border-border`. **Ningún color, radio, sombra ni tamaño escrito a mano.** Modo oscuro por la
  clase `.dark`: todo token tiene sus dos valores.
- Escala de radios: controles `rounded-md`, tarjetas y paneles `rounded-xl`, modales
  `rounded-2xl`, pills `rounded-full`.
- Colores de etapa y de etiquetas solo por `stageColor()` y `tagColor()` de `lib/crm.ts`:
  cadenas de clase COMPLETAS, porque el JIT de Tailwind no genera clases construidas al vuelo.
- Overlays con `Dialog`, `Popover`, `Sheet`, `DropdownMenu` de `ui/`; nunca un `fixed inset-0`
  propio. Nada de `window.confirm`: existe `useConfirm()`.
- Iconos `lucide-react` con import nombrado. El foco visible no se quita; los controles custom
  son operables con teclado y llevan `aria-*`.
- Móvil: los filtros van a un `Sheet` (`useIsMobile`), el kanban muestra una etapa a la vez.

## 5. Copy

Español, tuteo, sin exclamaciones ni diminutivos en dinero, seguridad o errores. Estados vacíos
con una frase que dice qué hacer. Identificadores, rutas y claves en inglés. Errores de la API
con `apiErrorMessage(err)` en un toast de `sonner`.

## 6. Fechas y dinero

`DatePicker` común en vez de `<input type="date">`; convención local-midnight en `lib/dates`.
Dinero con `formatMoney` / `formatMoneyShort` de `lib/crm.ts` (`Intl.NumberFormat` con
`CRM_LOCALE`/`CRM_CURRENCY`), nunca concatenando el símbolo.

## 7. Cómo se prueba

Vitest en `src/**/*.test.ts(x)`. Helpers puros (`lib/dates`, agrupado de hilos, `groupByStage`)
con casos borde; hooks con `QueryClientProvider` y `api` sustituido cuando la invalidación
importa. `pnpm --filter @crm/client test -- src/lib/dates.test.ts`.

## Lista de comprobación

- [ ] Datos por el hook del dominio, con clave constante e invalidación por prefijo.
- [ ] Tipos de `@crm/shared`.
- [ ] Página con `lazyWithReload` y el `RequireArea`/`roles` que `nav.ts` declara.
- [ ] Nada escrito a mano en `components/ui/`; overlays de shadcn; `useConfirm()`.
- [ ] Solo tokens; radios según la escala; dos temas; colores de etapa por `stageColor()`.
- [ ] Copy en español y tuteo; identificadores en inglés; estados vacíos accionables.
- [ ] `DatePicker` y helpers de `lib/` para fechas y dinero.
- [ ] `pnpm --filter @crm/client typecheck`, `lint` (0 warnings) y `test` en verde.
