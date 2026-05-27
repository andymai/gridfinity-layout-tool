/**
 * Tests for i18n browser language detection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectBrowserLocale } from '@/i18n/detection';
import { isLocale, SUPPORTED_LOCALES } from '@/i18n/types';

describe('isLocale', () => {
  it('returns true for valid locale codes', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('de')).toBe(true);
    expect(isLocale('nl')).toBe(true);
    expect(isLocale('es')).toBe(true);
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('pt-BR')).toBe(true);
    expect(isLocale('nb')).toBe(true);
    expect(isLocale('uk')).toBe(true);
    expect(isLocale('sv')).toBe(true);
    expect(isLocale('ja')).toBe(true);
  });

  it('returns false for invalid locale codes', () => {
    expect(isLocale('invalid')).toBe(false);
    expect(isLocale('xx')).toBe(false);
    expect(isLocale('EN')).toBe(false); // Case sensitive
    expect(isLocale('pt')).toBe(false); // Not a supported code (pt-BR is)
    expect(isLocale('')).toBe(false);
  });
});

describe('SUPPORTED_LOCALES', () => {
  it('contains expected number of locales', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(10);
  });

  it('has required properties for each locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(locale).toHaveProperty('code');
      expect(locale).toHaveProperty('nativeName');
      expect(locale).toHaveProperty('englishName');
      expect(typeof locale.code).toBe('string');
      expect(typeof locale.nativeName).toBe('string');
      expect(typeof locale.englishName).toBe('string');
    }
  });

  it('has English as the first locale', () => {
    expect(SUPPORTED_LOCALES[0].code).toBe('en');
  });
});

describe('detectBrowserLocale', () => {
  beforeEach(() => {
    // Reset navigator mock before each test
    vi.stubGlobal('navigator', {
      languages: ['en-US'],
      language: 'en-US',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('exact matches', () => {
    it('detects English', () => {
      vi.stubGlobal('navigator', { languages: ['en'], language: 'en' });
      expect(detectBrowserLocale()).toBe('en');
    });

    it('detects German', () => {
      vi.stubGlobal('navigator', { languages: ['de'], language: 'de' });
      expect(detectBrowserLocale()).toBe('de');
    });

    it('detects Dutch', () => {
      vi.stubGlobal('navigator', { languages: ['nl'], language: 'nl' });
      expect(detectBrowserLocale()).toBe('nl');
    });

    it('detects Spanish', () => {
      vi.stubGlobal('navigator', { languages: ['es'], language: 'es' });
      expect(detectBrowserLocale()).toBe('es');
    });

    it('detects French', () => {
      vi.stubGlobal('navigator', { languages: ['fr'], language: 'fr' });
      expect(detectBrowserLocale()).toBe('fr');
    });

    it('detects Brazilian Portuguese', () => {
      vi.stubGlobal('navigator', { languages: ['pt-BR'], language: 'pt-BR' });
      expect(detectBrowserLocale()).toBe('pt-BR');
    });

    it('detects Norwegian Bokmål', () => {
      vi.stubGlobal('navigator', { languages: ['nb'], language: 'nb' });
      expect(detectBrowserLocale()).toBe('nb');
    });

    it('detects Ukrainian', () => {
      vi.stubGlobal('navigator', { languages: ['uk'], language: 'uk' });
      expect(detectBrowserLocale()).toBe('uk');
    });

    it('detects Swedish', () => {
      vi.stubGlobal('navigator', { languages: ['sv'], language: 'sv' });
      expect(detectBrowserLocale()).toBe('sv');
    });

    it('detects Japanese', () => {
      vi.stubGlobal('navigator', { languages: ['ja'], language: 'ja' });
      expect(detectBrowserLocale()).toBe('ja');
    });
  });

  describe('regional variants', () => {
    it('maps en-US to en', () => {
      vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' });
      expect(detectBrowserLocale()).toBe('en');
    });

    it('maps en-GB to en', () => {
      vi.stubGlobal('navigator', { languages: ['en-GB'], language: 'en-GB' });
      expect(detectBrowserLocale()).toBe('en');
    });

    it('maps de-AT (Austrian German) to de', () => {
      vi.stubGlobal('navigator', { languages: ['de-AT'], language: 'de-AT' });
      expect(detectBrowserLocale()).toBe('de');
    });

    it('maps de-CH (Swiss German) to de', () => {
      vi.stubGlobal('navigator', { languages: ['de-CH'], language: 'de-CH' });
      expect(detectBrowserLocale()).toBe('de');
    });

    it('maps nl-BE (Flemish) to nl', () => {
      vi.stubGlobal('navigator', { languages: ['nl-BE'], language: 'nl-BE' });
      expect(detectBrowserLocale()).toBe('nl');
    });

    it('maps es-MX (Mexican Spanish) to es', () => {
      vi.stubGlobal('navigator', { languages: ['es-MX'], language: 'es-MX' });
      expect(detectBrowserLocale()).toBe('es');
    });

    it('maps es-AR (Argentine Spanish) to es', () => {
      vi.stubGlobal('navigator', { languages: ['es-AR'], language: 'es-AR' });
      expect(detectBrowserLocale()).toBe('es');
    });

    it('maps fr-CA (Canadian French) to fr', () => {
      vi.stubGlobal('navigator', { languages: ['fr-CA'], language: 'fr-CA' });
      expect(detectBrowserLocale()).toBe('fr');
    });

    it('maps fr-BE (Belgian French) to fr', () => {
      vi.stubGlobal('navigator', { languages: ['fr-BE'], language: 'fr-BE' });
      expect(detectBrowserLocale()).toBe('fr');
    });

    it('maps pt-PT (European Portuguese) to pt-BR', () => {
      vi.stubGlobal('navigator', { languages: ['pt-PT'], language: 'pt-PT' });
      expect(detectBrowserLocale()).toBe('pt-BR');
    });

    it('maps pt to pt-BR', () => {
      vi.stubGlobal('navigator', { languages: ['pt'], language: 'pt' });
      expect(detectBrowserLocale()).toBe('pt-BR');
    });

    it('maps nb-NO to nb', () => {
      vi.stubGlobal('navigator', { languages: ['nb-NO'], language: 'nb-NO' });
      expect(detectBrowserLocale()).toBe('nb');
    });

    it('maps nn (Nynorsk) to nb', () => {
      vi.stubGlobal('navigator', { languages: ['nn'], language: 'nn' });
      expect(detectBrowserLocale()).toBe('nb');
    });

    it('maps no (generic Norwegian) to nb', () => {
      vi.stubGlobal('navigator', { languages: ['no'], language: 'no' });
      expect(detectBrowserLocale()).toBe('nb');
    });

    it('maps uk-UA to uk', () => {
      vi.stubGlobal('navigator', { languages: ['uk-UA'], language: 'uk-UA' });
      expect(detectBrowserLocale()).toBe('uk');
    });

    it('maps sv-SE to sv', () => {
      vi.stubGlobal('navigator', { languages: ['sv-SE'], language: 'sv-SE' });
      expect(detectBrowserLocale()).toBe('sv');
    });

    it('maps sv-FI (Finland Swedish) to sv', () => {
      vi.stubGlobal('navigator', { languages: ['sv-FI'], language: 'sv-FI' });
      expect(detectBrowserLocale()).toBe('sv');
    });

    it('maps ja-JP to ja', () => {
      vi.stubGlobal('navigator', { languages: ['ja-JP'], language: 'ja-JP' });
      expect(detectBrowserLocale()).toBe('ja');
    });
  });

  describe('language preference order', () => {
    it('uses first matching language from preferences', () => {
      vi.stubGlobal('navigator', {
        languages: ['zh', 'de', 'en'], // Chinese not supported, German is
        language: 'zh',
      });
      expect(detectBrowserLocale()).toBe('de');
    });

    it('skips unsupported languages', () => {
      vi.stubGlobal('navigator', {
        languages: ['zh', 'ko', 'es'], // Chinese, Korean not supported
        language: 'zh',
      });
      expect(detectBrowserLocale()).toBe('es');
    });

    it('falls back to en for unsupported languages', () => {
      vi.stubGlobal('navigator', {
        languages: ['zh', 'ko', 'th'], // None supported
        language: 'zh',
      });
      expect(detectBrowserLocale()).toBe('en');
    });
  });

  describe('edge cases', () => {
    it('handles empty languages array', () => {
      vi.stubGlobal('navigator', {
        languages: [],
        language: 'en',
      });
      expect(detectBrowserLocale()).toBe('en');
    });

    it('falls back to navigator.language when languages is undefined', () => {
      vi.stubGlobal('navigator', {
        languages: undefined,
        language: 'de',
      });
      expect(detectBrowserLocale()).toBe('de');
    });

    it('handles unknown regional variant by base language', () => {
      vi.stubGlobal('navigator', {
        languages: ['de-LI'], // Liechtenstein German (not in map)
        language: 'de-LI',
      });
      expect(detectBrowserLocale()).toBe('de');
    });
  });
});
