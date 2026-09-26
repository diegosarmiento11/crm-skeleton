---
name: wrap
description: Cierra un bloque de trabajo — actualiza solo la documentación que el cambio afecta (CLAUDE.md, la skill que lleva la regla, docs/reglas-de-negocio.md, docs/decisiones, .env.example), verifica, confirma con un commit en español y deja listo el push. Invócala cuando el trabajo esté revisado.
disable-model-invocation: true
---

# Cerrar el trabajo $ARGUMENTS

## 1. Qué documentación toca este cambio

**Recorre la tabla con el diff delante y responde cada condición.** Solo se escribe donde se
cumple.

| Si este cambio… | Se actualiza |
|---|---|
| fijó una regla de código nueva o cambió una | **la skill que la lleva** (`crm-api`, `crm-db`, `crm-ui`, `crm-shared`, `crm-delivery`) y, si es de las que más se saltan, la línea en `.claude/hooks/rules-for-path.mjs` |
| cambió o añadió una regla de negocio (qué pasa con un lead, una etapa, una persona, un permiso) | `docs/reglas-de-negocio.md` |
| eligió entre alternativas y la descartada volvería a proponerse | una nota en `docs/decisiones/<fecha>-<tema>.md` con la razón |
| cambió un comando, un puerto, una variable o un quirk del entorno | `CLAUDE.md` (sección Comandos) y `.env.example` (raíz y `apps/server/.env.example`) |
| cambió un permiso | `ROLE_AREAS` ya lo lleva; nada más, salvo que cambie el modelo de áreas: entonces `CLAUDE.md` y `docs/reglas-de-negocio.md` |
| añadió un job | el comentario en el handler que dice cómo y cuándo se programa |
| cambió la estructura del repo o un módulo | `docs/arquitectura.md` |

**Si ninguna condición se cumple, no se toca ningún documento, y así se dice.** Es el caso más
frecuente.

**Lo que nunca va en un documento:** el registro de lo que se hizo a los archivos. Eso es git.

## 2. Verifica

```
pnpm verify
```

En verde antes de confirmar. Si algo falla, se corrige la causa.

## 3. Confirma

Commit **en español**, `tipo(alcance): qué cambia para quien lo usa`. Solo si la persona lo
pidió; si no, deja el árbol listo y dilo.

Comprueba `git diff --cached --name-only`: nada de `.env`, `*.pem`, `service-account*.json`,
`.claude/settings.local.json`.

## 4. Lo que solo hace una persona

- **Push y PR** con `gh`, título y cuerpo en español: qué resuelve, qué se verificó, qué queda
  fuera. Enlaza la especificación si existe.
- **Desplegar** y **migrar producción**: la migración corre antes del despliegue y no tiene
  rollback; se probó en local contra datos parecidos. El hook `guard-bash` pide confirmación
  ante cualquier base que no sea la local.

## 5. Informa

En pocas líneas: qué entró, qué documentos se tocaron **y cuáles no porque no aplicaban**, y qué
queda pendiente con su responsable.
