# 2026-09-25 · La analítica sale de un log de transiciones, no del estado actual

**Decisión.** Cada cambio de etapa de un lead escribe una fila en `lead_stage_events`
(origen, destino, responsable, hora), en la misma transacción que el lead. Conversión, días por
etapa, ciclo de venta, pérdidas por etapa y desempeño por persona se derivan de ese log.

**Alternativas descartadas.**
- *Calcular todo desde `leads.stage_id` + `stage_changed_at`.* Solo sabe dónde está el lead hoy:
  no puede decir cuántos pasaron por Propuesta y se perdieron, ni cuánto duraron ahí, ni quién
  era responsable cuando se ganó.
- *Snapshots periódicos del pipeline.* Pierden lo que pasa entre dos fotos y duplican datos.

**Reglas derivadas.** El log nunca se edita; un lead creado directamente en una etapa lleva su
evento inicial (`from = null`); las estadías menores a un minuto se ignoran en los promedios.
