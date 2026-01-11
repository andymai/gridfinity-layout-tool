import { describe, it, expect, beforeAll } from 'vitest';
import i18n from '../i18n';
import { namespaces } from '../i18n';

// Import all English translations for key validation
import common from '../i18n/locales/en/common.json';
import layout from '../i18n/locales/en/layout.json';
import validation from '../i18n/locales/en/validation.json';
import toast from '../i18n/locales/en/toast.json';
import share from '../i18n/locales/en/share.json';
import print from '../i18n/locales/en/print.json';
import help from '../i18n/locales/en/help.json';
import aria from '../i18n/locales/en/aria.json';

const translations = {
  common,
  layout,
  validation,
  toast,
  share,
  print,
  help,
  aria,
};

/**
 * Recursively extract all keys from a translation object
 */
function extractKeys(
  obj: Record<string, unknown>,
  prefix = ''
): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      keys.push(fullKey);
    } else if (typeof value === 'object' && value !== null) {
      keys.push(...extractKeys(value as Record<string, unknown>, fullKey));
    }
  }

  return keys;
}

describe('i18n', () => {
  beforeAll(async () => {
    // Ensure i18n is initialized
    await i18n.init;
  });

  describe('configuration', () => {
    it('has English as default language', () => {
      // Browser detection may return 'en-US' or other variants
      expect(i18n.language).toMatch(/^en/);
    });

    it('has English as fallback language', () => {
      expect(i18n.options.fallbackLng).toContain('en');
    });

    it('has all expected namespaces', () => {
      expect(namespaces).toEqual([
        'common',
        'layout',
        'validation',
        'toast',
        'share',
        'print',
        'help',
        'aria',
      ]);
    });

    it('has common as default namespace', () => {
      expect(i18n.options.defaultNS).toBe('common');
    });
  });

  describe('translation keys', () => {
    it.each(namespaces)('all keys in %s namespace exist', (namespace) => {
      const keys = extractKeys(
        translations[namespace as keyof typeof translations]
      );

      for (const key of keys) {
        expect(
          i18n.exists(`${namespace}:${key}`),
          `Missing key: ${namespace}:${key}`
        ).toBe(true);
      }
    });

    it('has required common button keys', () => {
      const requiredKeys = [
        'buttons.save',
        'buttons.cancel',
        'buttons.delete',
        'buttons.confirm',
        'buttons.close',
      ];

      for (const key of requiredKeys) {
        expect(i18n.exists(`common:${key}`), `Missing key: common:${key}`).toBe(
          true
        );
      }
    });

    it('has required validation error keys', () => {
      const requiredKeys = [
        'bin.outOfBounds',
        'bin.collision',
        'bin.exceedsHeight',
        'import.invalidFormat',
      ];

      for (const key of requiredKeys) {
        expect(
          i18n.exists(`validation:${key}`),
          `Missing key: validation:${key}`
        ).toBe(true);
      }
    });
  });

  describe('pluralization', () => {
    it('handles singular correctly', () => {
      const result = i18n.t('common:units.gridUnit', { count: 1 });
      expect(result).toBe('1 unit');
    });

    it('handles plural correctly', () => {
      const result = i18n.t('common:units.gridUnit', { count: 5 });
      expect(result).toBe('5 units');
    });

    it('handles zero as plural', () => {
      const result = i18n.t('common:units.gridUnit', { count: 0 });
      expect(result).toBe('0 units');
    });
  });

  describe('interpolation', () => {
    it('interpolates simple values', () => {
      const result = i18n.t('common:units.mm', { value: 42 });
      expect(result).toBe('42mm');
    });

    it('interpolates layout names', () => {
      const result = i18n.t('layout:library.switchTo', { name: 'My Layout' });
      expect(result).toBe('Switch to My Layout');
    });

    it('interpolates share error with minutes', () => {
      // count is required for i18next to select the plural form
      const result = i18n.t('share:errors.rateLimited', { minutes: 5, count: 5 });
      expect(result).toBe('Too many requests. Try again in 5 minutes.');
    });

    it('interpolates layer number', () => {
      const result = i18n.t('layout:layer.defaultName', { number: 3 });
      expect(result).toBe('Layer 3');
    });
  });

  describe('translation values', () => {
    it.each(namespaces)('no empty values in %s namespace', (namespace) => {
      const keys = extractKeys(
        translations[namespace as keyof typeof translations]
      );

      for (const key of keys) {
        const value = i18n.t(`${namespace}:${key}`);
        expect(value.trim().length, `Empty value: ${namespace}:${key}`).toBeGreaterThan(0);
      }
    });

    it.each(namespaces)(
      'no keys returning the key itself in %s namespace',
      (namespace) => {
        const keys = extractKeys(
          translations[namespace as keyof typeof translations]
        );

        for (const key of keys) {
          const fullKey = `${namespace}:${key}`;
          const value = i18n.t(fullKey);
          // If value equals key, translation is missing
          expect(value, `Missing translation: ${fullKey}`).not.toBe(fullKey);
        }
      }
    );
  });

  describe('namespace isolation', () => {
    it('keys are scoped to namespaces', () => {
      // Same key name in different namespaces should return different values
      expect(i18n.t('common:buttons.delete')).toBe('Delete');
      expect(i18n.t('aria:buttons.delete')).toBe('Delete');

      // Different structure in different namespaces
      expect(i18n.t('layout:bin.label')).toBe('Label');
      expect(i18n.t('aria:bin.description')).toContain('{{width}}');
    });
  });

  describe('fallback behavior', () => {
    it('returns key for missing translations', () => {
      const result = i18n.t('common:nonexistent.key');
      expect(result).toBe('nonexistent.key');
    });

    it('falls back to default namespace when namespace omitted', () => {
      const withNs = i18n.t('common:buttons.save');
      const withoutNs = i18n.t('buttons.save');
      expect(withNs).toBe(withoutNs);
    });
  });
});

describe('translation file structure', () => {
  it('common namespace has expected sections', () => {
    expect(common).toHaveProperty('buttons');
    expect(common).toHaveProperty('labels');
    expect(common).toHaveProperty('placeholders');
    expect(common).toHaveProperty('units');
    expect(common).toHaveProperty('status');
    expect(common).toHaveProperty('confirmations');
    expect(common).toHaveProperty('errors');
  });

  it('validation namespace has expected sections', () => {
    expect(validation).toHaveProperty('bin');
    expect(validation).toHaveProperty('import');
    expect(validation).toHaveProperty('layout');
  });

  it('layout namespace has expected sections', () => {
    expect(layout).toHaveProperty('drawer');
    expect(layout).toHaveProperty('layer');
    expect(layout).toHaveProperty('bin');
    expect(layout).toHaveProperty('category');
    expect(layout).toHaveProperty('library');
  });

  it('aria namespace has expected sections', () => {
    expect(aria).toHaveProperty('bin');
    expect(aria).toHaveProperty('grid');
    expect(aria).toHaveProperty('navigation');
    expect(aria).toHaveProperty('actions');
    expect(aria).toHaveProperty('announcements');
  });
});
