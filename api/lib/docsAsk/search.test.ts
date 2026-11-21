import { describe, expect, it } from 'vitest';
import { createSearch, tokenize } from './search.js';
import type { SearchSection } from './search.js';

function section(heading: string, text: string, page = 'Page', link = '/p'): SearchSection {
  return { link, page, heading, anchor: heading.toLowerCase().replace(/\s+/g, '-'), text };
}

describe('tokenize', () => {
  it('drops stopwords, accents and one-letter words, and folds a plural s', () => {
    expect(tokenize('How do I add Magnets to the café bins? a')).toEqual([
      'add',
      'magnet',
      'cafe',
      'bin',
    ]);
  });

  it('keeps a double s', () => {
    expect(tokenize('glass thickness')).toEqual(['glass', 'thickness']);
  });
});

describe('createSearch', () => {
  const sections = [
    section('Walls', 'Set the wall thickness. Magnets are on another page.'),
    section(
      'Add magnet holes',
      'Turn on magnet holes in the base section.',
      'The base',
      '/designer/base'
    ),
    section('Lids', 'A lid can hold with magnets.'),
  ];
  const search = createSearch(sections);

  it('ranks a heading match first', () => {
    expect(search('magnet holes').map((hit) => hit.link)).toEqual(['/designer/base', '/p', '/p']);
  });

  it('finds a plural from a singular', () => {
    expect(search('lid magnet')[0]?.heading).toBe('Lids');
  });

  it('returns nothing for a query of stopwords', () => {
    expect(search('how do I')).toEqual([]);
  });

  it('keeps the sections in their order when scores tie', () => {
    const tied = createSearch([section('One', 'drawer'), section('Two', 'drawer')]);
    expect(tied('drawer').map((hit) => hit.heading)).toEqual(['One', 'Two']);
  });

  it('cuts a snippet around the first match', () => {
    const long = `${'filler '.repeat(80)}the needle sits here ${'tail '.repeat(80)}`;
    const [hit] = createSearch([section('Long', long)])('needle');
    expect(hit?.snippet).toContain('needle');
    expect(hit?.snippet.startsWith('…')).toBe(true);
    expect(hit?.snippet.endsWith('…')).toBe(true);
    expect(hit?.snippet.length).toBeLessThanOrEqual(242);
  });

  it('limits the hits', () => {
    expect(search('magnet', 1)).toHaveLength(1);
  });
});
