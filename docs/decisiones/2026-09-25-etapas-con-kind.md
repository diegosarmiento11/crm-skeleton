# 2026-09-25 · Las etapas declaran su papel con `kind`, no por el nombre

**Decisión.** `pipeline_stages.kind ∈ {OPEN, QUALIFY, PROPOSAL, WON, LOST}`. La analítica, el
SLA y el desempeño por persona leen `kind`. Solo puede haber una etapa de cada tipo salvo `OPEN`.

**Alternativa descartada.** Un booleano `is_closed` más heurísticos por nombre
(`/gan|won/`, `/propuesta|cotiz/`) para deducir cuál es la ganada, la perdida o la de propuesta.
Funciona hasta que alguien renombra una etapa o el equipo trabaja en otro idioma; el fallo no
produce error, produce un reporte equivocado.

**Costo aceptado.** Un select más en el gestor de etapas y una regla de unicidad (409) que
explicar. A cambio, ningún reporte depende del texto de una columna.
