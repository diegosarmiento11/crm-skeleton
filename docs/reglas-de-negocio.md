# Reglas de negocio del CRM

Este documento dice **qué debe pasar**, no cómo está escrito. Cada regla tiene dueño en el
código (se nombra el archivo) y, cuando la regla se puede romper sin que nada falle, una prueba
que la vigila. Si un cambio contradice una regla de aquí, se cambia primero la regla (con su
razón) y después el código.

Vocabulario: **lead** = un negocio en el pipeline; **persona** y **empresa** = los registros de
contacto; **etapa** = columna del kanban; **evento de etapa** = una fila del log de transiciones;
**punto de contacto** = una nota de tipo correo, WhatsApp o llamada.

---

## 1. Modelo: quién es quién

1.1 **Los datos de contacto no viven en el lead.** Un lead enlaza a una empresa (`company_id`) y a
varias personas (`lead_persons`, ordenadas). El nombre visible del lead (`company`) es texto
libre porque un negocio puede llamarse distinto a la empresa. *(schema.prisma · Lead)*

1.2 **Una persona pertenece a lo sumo a una empresa.** Borrar la empresa deja a la persona sin
empresa (`SetNull`), no la borra.

1.3 **Borrar un registro se lleva sus notas y tareas**, que no tienen llave foránea (referencia
polimórfica). Se hace en la misma transacción. *(crm.service · deleteLead, people.service ·
remove, companies.service · remove)*

1.4 **El id estable de un miembro del equipo es su correo en minúscula**, no el UUID de
`team_users`. Así lo guardan `lead.owner`, `crm_tasks.assignees`, `crm_notes.author_id` y
`lead_stage_events.owner`. Sobrevive a un cambio de proveedor de identidad.

---

## 2. Pipeline y etapas

2.1 **Las etapas las define el equipo** (nombre, color, orden), pero cada una declara su papel en
el embudo con `kind`: `OPEN`, `QUALIFY`, `PROPOSAL`, `WON`, `LOST`. La analítica decide **solo por
`kind`**, nunca por el nombre: renombrar "Ganado" a "Cerrado" no rompe ningún reporte.
*(enums · STAGE_KINDS; crm.service · pipelineAnalytics)*

2.2 **Solo puede haber una etapa `WON`, una `LOST`, una `QUALIFY` y una `PROPOSAL`.** `OPEN`
puede repetirse. Crear o cambiar una segunda responde 409. *(crm.service · ensureSingleKind;
prueba: crm.service.spec «solo puede haber una etapa WON»)*

2.3 **Una etapa con leads no se borra** (409). Primero se mueven los leads. *(FK `Restrict` +
crm.service · deleteStage; prueba: «no deja borrar una etapa con leads»)*

2.4 **Crear, editar, reordenar y borrar etapas es de Gerencia** (`@RequireRole('GERENTE')`).
Un comercial las ve, no las cambia. Lo mismo para la meta mensual.

2.5 **Dentro de una etapa los leads tienen posición 0..n.** Mover un lead re-secuencia la columna
destino a un rango limpio para que el orden sea estable entre usuarios. Una posición fuera de
rango se acota al final. *(crm.service · moveLead; prueba: «re-secuencia la columna destino»)*

2.6 **Las etapas por defecto** (Nuevo, Diagnóstico=QUALIFY, Propuesta enviada=PROPOSAL,
Negociación, En pausa, Ganado=WON, Perdido=LOST) las crea la migración base solo si la tabla
está vacía. El seed no las toca.

---

## 3. El log de etapas es la fuente de la analítica

3.1 **Cada cambio de etapa deja un `LeadStageEvent`** con `from_stage_id`, `to_stage_id`, el
`owner` del lead en ese momento y la hora. Un lead nuevo deja su evento inicial con `from = null`.
El log es **append-only**: nunca se edita ni se borra un evento (salvo en cascada al borrar el
lead). *(crm.service · createLead/updateLead/moveLead; prueba: «registra un LeadStageEvent con
from/to»; e2e: «crear y mover un lead deja su rastro»)*

3.2 **Lead y evento se escriben en la misma transacción.** Si falla el evento, no queda un lead
invisible para la analítica.

3.3 **`stage_changed_at` se actualiza solo cuando cambia la etapa**, no en cualquier edición. Es
la base de "días en etapa".

3.4 Del log salen: leads que **alguna vez** pasaron por cada etapa (`reached_count`), conversión
etapa a etapa (`reached[i] / reached[i-1]`), días históricos por etapa (estadías **completadas**:
entrada → siguiente transición), ciclo de venta (creación → entrada a `WON`), desde qué etapa se
perdió cada lead (última transición hacia `LOST`) y el desempeño por persona.

3.5 **Las estadías menores a un minuto se ignoran** en los promedios y en el recorrido del lead:
son artefactos (un movimiento corregido al instante, un backfill), no una estadía real.
*(prueba: «oculta las estadías-artefacto»)*

