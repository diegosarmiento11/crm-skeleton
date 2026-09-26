# 2026-09-25 · Prospecto ≠ lead: la prospección en frío queda fuera del pipeline

**Decisión.** El pipeline modela negocios con interés confirmado. Un contacto en frío (una
plantilla enviada, sin respuesta) no entra al pipeline; entra cuando responde con una señal de
interés real. La prospección se modela aparte y se integra por `CrmPort`
(`findPersonByContact`, `createPersonFromEmail`, `updatePersonContactStatus`).

**Por qué.** Meter prospectos al pipeline y moverlos a Perdido cuando no responden infla la tasa
de pérdida y mezcla dos juegos distintos: prospección es volumen y tasas de respuesta; pipeline es
conversión. Las métricas del embudo dejan de servir para dirigir.

**Alternativa descartada.** Una pre-etapa "Contactado" dentro del pipeline con un motivo de
salida propio ("Sin respuesta" ≠ "Perdido") excluida de las métricas. Es viable, pero obliga a
excepciones en cada reporte; separar es más simple.
