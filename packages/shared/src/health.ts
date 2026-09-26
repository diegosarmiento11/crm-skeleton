// Salud del lead: única fuente de verdad, compartida por el servidor (listados,
// kanban, señales) y el cliente (que puede enriquecer `lastActivityAt` con fuentes
// que el servidor no ve en lote). Tener el algoritmo aquí garantiza que ambos
// calculan LA MISMA banda y razón a partir de las mismas entradas.

export type HealthBand = 'hot' | 'warm' | 'cold' | 'at_risk';

export interface LeadHealth {
  band: HealthBand | null;
  reason: string;
}

const DAY_MS = 86_400_000;

function toTime(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Salud por reglas (interpretable, no una caja negra): combina días en la etapa
 * actual, días desde la última actividad y si tiene responsable. Un lead cerrado
 * no tiene salud. `now` es inyectable para pruebas deterministas.
 *
 *   sin responsable                     → at_risk
 *   sin actividad y ≥14d en etapa       → at_risk · sin actividad (<14d) → cold
 *   ≥14d sin actividad o ≥21d en etapa  → at_risk
 *   ≥7d  sin actividad o ≥14d en etapa  → cold
 *   ≥3d  sin actividad o ≥7d  en etapa  → warm
 *   resto                               → hot
 */
export function computeLeadHealth(
  stageChangedAt: Date | string,
  lastActivityAt: Date | string | null,
  owner: string | null,
  isClosed: boolean,
  now: number = Date.now(),
): LeadHealth {
  if (isClosed) return { band: null, reason: '' };
  const stageTime = toTime(stageChangedAt);
  const dStage = stageTime === null ? 0 : Math.floor((now - stageTime) / DAY_MS);
  const actTime = toTime(lastActivityAt);
  const dAct = actTime === null ? null : Math.floor((now - actTime) / DAY_MS);

  if (!owner) return { band: 'at_risk', reason: 'Sin responsable' };
  if (dAct === null) {
    return dStage >= 14
      ? { band: 'at_risk', reason: `Sin actividad y ${dStage}d en etapa` }
      : { band: 'cold', reason: 'Sin actividad registrada' };
  }
  if (dAct >= 14 || dStage >= 21) {
    return {
      band: 'at_risk',
      reason: dAct >= 14 ? `Sin actividad hace ${dAct}d` : `${dStage}d en esta etapa`,
    };
  }
  if (dAct >= 7 || dStage >= 14) {
    return {
      band: 'cold',
      reason: dAct >= 7 ? `Sin actividad hace ${dAct}d` : `${dStage}d en esta etapa`,
    };
  }
  if (dAct >= 3 || dStage >= 7) {
    return {
      band: 'warm',
      reason: dAct >= 3 ? `Última actividad hace ${dAct}d` : `${dStage}d en esta etapa`,
    };
  }
  return { band: 'hot', reason: 'Actividad reciente' };
}
