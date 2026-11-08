import { describe, it, expect } from 'vitest';
import {
  allowedPluralCategories,
  lookupPlural,
  pluralBase,
  pluralCategory,
  pluralCount,
  requiredPluralCategories,
} from './plural';

describe('pluralCount', () => {
  it('takes numbers and numeric strings, and nothing else', () => {
    expect(pluralCount(3)).toBe(3);
    expect(pluralCount('3')).toBe(3);
    expect(pluralCount('1,234')).toBeUndefined();
    expect(pluralCount('')).toBeUndefined();
    expect(pluralCount(Number.NaN)).toBeUndefined();
    expect(pluralCount(undefined)).toBeUndefined();
  });
});

describe('pluralBase', () => {
  it('strips a plural suffix and leaves ordinary keys alone', () => {
    expect(pluralBase('layers.binCount_one')).toBe('layers.binCount');
    expect(pluralBase('layers.binCount_many')).toBe('layers.binCount');
    expect(pluralBase('layers.binCount')).toBeNull();
    expect(pluralBase('settings.other')).toBeNull();
  });
});

describe('pluralCategory', () => {
  it('follows each language’s own rules', () => {
    expect(pluralCategory('en', 1)).toBe('one');
    expect(pluralCategory('en', 0)).toBe('other');
    expect(pluralCategory('fr', 0)).toBe('one');
    expect(pluralCategory('pl', 2)).toBe('few');
    expect(pluralCategory('pl', 5)).toBe('many');
    expect(pluralCategory('pl', 22)).toBe('few');
    expect(pluralCategory('ja', 1)).toBe('other');
  });
});

describe('lookupPlural', () => {
  const pl = {
    'x.count_one': '{count} bin',
    'x.count_few': '{count} biny',
    'x.count_many': '{count} binów',
    'x.count_other': '{count} binów',
  };

  it('picks the form for the count', () => {
    expect(lookupPlural(pl, 'pl', 'x.count', 1)).toBe('{count} bin');
    expect(lookupPlural(pl, 'pl', 'x.count', 3)).toBe('{count} biny');
    expect(lookupPlural(pl, 'pl', 'x.count', 12)).toBe('{count} binów');
  });

  it('falls back to _other when the category has no form', () => {
    expect(lookupPlural({ 'x.count_other': '{count} 個' }, 'ja', 'x.count', 1)).toBe('{count} 個');
    expect(lookupPlural({ 'x.count_other': 'n' }, 'pl', 'x.count', 3)).toBe('n');
  });

  it('returns undefined for a key with no plural forms', () => {
    expect(lookupPlural({ 'x.count': 'plain' }, 'en', 'x.count', 1)).toBeUndefined();
  });
});

describe('requiredPluralCategories', () => {
  it('asks for the forms whole numbers reach, plus _other', () => {
    expect(requiredPluralCategories('en')).toEqual(['one', 'other']);
    expect(requiredPluralCategories('cs')).toEqual(['one', 'few', 'other']);
    expect(requiredPluralCategories('pl')).toEqual(['one', 'few', 'many', 'other']);
    expect(requiredPluralCategories('ja')).toEqual(['other']);
  });

  it('stays within the categories the language defines', () => {
    for (const locale of ['en', 'cs', 'pl', 'uk', 'fr', 'ja']) {
      const allowed = allowedPluralCategories(locale);
      for (const category of requiredPluralCategories(locale)) {
        expect(allowed).toContain(category);
      }
    }
  });
});
