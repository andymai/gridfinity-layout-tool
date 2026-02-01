import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import {
  type Allowlist,
  findUntranslatedValues,
  getEnglishTranslations,
  getLocaleTranslations,
  isAllowedIdentical,
  loadAllowlist,
} from './check-i18n-values';

const TEST_ALLOWLIST: Allowlist = {
  maxShortValueLength: 3,
  keys: ['brand.name', 'format.stl'],
  valuePatterns: ['^\\{[\\w,\\s]+\\}$', '^[A-Z0-9]{2,4}$'],
};

describe('getEnglishTranslations', () => {
  it('extracts single-quoted key-value pairs', () => {
    const content = `const en = {\n  'common.save': 'Save',\n  'common.cancel': 'Cancel',\n};`;
    const result = getEnglishTranslations(content);
    expect(result.get('common.save')).toBe('Save');
    expect(result.get('common.cancel')).toBe('Cancel');
    expect(result.size).toBe(2);
  });

  it('extracts double-quoted values', () => {
    const content = `const en = {\n  'seo.title': "My App Title",\n};`;
    const result = getEnglishTranslations(content);
    expect(result.get('seo.title')).toBe('My App Title');
  });

  it('handles empty values', () => {
    const content = `const en = {\n  'empty.key': '',\n};`;
    const result = getEnglishTranslations(content);
    expect(result.get('empty.key')).toBe('');
  });

  it('extracts interpolation placeholders in values', () => {
    const content = `const en = {\n  'toast.deleted': 'Deleted {count} bin(s)',\n};`;
    const result = getEnglishTranslations(content);
    expect(result.get('toast.deleted')).toBe('Deleted {count} bin(s)');
  });

  it('returns empty map for content with no keys', () => {
    expect(getEnglishTranslations('export default {};').size).toBe(0);
  });
});

describe('getLocaleTranslations', () => {
  it('parses JSON key-value pairs', () => {
    const content = JSON.stringify({ 'common.save': 'Speichern', 'common.cancel': 'Abbrechen' });
    const result = getLocaleTranslations(content);
    expect(result.get('common.save')).toBe('Speichern');
    expect(result.get('common.cancel')).toBe('Abbrechen');
  });
});

describe('loadAllowlist', () => {
  it('parses allowlist JSON', () => {
    const content = JSON.stringify(TEST_ALLOWLIST);
    const result = loadAllowlist(content);
    expect(result.maxShortValueLength).toBe(3);
    expect(result.keys).toContain('brand.name');
    expect(result.valuePatterns).toHaveLength(2);
  });
});

describe('isAllowedIdentical', () => {
  it('allows explicitly listed keys', () => {
    expect(isAllowedIdentical('brand.name', 'Gridfinity Tool', TEST_ALLOWLIST)).toBe(true);
    expect(isAllowedIdentical('format.stl', 'STL', TEST_ALLOWLIST)).toBe(true);
  });

  it('rejects keys not in allowlist', () => {
    expect(isAllowedIdentical('common.save', 'Save', TEST_ALLOWLIST)).toBe(false);
  });

  it('allows short values without spaces', () => {
    expect(isAllowedIdentical('any.key', 'OK', TEST_ALLOWLIST)).toBe(true);
    expect(isAllowedIdentical('any.key', '9+', TEST_ALLOWLIST)).toBe(true);
    expect(isAllowedIdentical('any.key', 'mm', TEST_ALLOWLIST)).toBe(true);
  });

  it('rejects short values with spaces', () => {
    expect(isAllowedIdentical('any.key', 'a b', TEST_ALLOWLIST)).toBe(false);
  });

  it('rejects values longer than maxShortValueLength', () => {
    expect(isAllowedIdentical('any.key', 'Auto', TEST_ALLOWLIST)).toBe(false);
    expect(isAllowedIdentical('any.key', 'Star', TEST_ALLOWLIST)).toBe(false);
  });

  it('allows empty values to be skipped (not flagged)', () => {
    // Empty values are excluded — isAllowedIdentical returns false but
    // findUntranslatedValues skips empty values before calling this
    expect(isAllowedIdentical('any.key', '', TEST_ALLOWLIST)).toBe(false);
  });

  it('allows values matching patterns', () => {
    // Pure interpolation: {count}
    expect(isAllowedIdentical('any.key', '{count}', TEST_ALLOWLIST)).toBe(true);
    // Short uppercase acronym: STL, JSON
    expect(isAllowedIdentical('any.key', 'STL', TEST_ALLOWLIST)).toBe(true);
    expect(isAllowedIdentical('any.key', 'JSON', TEST_ALLOWLIST)).toBe(true);
  });

  it('rejects values not matching any pattern', () => {
    expect(isAllowedIdentical('any.key', 'Delete', TEST_ALLOWLIST)).toBe(false);
    expect(isAllowedIdentical('any.key', 'Export failed', TEST_ALLOWLIST)).toBe(false);
  });

  it('handles special characters in values', () => {
    expect(isAllowedIdentical('any.key', '{width}×{depth}', TEST_ALLOWLIST)).toBe(false);
  });
});

