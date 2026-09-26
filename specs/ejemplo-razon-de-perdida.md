# Capturar la razón de pérdida al mover un lead a Perdido

> Ejemplo de especificación. Describe un cambio que ya está implementado en este repositorio,
> para mostrar el formato y el nivel de detalle esperado.

**Qué resuelve.** Hoy sabemos cuántos leads se pierden pero no por qué; el reporte del embudo no
puede decir si la fuga es de precio, de fit o de tiempos.

## Alcance
- Al soltar un lead en la etapa `LOST` del kanban se abre un diálogo que pide la razón, con
  selección única entre las razones canónicas.
- "Omitir" deja el lead sin razón; aparece como "Sin razón" en el reporte.
- El reporte de pérdidas del embudo agrupa por razón, en el orden canónico, con conteo y valor.
- Las razones escritas de otra forma ("precio", "sin presupuesto") se canonizan al guardar.

## Fuera de alcance
- Razones personalizadas por equipo: las cinco canónicas cubren el playbook; abrir la lista
  fragmenta el reporte, que es justo lo que se quiere evitar.
- Pedir la razón al mover a `LOST` desde el diálogo de edición: el cambio de etapa se hace desde
  el tablero para que quede el evento; el diálogo no cambia etapas.

## Toca
| Capa | Archivo | Qué cambia |
|---|---|---|
| shared | `packages/shared/src/schemas/crm.schema.ts` | `LOST_REASONS`, `canonicalLostReason`, `lost_reason` en `LeadSchema`/`UpdateLeadSchema`, `loss.reasons` en `PipelineAnalyticsSchema` |
| prisma | `schema.prisma` + migración | columna `leads.lost_reason TEXT NULL` |
| server | `apps/server/src/crm/crm.service.ts` | canonizar en `updateLead`; agrupar en `pipelineAnalytics` |
| client | `apps/client/src/components/crm/LostReasonDialog.tsx`, `PipelineBoard.tsx` | abrir el diálogo al soltar en `LOST` |
| client | `apps/client/src/components/crm/FunnelTables.tsx` | tabla de pérdidas por razón |

## Reglas de negocio
- Aplica 5.1 y 5.2 de `docs/reglas-de-negocio.md` (esta especificación las introduce).
- Roles: cualquier rol con área `crm` captura la razón; el reporte lo ve GERENTE.

## Restricciones
- `crm-shared`: la lista canónica vive en el contrato, no en el cliente.
- `crm-api`: canonizar al guardar, no al leer; el reporte lee `kind === 'LOST'`, no el nombre.
- `crm-ui`: selección única con `PillSelect`; sin texto libre.

## Criterios de aceptación
1. Dado un lead en `Propuesta enviada`, cuando se suelta en `Perdido`, entonces se abre el
   diálogo con las cinco razones y la primera preseleccionada.
2. Dado el diálogo abierto, cuando se elige "Competencia" y se guarda, entonces `lost_reason`
   queda `"Competencia"` y el reporte muestra una fila "Competencia" con el valor del lead.
3. Dado el diálogo abierto, cuando se pulsa "Omitir", entonces el lead queda en `Perdido` sin
   razón y el reporte lo cuenta en "Sin razón", al final.
4. Dado un `PATCH /leads/:id` con `lost_reason: "precio"`, entonces se guarda
   `"Presupuesto / Precio"`.

## Verificación de punta a punta
1. `pnpm --filter server test -- crm.service.spec.ts` (casos «canoniza la razón» y «reporte de
   pérdidas agrupa por razón») en verde.
2. `pnpm dev:all`; entrar como `comercial@example.com`; arrastrar el lead de muestra a Perdido;
   elegir "Competencia".
3. `curl -H 'X-Team-Email: gerente@example.com' localhost:8082/api/v1/crm/pipeline/analytics | jq .loss.reasons`
   muestra `[{ "key": "Competencia", "count": 1, ... }]`.
4. Entrar como `gerente@example.com`, abrir Embudo → "Pérdidas por razón" muestra la fila.

## Preguntas abiertas
- Ninguna que bloquee. Si el equipo pide más razones, se añaden a `LOST_REASONS` con su sinónimo.
