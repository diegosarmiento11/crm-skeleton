# specs/

Una especificación por bloque de trabajo. Se escribe con `/spec <qué>` antes de tocar código,
se implementa con `/build specs/<nombre>.md` en una sesión nueva, se revisa con `/review` y se
cierra con `/wrap`.

Una especificación se sostiene sola: nombra los archivos e interfaces que toca, dice qué queda
fuera, lista las reglas de negocio que aplica o cambia, y termina con una verificación de punta a
punta que se ejecuta, no que se lee. Cuando el trabajo entra a `main`, la especificación se queda
aquí como registro de qué se decidió y por qué; lo que se hizo a los archivos lo cuenta git.

`ejemplo-razon-de-perdida.md` muestra el formato con un cambio real ya implementado en este
repositorio.