describe('findUntranslatedValues', () => {
  it('detects identical values', () => {
    const en = new Map([
      ['common.save', 'Save'],
      ['common.cancel', 'Cancel'],
    ]);
    const locale = new Map([
      ['common.save', 'Speichern'],
      ['common.cancel', 'Cancel'],
    ]);
    const result = findUntranslatedValues(en, locale, TEST_ALLOWLIST);
    expect(result).toEqual([{ key: 'common.cancel', value: 'Cancel' }]);
  });

  it('returns empty array when all values differ', () => {
    const en = new Map([['common.save', 'Save']]);
    const locale = new Map([['common.save', 'Speichern']]);
    const result = findUntranslatedValues(en, locale, TEST_ALLOWLIST);
    expect(result).toEqual([]);
  });

  it('skips allowlisted keys', () => {
    const en = new Map([['brand.name', 'Gridfinity']]);
    const locale = new Map([['brand.name', 'Gridfinity']]);
    const result = findUntranslatedValues(en, locale, TEST_ALLOWLIST);
    expect(result).toEqual([]);
  });

  it('skips short values without spaces', () => {
    const en = new Map([['common.overflow', '9+']]);
    const locale = new Map([['common.overflow', '9+']]);
    const result = findUntranslatedValues(en, locale, TEST_ALLOWLIST);
    expect(result).toEqual([]);
  });

  it('skips empty values', () => {
    const en = new Map([['empty.key', '']]);
    const locale = new Map([['empty.key', '']]);
    const result = findUntranslatedValues(en, locale, TEST_ALLOWLIST);
    expect(result).toEqual([]);
  });

  it('skips keys not in English', () => {
    const en = new Map<string, string>();
    const locale = new Map([['extra.key', 'Extra']]);
    const result = findUntranslatedValues(en, locale, TEST_ALLOWLIST);
    expect(result).toEqual([]);
  });

  it('sorts results by key', () => {
    const en = new Map([
      ['z.key', 'Zebra'],
      ['a.key', 'Apple'],
    ]);
    const locale = new Map([
      ['z.key', 'Zebra'],
      ['a.key', 'Apple'],
    ]);
    const result = findUntranslatedValues(en, locale, TEST_ALLOWLIST);
    expect(result[0].key).toBe('a.key');
    expect(result[1].key).toBe('z.key');
  });
});

describe('integration with real locale files', () => {
  const LOCALES_DIR = join(import.meta.dirname, '..', 'src', 'i18n', 'locales');
  const ALLOWLIST_PATH = join(import.meta.dirname, 'i18n-values-allowlist.json');

  it('parses the real en.ts file without errors', () => {
    const content = readFileSync(join(LOCALES_DIR, 'en.ts'), 'utf-8');
    const translations = getEnglishTranslations(content);
    expect(translations.size).toBeGreaterThan(100);
  });

  it('parses the real allowlist without errors', () => {
    const content = readFileSync(ALLOWLIST_PATH, 'utf-8');
    const allowlist = loadAllowlist(content);
    expect(allowlist.maxShortValueLength).toBeGreaterThan(0);
    expect(allowlist.keys.length).toBeGreaterThan(0);
    expect(allowlist.valuePatterns.length).toBeGreaterThan(0);
  });

  it('all allowlist patterns are valid regex', () => {
    const content = readFileSync(ALLOWLIST_PATH, 'utf-8');
    const allowlist = loadAllowlist(content);
    for (const pattern of allowlist.valuePatterns) {
      expect(() => new RegExp(pattern)).not.toThrow();
    }
  });
});
