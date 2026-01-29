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

    it.each(expectedThemes)('theme "%s" has required fields', (theme) => {
      const config = THEME_CONFIG[theme];

      expect(config).toHaveProperty('label');
      expect(typeof config.label).toBe('string');
      expect(config.label.length).toBeGreaterThan(0);
    });

    it('has correct labels for each theme', () => {
      expect(THEME_CONFIG.kitchen.label).toBe('Kitchen');
      expect(THEME_CONFIG.workshop.label).toBe('Workshop');
      expect(THEME_CONFIG.office.label).toBe('Office');
      expect(THEME_CONFIG.hobby.label).toBe('Hobby');
      expect(THEME_CONFIG.personal.label).toBe('Personal');
    });

    it('has unique labels', () => {
      const labels = Object.values(THEME_CONFIG).map((c) => c.label);
      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(labels.length);
    });
  });
});
