---
name: review
description: Revisa el cambio en curso contra las reglas del repositorio (subagente crm-auditor en contexto limpio, más security-reviewer si toca auth, guards, jobs, uploads o SQL crudo) y contra su especificación, criterio por criterio. Invócala al terminar un bloque de trabajo y antes de /wrap.
disable-model-invocation: true
---

# Revisar el cambio $ARGUMENTS

Dos preguntas distintas, y hacen falta las dos:

- **¿El código cumple las reglas?** Lo contesta `crm-auditor` (y `security-reviewer` cuando el
  cambio toca guards, `auth/`, jobs, uploads o `$queryRaw`).
- **¿Resuelve el problema correcto?** Lo contesta la especificación, y no lo contesta ningún diff.

## 1. Lanza a los auditores

Usa el subagente **`crm-auditor`** sobre el cambio. Dale el alcance (la rama frente a `main`,
más lo que esté sin confirmar) y **pídele que compruebe ejecutando, no leyendo**.

Si el cambio toca `auth/`, `common/guards`, `jobs/`, un `FileInterceptor` o `$queryRaw`, lanza
**también `security-reviewer`** en paralelo.

Ambos ven el código sin el razonamiento que lo produjo; esa es su ventaja.

## 2. Mientras corren, revisa contra la especificación

Si el trabajo tiene una en `specs/`, ábrela y responde **uno por uno** sus criterios de
aceptación contra el sistema. Tres resultados posibles: **cumplido**, **no cumplido**, **cambió y
la especificación no lo dice**.

Comprueba además:

- **Lo que quedó fuera de alcance, ¿sigue fuera?** El alcance crece hacia lo que parecía obvio.
- **Sus preguntas abiertas, ¿se decidieron?** Una resuelta sobre la marcha es una decisión que
  nadie aprobó.
- **¿Hay una prueba que se rompa si se rompe cada criterio?** Si un criterio no tiene prueba,
  dilo.
- **¿Cambió una regla de negocio?** Entonces `docs/reglas-de-negocio.md` tiene que decirlo, y si
  se descartó una alternativa, `docs/decisiones/` también.

Si no hay especificación, dilo, y revisa contra lo que se pidió.

## 3. Junta los resultados

**Una sola lista, ordenada por lo que ocurre si no se corrige**, mezclando lo de los auditores y
lo tuyo. Para cada punto: dónde, qué regla o criterio, consecuencia, corrección.

Un revisor al que se le pide encontrar huecos siempre encuentra alguno. Separa lo que afecta la
corrección o los requisitos de lo que es opcional, y di cuál es cuál.

## 4. Corrige lo que afecta y vuelve a auditar

Lo que afecta la corrección se corrige ahora y se relanza el auditor sobre la corrección. Lo
opcional se lista y se deja a la persona. Termina diciendo si el cambio puede integrarse.
