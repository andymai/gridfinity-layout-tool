import { describe, it, expect } from 'vitest';
import { getCanonicalTerms, getDisplayTerm } from './normalize';
import { CATALOG_DISPLAY } from './catalogDisplay';

const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'nl', 'pt-BR', 'ja', 'nb', 'sv', 'uk'];

describe('getDisplayTerm', () => {
  it('fixes the acronym mangling of the alias fallback (English)', () => {
    expect(getDisplayTerm('battery_aa')).toBe('AA battery');
    expect(getDisplayTerm('usb_cable')).toBe('USB cable');
    expect(getDisplayTerm('sd_card')).toBe('SD card');
    expect(getDisplayTerm('led')).toBe('LED');
    expect(getDisplayTerm('allen_key')).toBe('Allen key');
  });

  it('localizes to the requested locale', () => {
    expect(getDisplayTerm('screw', 'de')).toBe('Schraube');
    expect(getDisplayTerm('nut', 'de')).toBe('Mutter');
    expect(getDisplayTerm('wrench', 'fr')).toBe('Clé à molette');
    expect(getDisplayTerm('screwdriver', 'ja')).toBe('ドライバー');
  });

  it('falls back to English for an unknown locale', () => {
    expect(getDisplayTerm('screw', 'zz')).toBe('Screw');
  });

  it('keeps brand/acronym terms identical across locales', () => {
    expect(getDisplayTerm('led', 'de')).toBe('LED');
    expect(getDisplayTerm('arduino', 'ja')).toBe('Arduino');
  });
});

describe('CATALOG_DISPLAY coverage', () => {
  it('provides a display entry for every catalog canonical term', () => {
    for (const term of getCanonicalTerms()) {
      expect(CATALOG_DISPLAY[term], `missing display map for "${term}"`).toBeDefined();
    }
  });

  it('has a non-empty value for all 11 locales in every entry', () => {
    for (const [term, byLocale] of Object.entries(CATALOG_DISPLAY)) {
      for (const loc of LOCALES) {
        expect(byLocale[loc], `"${term}" missing locale "${loc}"`).toBeTruthy();
      }
    }
  });
});
