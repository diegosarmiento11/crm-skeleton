import { describe, expect, it } from 'vitest';
import { customRange, goalProgress, isFunnelPreset, pct, rangeForPreset } from './funnelLogic';

describe('rangeForPreset', () => {
  const now = new Date(2026, 8, 25, 15, 30); // 25 sep 2026, local

  it('este mes arranca el día 1 a medianoche local, sin tope', () => {
    const r = rangeForPreset('month', now);
    expect(new Date(r.from!).getTime()).toBe(new Date(2026, 8, 1).getTime());
    expect(r.to).toBeUndefined();
  });

  it('este año arranca el 1 de enero', () => {
    expect(new Date(rangeForPreset('year', now).from!).getTime()).toBe(new Date(2026, 0, 1).getTime());
  });

  it('30 y 90 días restan días calendario desde hoy a medianoche', () => {
    expect(new Date(rangeForPreset('30d', now).from!).getTime()).toBe(new Date(2026, 7, 26).getTime());
    expect(new Date(rangeForPreset('90d', now).from!).getTime()).toBe(new Date(2026, 5, 27).getTime());
  });

  it('todo y personalizado no acotan', () => {
    expect(rangeForPreset('all', now)).toEqual({});
    expect(rangeForPreset('custom', now)).toEqual({});
  });
});

describe('customRange', () => {
  it('to es inclusivo: manda el inicio del día siguiente', () => {
    const r = customRange('2026-09-01', '2026-09-30');
    expect(new Date(r.from!).getTime()).toBe(new Date(2026, 8, 1).getTime());
    expect(new Date(r.to!).getTime()).toBe(new Date(2026, 9, 1).getTime());
  });

  it('acepta un solo extremo', () => {
    expect(customRange(null, null)).toEqual({});
    expect(customRange('2026-09-01', null).to).toBeUndefined();
  });
});

describe('helpers', () => {
  it('pct y goalProgress toleran nulos', () => {
    expect(pct(null)).toBe('—');
    expect(pct(0.256)).toBe('26%');
    expect(goalProgress(500, null)).toBeNull();
    expect(goalProgress(500, 0)).toBeNull();
    expect(goalProgress(500, 1000)).toBe(0.5);
    expect(goalProgress(1500, 1000)).toBe(1);
  });

  it('isFunnelPreset valida lo guardado en localStorage', () => {
    expect(isFunnelPreset('90d')).toBe(true);
    expect(isFunnelPreset('nope')).toBe(false);
    expect(isFunnelPreset(null)).toBe(false);
  });
});