---

## 4. Salud, actividad y señales

4.1 **Actividad = punto de contacto**, no comentario. Solo las notas de tipo `email`, `whatsapp`
o `call` cuentan como "última actividad" del lead; un comentario interno no es contactar al
cliente. La actividad de las personas asociadas al lead también cuenta para el lead.
*(comments.schema · TOUCHPOINT_KINDS; crm.service · leadMeta)*

4.2 **La salud del lead es una regla, no una caja negra**, y vive en un solo sitio
(`packages/shared/src/health.ts`) para que servidor y cliente calculen lo mismo:

| Situación | Banda |
|---|---|
| lead cerrado | sin salud |
| sin responsable | en riesgo |
| sin actividad registrada: < 14 d en etapa / ≥ 14 d | frío / en riesgo |
| ≥ 14 d sin actividad o ≥ 21 d en etapa | en riesgo |
| ≥ 7 d sin actividad o ≥ 14 d en etapa | frío |
| ≥ 3 d sin actividad o ≥ 7 d en etapa | tibio |
| resto | activo |

*(prueba: health.test.ts)*

4.3 **SLA de seguimiento (playbook comercial):** un lead que lleva más de **10 días** en una etapa
vigilada (`QUALIFY` o `PROPOSAL`) sin actividad en esa ventana viola el SLA y aparece en el
embudo. Se evalúa sobre todos los leads que están hoy en esas etapas, no sobre la cohorte del
periodo: un lead viejo estancado también incumple. *(crm.service · SLA_DAYS; prueba: «marca la
violación de SLA»)*

4.4 **Estancado** = lead abierto con más de **14 días** sin cambiar de etapa. *(STALLED_DAYS)*

4.5 **Una tarea de lead sin responsables se asigna al responsable del lead**, para que aparezca en
sus pendientes y no se pierda. *(comments.service · createTask; prueba: «se asigna al
responsable del lead»)*

4.6 **Las tareas vencidas** (pendientes con fecha pasada) y los leads en riesgo o estancados son
las señales que resume el digest diario (`POST /api/v1/jobs/crm-digest`).

---

## 5. Pérdidas y razones

5.1 **Al mover un lead a `LOST` se pide la razón de pérdida**, con selección única entre las
razones canónicas (`LOST_REASONS`, en `crm.schema.ts`). "Omitir" deja el lead sin razón y aparece
como "Sin razón" en el reporte. La razón solo tiene sentido en la etapa `LOST`.

5.2 **Las razones se canonizan al guardar** ("precio" → "Presupuesto / Precio") para que el
reporte no se fragmente; un texto desconocido se conserva tal cual. El orden de `LOST_REASONS` es
el orden del reporte. *(prueba: «canoniza la razón de pérdida»)*

5.3 **Prospecto ≠ lead.** Un contacto en frío no entra al pipeline hasta que responde con una
señal de interés real. Meter prospectos y marcarlos "Perdido" al no responder infla la tasa de
pérdida y mezcla dos juegos distintos (volumen vs. conversión). Este CRM modela el pipeline;
la prospección va aparte (ver `docs/decisiones/2026-09-25-prospecto-no-es-lead.md`).

---

## 6. Personas y empresas

6.1 **Todo lo que se compara se guarda normalizado al escribir:** correos en minúscula, dominio
de empresa a solo host (`https://www.acme.com/x` → `acme.com`), origen a slug (`Feria Andina` →
`feria_andina`), ciudad canónica, cadena vacía → `null`. *(companies.service / people.service ·
normalize; e2e: «crear persona con correo corporativo»)*

6.2 **Asociación automática persona → empresa por dominio de correo**, con tres guardas:
- solo dominios **corporativos**: un webmail (gmail, hotmail, outlook…) nunca identifica a una
  empresa; *(enums · PUBLIC_EMAIL_DOMAINS)*
- solo si el dominio identifica a **una sola** empresa; si hay varias, no se enlaza;
- **una decisión manual siempre gana**: al editar, si el usuario tocó `company_id` (incluso para
  quitarla) no se auto-asocia, y una persona que ya tiene empresa no se cambia.
*(person-matcher.service; prueba: people.service.spec)*

6.3 **Teléfonos en E.164** (`+573001234567`), validados por país con la misma regla en el
formulario y en el DTO. *(crm.schema · PhoneE164Schema)*

6.4 **Estado de contacto** (`CONTACTAR`, `NO_CONTACTAR`, `DE_BAJA`): `DE_BAJA` es un bloqueo duro
de envío (baja, rebote duro, queja de spam) que pone el sistema y se puede revertir a mano.
Cualquier flujo de envío que se añada **debe respetarlo**. El CRM lo expone al exterior por
`CrmPort.updatePersonContactStatus`.

