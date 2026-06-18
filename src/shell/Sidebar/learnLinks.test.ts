import { describe, it, expect } from 'vitest';
import { learnHref, LEARN_LINKS } from './learnLinks';

describe('learnHref', () => {
  it('returns the root path for English', () => {
    expect(learnHref('gridfinity-sizes', true, 'en')).toBe('/gridfinity-sizes');
  });

  it('prefixes the locale for a translated slug on a content locale', () => {
    expect(learnHref('gridfinity-sizes', true, 'de')).toBe('/de/gridfinity-sizes');
    expect(learnHref('what-is-gridfinity', true, 'pt-BR')).toBe('/pt-BR/what-is-gridfinity');
  });

  it('keeps English-only slugs on the root path even for content locales', () => {
    expect(learnHref('gridfinity-calculator', false, 'de')).toBe('/gridfinity-calculator');
    expect(learnHref('gridfinity-software', false, 'fr')).toBe('/gridfinity-software');
  });

  it('keeps locales without content pages (e.g. ja) on English content', () => {
    expect(learnHref('gridfinity-sizes', true, 'ja')).toBe('/gridfinity-sizes');
  });
});

describe('LEARN_LINKS', () => {
  it('marks only the four newest pages as English-only', () => {
    const englishOnly = LEARN_LINKS.filter((l) => !l.localized).map((l) => l.slug);
    expect(englishOnly).toEqual([
      'gridfinity-calculator',
      'gridfinity-tool-drawer',
      'gridfinity-kitchen-drawer',
      'gridfinity-software',
    ]);
  });
});
