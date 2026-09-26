---
name: docu-writing
description: >-
  Convenciones para crear y editar páginas en el Docu de Forabi (el wiki interno
  BlockNote, tabla doc_pages) desde Claude Code vía el MCP `docu`. Úsalo SIEMPRE
  que el usuario pida escribir, documentar, actualizar o crear una página/sección
  en el Docu, en "forabi.ai", en Tecnología/Marketing/Comercial, o "en nuestro
  wiki/documentación". Cubre jerarquía de texto, qué evitar, dónde anclar
  la página, transporte correcto y verificación.
---

# Escribir en el Docu de Forabi

El Docu es el wiki interno (BlockNote → `doc_pages`), servido por el backend. Se
edita desde Claude Code con el **MCP `docu`** (en el repo del backend viene
registrado en `.mcp.json`; fuera de él se conecta con `claude mcp add --scope user`). Los
edits hechos por el MCP quedan firmados como `claude-mcp` en "Editado por" y en el
historial de versiones.

## Herramientas del MCP `docu`

- `docu_list_pages` — árbol completo (id, título, padre). **Úsala primero** para orientarte.
- `docu_search` — busca por texto en título/contenido. Para encontrar el padre correcto.
- `docu_read_page` — lee una página como Markdown (para verificar o editar).
- `docu_create_page` — crea (title, markdown, parent_id, icon, publish_date).
- `docu_update_page` — actualiza: `replace_markdown` (reemplaza todo) o `append_markdown` (agrega al final).
- `docu_move_page` — cambia el padre de una página (o la sube al primer nivel con `parent_id: null`).
- `docu_delete_page` — la manda a la papelera (borrado suave; un gerente la restaura desde la app).

Si el MCP no está disponible, ver "Fallback por curl" abajo.

## Reglas de formato (jerarquía de texto)

El contenido va en **Markdown**; el backend lo convierte a bloques BlockNote. Cada
elemento debe ir **en su propia línea** con una **línea en blanco entre bloques**.

- `#` = título/H1 (uno arriba). `##` = secciones. `###` = subsecciones. **Máximo `###`** (`####` NO se reconoce → cae a párrafo).
- Listas con `- `. Tareas con `- [ ]` / `- [x]`. Numeradas con `1.`.
- Citas con `> `. Código con triple backtick + lenguaje.
- Negrita para etiquetar ítems: `- **Etiqueta:** valor`.

## Qué EVITAR

- **Nada de guiones largos (`—`).** Es la marca más delatora de un texto escrito
  por un modelo, y en una página que lee un cliente se nota. Nunca los uses para
  separar la etiqueta de su explicación: eso son **dos puntos**.

  ```
  ✗  - **Manager** — ve la bitácora de todo el equipo.
  ✓  - **Manager:** ve la bitácora de todo el equipo.
  ```

  En prosa, el guion largo casi siempre es una coma, un punto o un paréntesis:

  ```
  ✗  Funciona en celular —hay vistas de tarjetas— pero las tablas se ven mejor…
  ✓  Funciona en celular (hay vistas de tarjetas), pero las tablas se ven mejor…

  ✗  El snapshot se genera a las 7:00 a. m. — los datos de hoy no están todavía.
  ✓  El snapshot se genera a las 7:00 a. m.: los datos de hoy no están todavía.
  ```

  El guion corto (`–`) sí sirve dentro de un compuesto (`disparador–respuesta`).
- **Evita las tablas Markdown (`| ... |`)** por legibilidad, no por riesgo: hoy
  round-tripean bien y ya no bloquean la edición. Una **lista con negritas**
  (`- **Columna:** valor`) o subsecciones `###` se leen mejor en pantalla angosta.
  Si la tabla aporta de verdad (una matriz real), úsala.
- No pegues todo en un párrafo. Sin líneas en blanco entre bloques, headings y
  listas se colapsan.
- No metas imágenes con URLs externas efímeras (Notion/S3 caducan); el MCP las
  re-sube a GCS, pero mejor subirlas ya alojadas.

## Dónde anclar la página (jerarquía del árbol)

Raíces reales del árbol: **Forabi.ai**, **Projects**, **How-to**, **Plantillas**,
**Forabi Learning** y **Roadmap**. Dentro de **Forabi.ai** están las áreas:
Tecnología, Marketing, Comercial y Lineas de operativas.

- Documentación interna de Forabi (producto, ingeniería) → bajo **Tecnología**.
- Documentación de un proyecto de cliente → bajo **Projects**, en la carpeta de
  ese proyecto (Reactive Move, Team Sov, Ortomec…). NO la cuelgues de Tecnología.
- **Confirma el nombre en vivo con `docu_list_pages` antes de anclar.** Estos
  nombres cambian y una instrucción vieja hace que termines creando un root
  duplicado. No te fíes de esta lista si no coincide con lo que devuelve el árbol.
- Busca el padre con `docu_search`; **nunca hardcodees un UUID**.
- Una página = un concepto. Si crece, parte en subpáginas.
- Ponle un `icon` emoji representativo.

## Flujo recomendado

1. `docu_list_pages` o `docu_search` para ubicar el padre correcto y ver si la página ya existe.
2. Si existe → `docu_update_page` con `replace_markdown`. Las subpáginas, el
   calendario, los videos y los archivos NO se representan en Markdown: el
   backend los rescata y los reinserta **al final** de la página, y te dice
   cuáles movió en `preservados_al_final`. Si su posición dentro del texto
   importaba, reacomódalos desde la app.
3. Si no existe → `docu_create_page` con `parent_id`, `title`, `icon`, `markdown`.
4. **Verifica siempre:** `docu_read_page` y confirma que hay varios headings en líneas separadas (no un párrafo gigante).

> **Trampa al reescribir: `docu_read_page` NO devuelve solo el contenido.**
> Antepone tres líneas (título, `id`, `último editor`) y, si la página tiene
> hijas, añade al final un `## Subpáginas` con sus ids. Las dos cosas son
> cortesía del MCP para orientarte, no contenido de la página.
>
> Si lees y devuelves ese texto tal cual en `replace_markdown`, ese listado
> **queda escrito como texto plano** encima de los bloques reales: en pantalla se
> ven los ids, no navegan a ninguna parte, y el lector cree que la página está
> rota. Pasó en agosto de 2026 con 10 páginas de la guía de un cliente.
>
> Al hacer leer → transformar → escribir (por ejemplo, un barrido con script),
> **corta el preámbulo por arriba y todo lo que siga a `## Subpáginas` por
> abajo** antes de reescribir.

## Fallback por curl (sin el MCP registrado)

Necesitas la `DOCU_MCP_KEY`. Pídesela a quien administra el Docu (por el gestor
de contraseñas del equipo). Si tienes acceso al proyecto GCP `forabi`:
`gcloud secrets versions access latest --secret DOCU_MCP_KEY --project forabi`

**CRÍTICO — transporte:** NUNCA mandes el markdown con `echo` (el shell aplasta los
`\n` y todo colapsa en un párrafo). Escribe el JSON-RPC a un archivo con Python y
usa `curl --data-binary @archivo`:

```bash
python3 -c 'import json; md=open("doc.md").read(); open("p.json","w").write(json.dumps({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"docu_create_page","arguments":{"title":"Título","icon":"📄","parent_id":"<uuid>","markdown":md}}}))'
curl -s "https://spencer-api-eex65bjtkq-uc.a.run.app/api/v1/mcp/docu?key=$KEY" \
  -X POST -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' --data-binary @p.json
```

Al leer de vuelta con Python usa `json.loads(txt, strict=False)` (el markdown trae
saltos de línea literales en el JSON).
