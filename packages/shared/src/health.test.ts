import { describe, expect, it } from 'vitest';
import { computeLeadHealth } from './health';

// La salud es la señal que ordena el trabajo del comercial: si la banda se calcula
// mal, el kanban esconde leads que se están enfriando. Se prueba con `now` fijo.
describe('computeLeadHealth', () => {
  const now = new Date('2026-06-20T00:00:00Z').getTime();
  const daysAgo = (d: number) => new Date(now - d * 86_400_000);

  it('un lead cerrado no tiene salud', () => {
    expect(computeLeadHealth(daysAgo(1), daysAgo(1), 'ana@x.com', true, now)).toEqual({
      band: null,
      reason: '',
    });
  });

  it('sin responsable está en riesgo aunque tenga actividad reciente', () => {
    expect(computeLeadHealth(daysAgo(1), daysAgo(0), null, false, now).band).toBe('at_risk');
  });

  it('sin actividad: frío antes de 14 días en etapa, en riesgo después', () => {
    expect(computeLeadHealth(daysAgo(5), null, 'ana@x.com', false, now).band).toBe('cold');
    expect(computeLeadHealth(daysAgo(14), null, 'ana@x.com', false, now).band).toBe('at_risk');
  });

  it('escala hot → warm → cold → at_risk según los días sin actividad', () => {
    const at = (d: number) => computeLeadHealth(daysAgo(1), daysAgo(d), 'ana@x.com', false, now);
    expect(at(0).band).toBe('hot');
    expect(at(3).band).toBe('warm');
    expect(at(7).band).toBe('cold');
    expect(at(14).band).toBe('at_risk');
  });

  it('el tiempo en etapa también degrada aunque haya actividad', () => {
    const at = (d: number) => computeLeadHealth(daysAgo(d), daysAgo(0), 'ana@x.com', false, now);
    expect(at(7).band).toBe('warm');
    expect(at(14).band).toBe('cold');
    expect(at(21).band).toBe('at_risk');
    expect(at(21).reason).toBe('21d en esta etapa');
  });
});
