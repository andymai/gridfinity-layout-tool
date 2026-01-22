import { describe, it, expect } from 'vitest';
import { THEME_CONFIG, FEATURE_CONFIG } from '../types';
import type { InspirationTheme, LayoutFeature } from '../types';

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
      expect(config).toHaveProperty('icon');
      expect(config).toHaveProperty('description');

      expect(typeof config.label).toBe('string');
      expect(typeof config.icon).toBe('string');
      expect(typeof config.description).toBe('string');

      expect(config.label.length).toBeGreaterThan(0);
      expect(config.icon.length).toBeGreaterThan(0);
      expect(config.description.length).toBeGreaterThan(0);
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

    it('has unique icons', () => {
      const icons = Object.values(THEME_CONFIG).map((c) => c.icon);
      const uniqueIcons = new Set(icons);
      expect(uniqueIcons.size).toBe(icons.length);
    });
  });

  describe('FEATURE_CONFIG', () => {
    const expectedFeatures: LayoutFeature[] = [
      'multiple-layers',
      'half-bins',
      'labeled-bins',
      'clearance-height',
      'multiple-categories',
    ];

    it('has all 5 features', () => {
      const features = Object.keys(FEATURE_CONFIG);
      expect(features).toHaveLength(5);
      expectedFeatures.forEach((feature) => {
        expect(features).toContain(feature);
      });
    });

    it.each(expectedFeatures)('feature "%s" has required fields', (feature) => {
      const config = FEATURE_CONFIG[feature];

      expect(config).toHaveProperty('label');
      expect(config).toHaveProperty('description');

      expect(typeof config.label).toBe('string');
      expect(typeof config.description).toBe('string');

      expect(config.label.length).toBeGreaterThan(0);
      expect(config.description.length).toBeGreaterThan(0);
    });

    it('has user-friendly labels', () => {
      expect(FEATURE_CONFIG['multiple-layers'].label).toBe('Multi-layer');
      expect(FEATURE_CONFIG['half-bins'].label).toBe('Half-bins');
      expect(FEATURE_CONFIG['labeled-bins'].label).toBe('Labeled');
      expect(FEATURE_CONFIG['clearance-height'].label).toBe('Clearance');
      expect(FEATURE_CONFIG['multiple-categories'].label).toBe('Categories');
    });

    it('has unique labels', () => {
      const labels = Object.values(FEATURE_CONFIG).map((c) => c.label);
      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(labels.length);
    });

    it('has descriptive descriptions', () => {
      // Each description should be a full sentence (has spaces and reasonable length)
      Object.values(FEATURE_CONFIG).forEach((config) => {
        expect(config.description.includes(' ')).toBe(true);
        expect(config.description.length).toBeGreaterThan(15);
      });
    });
  });
});
