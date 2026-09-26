# 2026-09-25 · Autorización por área con una sola matriz

**Decisión.** Cada rol tiene una lista de áreas (`ROLE_AREAS` en `@crm/shared`). El servidor
autoriza con `@RequireArea` a nivel de clase y `@RequireRole('GERENTE')` para acciones de
dirección; el cliente lee la misma matriz para el menú y las rutas.

**Alternativas descartadas.**
- *Jerarquía de rangos (admin > manager > user).* Las organizaciones reales no son lineales: un
  rol de contabilidad ve dinero pero no el CRM. Con áreas se expresa; con rangos, no.
- *Permisos granulares por acción (RBAC completo).* Más de lo que este CRM necesita; la tabla
  crecería sin que nadie la lea. Si hace falta, se añade una columna a la matriz, no otro sistema.

**Regla derivada.** Un correo nuevo del dominio entra como `PENDIENTE` sin áreas; un GERENTE le
da rol. Un controlador sin `@RequireArea` deja pasar a `PENDIENTE`: por eso va en la clase.
