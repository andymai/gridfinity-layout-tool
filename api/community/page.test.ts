import { describe, it, expect } from 'vitest';
import { escapeAttr, injectDesignMeta, truncate } from './page.js';
import type { DesignMeta } from './page.js';

const SITE = 'https://gridfinitylayouttool.com';

const SHELL = [
  '<!doctype html><html><head>',
  '<title>Gridfinity Layout Tool</title>',
  '<meta name="description" content="Plan drawer organizers.">',
  '<link rel="canonical" href="https://gridfinitylayouttool.com/">',
  '<meta property="og:url" content="https://gridfinitylayouttool.com/">',
  '<meta property="og:title" content="Gridfinity Layout Tool">',
  '<meta property="og:description" content="Plan drawer organizers.">',
  '<meta property="og:type" content="website">',
  '<meta property="og:image" content="https://gridfinitylayouttool.com/og/home.png">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta property="og:image:alt" content="Gridfinity Layout Tool">',
  '</head><body><script>boot()</script></body></html>',
].join('');

function design(overrides: Partial<DesignMeta> = {}): DesignMeta {
  return {
    id: 'Abc123456789',
    name: 'Hex Driver Nest',
    authorName: 'ada',
    description: 'Holds twelve hex drivers upright so you can read the sizes.',
    thumbnailUrl: 'https://blob.test/thumb.webp',
    ...overrides,
  };
}

describe('injectDesignMeta', () => {
  it('replaces the shell metadata with the design’s own', () => {
    const html = injectDesignMeta(SHELL, design(), SITE);
    expect(html).toContain('<title>Hex Driver Nest by ada — Gridfinity Community</title>');
    expect(html).toContain(
      '<meta property="og:url" content="https://gridfinitylayouttool.com/community/d/Abc123456789">'
    );
    expect(html).toContain('<meta property="og:image" content="https://blob.test/thumb.webp">');
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain(
      '<link rel="canonical" href="https://gridfinitylayouttool.com/community/d/Abc123456789">'
    );
    expect(html).toContain('Holds twelve hex drivers upright');
  });

  it('leaves the body and boot scripts byte-identical', () => {
    // The shell's inline scripts are covered by CSP hashes; changing a byte of
    // them would block the app from booting.
    const html = injectDesignMeta(SHELL, design(), SITE);
    expect(html).toContain('<body><script>boot()</script></body>');
  });

  it('escapes markup in a design name rather than emitting it', () => {
    const html = injectDesignMeta(
      SHELL,
      design({ name: '"><script>alert(1)</script>', authorName: 'a&b' }),
      SITE
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
    expect(html).toContain('a&amp;b');
  });

  it('falls back to a written description when the design has none', () => {
    const html = injectDesignMeta(SHELL, design({ description: '   ' }), SITE);
    expect(html).toContain('A Gridfinity bin design shared by ada');
  });

  it('drops the inherited image dimensions when it swaps the image', () => {
    // The shell declares the 1200x630 site card. A design's render is a 384px
    // square, so leaving those has scrapers reserve a box it cannot fill.
    const html = injectDesignMeta(SHELL, design(), SITE);
    expect(html).not.toContain('og:image:width');
    expect(html).not.toContain('og:image:height');
  });

  it('keeps the site card dimensions when it keeps the site image', () => {
    const html = injectDesignMeta(SHELL, design({ thumbnailUrl: '' }), SITE);
    expect(html).toContain('<meta property="og:image:width" content="1200">');
  });

  it('keeps the site default image when the design has no thumbnail', () => {
    // An og:image pointing at nothing unfurls worse than none at all.
    const html = injectDesignMeta(SHELL, design({ thumbnailUrl: '' }), SITE);
    expect(html).toContain(
      '<meta property="og:image" content="https://gridfinitylayouttool.com/og/home.png">'
    );
  });

  it('leaves a tag alone when the shell no longer has exactly one of it', () => {
    // A shell that changed shape should lose the injection, not gain a second
    // conflicting tag: two og:title tags unfurl worse than the generic one.
    const doubled = SHELL.replace(
      '<meta property="og:title" content="Gridfinity Layout Tool">',
      '<meta property="og:title" content="Gridfinity Layout Tool"><meta property="og:title" content="Other">'
    );
    const html = injectDesignMeta(doubled, design(), SITE);
    expect(html).not.toContain('Hex Driver Nest by ada — Gridfinity Community"');
    expect(html.match(/property="og:title"/g)).toHaveLength(2);
    // The tags that are still unique are still swapped.
    expect(html).toContain('<meta property="og:type" content="article">');
  });
});

describe('truncate', () => {
  it('leaves a short description untouched', () => {
    expect(truncate('Short enough.', 200)).toBe('Short enough.');
  });

  it('collapses whitespace so a multi-line description does not waste the budget', () => {
    expect(truncate('one\n\n  two   three', 200)).toBe('one two three');
  });

  it('breaks on a word boundary and marks the cut', () => {
    const result = truncate('alpha bravo charlie delta echo foxtrot', 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toContain('charli…');
  });

  it('cuts mid-word rather than returning almost nothing', () => {
    // A single long token has no boundary to break on; losing the whole
    // description would be worse than a hard cut.
    const result = truncate('a'.repeat(80), 20);
    expect(result).toHaveLength(20);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('escapeAttr', () => {
  it('escapes every character that could break out of an attribute', () => {
    expect(escapeAttr('a&b"c<d>e')).toBe('a&amp;b&quot;c&lt;d&gt;e');
  });

  it('escapes the ampersand first so entities are not double-built', () => {
    expect(escapeAttr('&quot;')).toBe('&amp;quot;');
  });
});
