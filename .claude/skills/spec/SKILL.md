---
name: spec
description: Convierte una idea en una especificación escrita en specs/ antes de tocar código — intención, archivos e interfaces que toca, qué queda fuera, criterios de aceptación y cómo se verifica de punta a punta. Invócala al empezar un bloque de trabajo que toque varios archivos o tenga más de una forma razonable de resolverse.
disable-model-invocation: true
---

# Escribir la especificación de: $ARGUMENTS

**No escribas código en este turno.** El resultado es un archivo `specs/<nombre>.md`, y nada más.

Una especificación es lo que dura; el mensaje que la originó es desechable. Lo que la hace útil
es que **se sostiene sola**: nombra los archivos y las interfaces que toca, dice qué queda fuera y
termina con una comprobación de punta a punta que demuestra que funciona.

## 1. Entiende antes de preguntar

Lee lo que ya existe y responde tú lo que el repositorio pueda responder. Una pregunta cuya
respuesta está en el código gasta el turno de quien la contesta.

- Las reglas de negocio vigentes en `docs/reglas-de-negocio.md`: si el cambio las contradice, la
  especificación lo dice y propone la regla nueva; no se cambia una regla en silencio.
- El módulo del servidor que toca (`apps/server/src/<módulo>/`), su contrato en
  `packages/shared/src/schemas/`, sus tablas en `schema.prisma` y su hook en
  `apps/client/src/hooks/`.
- Las decisiones ya tomadas en `docs/decisiones/`: una alternativa descartada ahí no se vuelve a
  proponer sin información nueva.

Usa un subagente `Explore` para la lectura amplia: la especificación se escribe con lo que
importa, no con todo lo que se leyó.

## 2. Entrevista con `AskUserQuestion`

Pregunta solo lo que el repositorio no puede responder y **lo difícil que la persona no habrá
considerado**: qué rol lo usa y cuál no, qué pasa con los datos que ya existen, qué debe ocurrir
cuando falla a medias, si afecta a la analítica del embudo (todo lo que toque etapas o leads la
afecta), si hace falta una migración. Nada de preguntas obvias.

Sigue hasta que no queden decisiones que cambien el trabajo.

## 3. Escribe `specs/<nombre>.md`

```markdown
# <Título>

**Qué resuelve.** Una frase para quien no estuvo.

## Alcance
- Lo que entra, como lista de comportamientos observables.

## Fuera de alcance
- Lo que parecería obvio añadir y no se añade, con la razón.

## Toca
| Capa | Archivo | Qué cambia |
| shared | packages/shared/src/schemas/crm.schema.ts | campo `foo` opcional |
| prisma | schema.prisma + migración | columna `foo` |
| server | apps/server/src/crm/crm.service.ts | … |
| client | apps/client/src/hooks/useCrm.ts, pages/crm/XPage.tsx | … |

## Reglas de negocio
- Las de `docs/reglas-de-negocio.md` que aplican, y las nuevas que este cambio introduce.
- Roles: quién ve, quién edita, quién no.

## Restricciones
- Skills que aplican (crm-api, crm-db, crm-shared, crm-ui, crm-delivery) y la regla concreta que
  más importa aquí.

## Criterios de aceptación
1. Dado …, cuando …, entonces … (uno por comportamiento, comprobables).

## Verificación de punta a punta
Los comandos y los pasos manuales que demuestran que funciona, en orden.

## Preguntas abiertas
- Solo las que no bloquean; las que bloquean se preguntaron arriba.
```

## 4. Cierra

Di en dos líneas dónde quedó la especificación y que la implementación se hace con
`/build specs/<nombre>.md` **en una sesión nueva**: la implementación va en contexto limpio.
