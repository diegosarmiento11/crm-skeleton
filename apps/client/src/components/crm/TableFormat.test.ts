import { describe, expect, it } from 'vitest';
import {
  contactedParam,
  countLabel,
  domainFacetOptions,
  domainHref,
  effectiveIndustry,
  lastTouchText,
  sourceFacetOptions,
  sourceSlugFromLabel,
  sourceSuggestions,
} from './TableFormat';

describe('facetas de origen', () => {
  it('muestra etiqueta amigable y conserva el valor crudo (incluido none)', () => {
    const opts = sourceFacetOptions([
      { value: 'none', count: 3 },
      { value: 'referido', count: 2 },
      { value: 'feria_2024', count: 1 },
    ]);
    expect(opts).toEqual([
      { value: 'none', count: 3, label: 'Sin origen' },
      { value: 'referido', count: 2, label: 'Referido' },
      { value: 'feria_2024', count: 1, label: 'feria_2024' },
    ]);
  });

  it('vuelve de la etiqueta al slug: catálogo, faceta o normalizado', () => {
    const facets = [{ value: 'feria_2024', count: 1 }];
    expect(sourceSlugFromLabel('Sitio web', facets)).toBe('website');
    expect(sourceSlugFromLabel('feria_2024', facets)).toBe('feria_2024');
    expect(sourceSlugFromLabel('Expo Bogotá', facets)).toBe('expo_bogotá');
    expect(sourceSlugFromLabel(null, facets)).toBeNull();
  });

  it('sugiere el catálogo más los orígenes ya usados, sin "none"', () => {
    const s = sourceSuggestions([{ value: 'none', count: 1 }, { value: 'feria_2024', count: 1 }]);
    expect(s).toContain('Referido');
    expect(s).toContain('feria_2024');
    expect(s).not.toContain('Sin origen');
  });
});

describe('otras facetas y filtros', () => {
  it('etiqueta la faceta binaria de dominio', () => {
    expect(domainFacetOptions([{ value: 'with', count: 5 }, { value: 'without', count: 2 }])).toEqual([
      { value: 'with', count: 5, label: 'Con dominio' },
      { value: 'without', count: 2, label: 'Sin dominio' },
    ]);
  });

  it('solo filtra por contacto cuando hay exactamente una opción activa', () => {
    expect(contactedParam([])).toBeUndefined();
    expect(contactedParam(['Contactado', 'Sin contacto'])).toBeUndefined();
    expect(contactedParam(['Contactado'])).toBe('yes');
    expect(contactedParam(['Sin contacto'])).toBe('no');
  });
});

describe('celdas', () => {
  const rel = (iso: string) => `rel(${iso})`;

  it('describe la última interacción con canal y fecha relativa', () => {
    expect(lastTouchText({ last_touch_at: null, last_touch_kind: null }, rel)).toBe('Sin contacto');
    expect(lastTouchText({ last_touch_at: '2026-01-01T00:00:00Z', last_touch_kind: 'whatsapp' }, rel)).toBe(
      'WhatsApp · rel(2026-01-01T00:00:00Z)',
    );
    expect(lastTouchText({ last_touch_at: '2026-01-01T00:00:00Z', last_touch_kind: null }, rel)).toBe('rel(2026-01-01T00:00:00Z)');
  });

  it('la industria de la empresa manda sobre la propia', () => {
    expect(effectiveIndustry({ industry: 'Retail', company: { id: 'x', name: 'Acme', industry: 'Salud' } })).toBe('Salud');
    expect(effectiveIndustry({ industry: 'Retail', company: { id: 'x', name: 'Acme', industry: null } })).toBe('Retail');
    expect(effectiveIndustry({ industry: null, company: null })).toBeNull();
  });

  it('arma un href navegable para el dominio', () => {
    expect(domainHref('acme.com')).toBe('https://acme.com');
    expect(domainHref('http://acme.com')).toBe('http://acme.com');
  });

  it('pluraliza contadores', () => {
    expect(countLabel(1, 'persona')).toBe('1 persona');
    expect(countLabel(4, 'persona')).toBe('4 personas');
  });
});