6.5 **Importar personas desde CSV**: dedup por correo (si existe, se salta y no se pisa), las filas
sin correo no se importan (no hay llave ni canal), los nombres en MAYÚSCULA se pasan a Title
Case, y al terminar se enlazan por dominio. *(people.service · importCsv; prueba:
people-csv.parser.spec)*

6.6 **Los nombres en MAYÚSCULA sostenida se formatean a Title Case** sin inventar tildes y con los
conectores (de, del, la…) en minúscula. Es idempotente. *(enums · formatPersonName; prueba:
helpers.test.ts)*

6.7 **"Contactado"** para una persona = tiene al menos un punto de contacto registrado (misma
señal que "Última interacción"). Las facetas de personas son **contextuales**: cada dimensión
cuenta sobre las personas que pasan los otros filtros activos.

6.8 **La industria de una persona se hereda de su empresa**; el campo propio es un respaldo para
personas sin empresa. El cargo libre se agrupa en familias (`cargoGroup`) para poder filtrar.

---

## 7. Permisos

7.1 **La autorización es por área, no por rango.** `ROLE_AREAS` (`packages/shared/src/enums`) es
la única matriz; el servidor la aplica con `@RequireArea` y el cliente con `<RequireArea>` y
`config/nav.ts`. Cambiar un permiso es cambiar esa tabla. *(prueba: team.guard.spec)*

| Rol | Áreas | Además |
|---|---|---|
| GERENTE | crm, equipo | analítica del embudo, etapas, meta, administrar el equipo, impersonar |
| COMERCIAL | crm | opera pipeline, personas, empresas, notas y tareas |
| PENDIENTE | ninguna | solo `/me` |

7.2 **Un correo nuevo del dominio del equipo se auto-provisiona como `PENDIENTE`**, sin áreas,
hasta que un GERENTE le asigne rol. Un correo de otro dominio se rechaza salvo que ya exista en
`team_users` (invitado). Una cuenta desactivada no entra aunque exista.

7.3 **Identidad ≠ autorización.** Quién eres lo dice el `IdentityProvider` (enchufable); qué
puedes hacer lo dicen `team_users` + `ROLE_AREAS`. El seam de desarrollo (`X-Team-Email`) no
puede activarse en producción (`validateEnv` lo rechaza).

7.4 **Impersonar** (`X-Impersonate-Role`) cambia solo el rol efectivo, nunca la identidad: las
escrituras siguen firmadas por la persona real. Solo un GERENTE puede pedirlo.

7.5 **El cliente gatea rutas para no pintar pantallas rotas; los datos los protege el servidor.**
Si el menú oculta algo a un rol, la ruta tampoco se le abre, pero el 403 real lo da la API.

---

## 8. Notas, hilos y menciones

8.1 **Un nivel de hilo.** Una respuesta apunta a la nota raíz de la **misma entidad**; un
`parent_id` ajeno se rechaza (400). Borrar la raíz borra sus respuestas. *(prueba: «rechaza un
parent_id que no es un hilo raíz»)*

8.2 **Las menciones se guardan como token estable `@[correo]`** y el nombre se resuelve al pintar.
Se notifica a los mencionados (nunca al propio autor) y, en una respuesta, a todos los
participantes del hilo aunque no se les mencione. Notificar es best-effort: si el canal falla, la
nota igual queda guardada. *(comments.service; prueba: «notifica a los @mencionados»)*

8.3 **Cada nota queda firmada** con `author` (nombre) y `author_id` (correo). Solo el autor edita
o borra las suyas desde la interfaz.

---

## 9. Números y moneda

9.1 `estimated_value` es un **entero** en la moneda `CRM_CURRENCY` (sin centavos). El formato
(`Intl.NumberFormat` con `CRM_LOCALE`) vive en un helper; nunca se concatena el símbolo.

9.2 **Valor ponderado** del pipeline = Σ valor abierto × probabilidad por etapa, donde la
probabilidad es la posición relativa de la etapa respecto a `WON` (0 en la primera, 1 en `WON`).
Es una heurística transparente hasta que haya historia suficiente para algo mejor.

9.3 **Meta mensual** (`crm_settings.goal`): un solo número para el equipo; el progreso es
`won_value / monthly_goal` en el rango elegido.

---

## Qué NO está en este CRM (a propósito)

- Prospección en frío, secuencias de correo y listas de supresión de envío.
- Inbox omnicanal (correo, WhatsApp) y su conciliación con personas.
- Enriquecimiento con LLM, importadores de registros públicos, logos.
- Notificaciones in-app: hay un `NotifierPort` con implementación de log; el canal real se enchufa.

Cada uno de estos se integra **por los puertos** (`CrmPort`, `NotifierPort`, `IdentityProvider`),
no tocando las tablas del CRM. Ver `docs/arquitectura.md`.
