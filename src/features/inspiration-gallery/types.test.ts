import en from '@/i18n/locales/en';
import { describe, it, expect } from 'vitest';
import { THEME_CONFIG } from './types';
import type { InspirationTheme } from './types';

describe('types', () => {
  describe('THEME_CONFIG', () => {
    const expectedThemes: InspirationTheme[] = [
      'kitchen',
      'workshop',
      'office',
      'hobby',
      'personal',
    ];

    it('has all 5 themes', () => {
      const themes = Object.keys(THEME_CONFIG);
      expect(themes).toHaveLength(5);
      expectedThemes.forEach((theme) => {
        expect(themes).toContain(theme);
      });
    });

    it.each(expectedThemes)('theme "%s" names an English label', (theme) => {
      expect(en[THEME_CONFIG[theme].labelKey]).toBeTruthy();
    });

    it('has unique label keys', () => {
      const keys = Object.values(THEME_CONFIG).map((c) => c.labelKey);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});
