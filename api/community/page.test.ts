import { describe, it, expect } from 'vitest';
import {
  designJsonLd,
  escapeAttr,
  injectDesignMeta,
  isIndexable,
  renderDesignFallback,
  truncate,
} from './page.js';
import type { DesignMeta } from './page.js';

const SITE = 'https://gridfinitylayouttool.com';

const SHELL = [
  '<!doctype html><html><head>',
  '<title>Gridfinity Layout Tool</title>',
  '<meta name="description" content="Plan drawer organizers.">',
  '<meta name="robots" content="index, follow">',
  '<link rel="canonical" href="https://gridfinitylayouttool.com/">',
  '<meta property="og:url" content="https://gridfinitylayouttool.com/">',
  '<meta property="og:title" content="Gridfinity Layout Tool">',
  '<meta property="og:description" content="Plan drawer organizers.">',
  '<meta property="og:type" content="website">',
  '<meta property="og:image" content="https://gridfinitylayouttool.com/og/home.png">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta property="og:image:alt" content="Gridfinity Layout Tool">',
  '</head><body>',
  '<div id="root"><div id="seo-fallback" style="display:none; padding: 20px;">',
  '<noscript><style>#seo-fallback{display:block!important}</style></noscript>',
  '<h1>Gridfinity Planner &amp; Layout Tool</h1>',
  '<p>A free Gridfinity planner for making bins.</p>',
  '</div></div>',
  '<script>boot()</script></body></html>',
].join('');

function design(overrides: Partial<DesignMeta> = {}): DesignMeta {
  return {
    id: 'Abc123456789',
    name: 'Hex Driver Nest',
    authorName: 'ada',
    description: 'Holds twelve hex drivers upright so you can read the sizes.',
    thumbnailUrl: 'https://blob.test/thumb.webp',
    category: 'tools',
    metrics: { width: 83.5, depth: 41.5, height: 21, gridUnitMm: 42 },
    counts: { likes: 3, remixes: 0, prints: 1 },
    featured: false,
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

  it('leaves the boot scripts byte-identical', () => {
    // The shell's inline scripts are covered by CSP hashes; changing a byte of
    // them would block the app from booting. The SEO fallback is not a script
    // and is deliberately replaced — everything else in the body is not.
    const html = injectDesignMeta(SHELL, design(), SITE);
    expect(html).toContain('<script>boot()</script></body>');
  });

  it('replaces the homepage fallback copy with the design’s own', () => {
    // Without this every design page served the same planner text under the same
    // h1, which is why the route was disallowed instead of indexed.
    const html = injectDesignMeta(SHELL, design(), SITE);
    expect(html).toContain('<h1>Hex Driver Nest</h1>');
    expect(html).not.toContain('<h1>Gridfinity Planner &amp; Layout Tool</h1>');
    expect(html).not.toContain('A free Gridfinity planner for making bins.');
    expect(html).toContain('Holds twelve hex drivers upright');
  });

  it('keeps the fallback’s opening tag and its noscript reveal', () => {
    // The inline display:none lives on the opening tag, and the noscript inside
    // is the only thing that shows the block to a visitor without JS.
    const html = injectDesignMeta(SHELL, design(), SITE);
    expect(html).toContain('<div id="seo-fallback" style="display:none; padding: 20px;">');
    expect(html).toContain(
      '<noscript><style>#seo-fallback{display:block!important}</style></noscript>'
    );
  });

  it('states the size in grid units and millimetres', () => {
    const html = injectDesignMeta(SHELL, design(), SITE);
    expect(html).toContain('2×1 at 3U');
    expect(html).toContain('83.5mm × 41.5mm × 21mm');
  });

  it('marks a design below the quality bar noindex and gives it no schema', () => {
    const html = injectDesignMeta(
      SHELL,
      design({ counts: { likes: 0, remixes: 0, prints: 0 } }),
      SITE
    );
    expect(html).toContain('<meta name="robots" content="noindex, follow">');
    expect(html).not.toContain('application/ld+json');
    // It still gets its own title and copy: scrapers and humans want those.
    expect(html).toContain('<title>Hex Driver Nest by ada — Gridfinity Community</title>');
    expect(html).toContain('<h1>Hex Driver Nest</h1>');
  });

  it('also gates the bot-specific robots directives', () => {
    // googlebot/bingbot meta OVERRIDE the generic robots meta for those
    // crawlers, so gating only the generic one would let exactly the two
    // crawlers that matter index a design the gate rejected.
    const shell = SHELL.replace(
      '<meta name="robots" content="index, follow">',
      [
        '<meta name="robots" content="index, follow">',
        '<meta name="googlebot" content="index, follow, max-image-preview:large">',
        '<meta name="bingbot" content="index, follow, max-snippet:-1">',
      ].join('')
    );
    const html = injectDesignMeta(
      shell,
      design({ counts: { likes: 0, remixes: 0, prints: 0 } }),
      SITE
    );
    expect(html).toContain('<meta name="googlebot" content="noindex, follow">');
    expect(html).toContain('<meta name="bingbot" content="noindex, follow">');
    expect(html).not.toContain('content="index, follow, max-image-preview:large"');
  });

  it('leaves the bot directives alone for an indexable design', () => {
    const shell = SHELL.replace(
      '<meta name="robots" content="index, follow">',
      '<meta name="robots" content="index, follow"><meta name="googlebot" content="index, follow, max-snippet:-1">'
    );
    const html = injectDesignMeta(shell, design(), SITE);
    expect(html).toContain('<meta name="googlebot" content="index, follow, max-snippet:-1">');
  });

  it('finds the fallback’s real close when the block has a nested div', () => {
    // Matching to the first </div> would truncate the element and leave broken
    // markup on every design page.
    const shell = SHELL.replace(
      '<p>A free Gridfinity planner for making bins.</p>',
      '<div class="wrap"><p>A free Gridfinity planner for making bins.</p></div>'
    );
    const html = injectDesignMeta(shell, design(), SITE);
    expect(html).toContain('<h1>Hex Driver Nest</h1>');
    expect(html).not.toContain('A free Gridfinity planner for making bins.');
    expect(html).not.toContain('<div class="wrap">');
    // The shell after the block is intact: root close, boot script, document end.
    expect(html).toContain('</div></div><script>boot()</script></body></html>');
  });

  it('leaves the document alone when the fallback has no balanced close', () => {
    const shell = SHELL.replace('</div></div>', '');
    const html = injectDesignMeta(shell, design(), SITE);
    expect(html).toContain('<h1>Gridfinity Planner &amp; Layout Tool</h1>');
    expect(html).not.toContain('<h1>Hex Driver Nest</h1>');
    // Meta injection still happened; only the body swap backed out.
    expect(html).toContain('<title>Hex Driver Nest by ada — Gridfinity Community</title>');
  });

  it('leaves an indexable design indexable and adds its schema', () => {
    const html = injectDesignMeta(SHELL, design(), SITE);
    expect(html).toContain('<meta name="robots" content="index, follow">');
    expect(html).toContain('"@type":"CreativeWork"');
    expect(html).toContain('</script></head>');
  });

  it('escapes a design name in the body, not just the meta', () => {
    const html = injectDesignMeta(SHELL, design({ name: '<script>alert(1)</script>' }), SITE);
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('keeps a dollar sign in a design name literal', () => {
    // replaceOne replaces via a function precisely so `$&` in user text is not
    // treated as a replacement pattern.
    const html = injectDesignMeta(SHELL, design({ name: 'Cost $& Value' }), SITE);
    expect(html).toContain('Cost $&amp; Value');
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

describe('isIndexable', () => {
  it('accepts a complete design someone has engaged with', () => {
    expect(isIndexable(design())).toBe(true);
  });

  it('rejects a design nobody has touched', () => {
    // Complete metadata is not enough: an unused page is crawl budget spent on
    // nothing, and with a young gallery most designs are in this state.
    expect(isIndexable(design({ counts: { likes: 0, remixes: 0, prints: 0 } }))).toBe(false);
  });

  it('accepts a featured design regardless of counts', () => {
    expect(
      isIndexable(design({ featured: true, counts: { likes: 0, remixes: 0, prints: 0 } }))
    ).toBe(true);
  });

  it('rejects the default untitled name', () => {
    expect(isIndexable(design({ name: 'Untitled layout' }))).toBe(false);
    expect(isIndexable(design({ name: 'untitled' }))).toBe(false);
  });

  it('does not reject a real name that merely starts with the same letters', () => {
    expect(isIndexable(design({ name: 'Untitledish Bracket' }))).toBe(true);
  });

  it('rejects a design with no render to show', () => {
    expect(isIndexable(design({ thumbnailUrl: '' }))).toBe(false);
  });

  it('rejects a design with no real dimensions', () => {
    expect(
      isIndexable(design({ metrics: { width: 0, depth: 0, height: 0, gridUnitMm: 42 } }))
    ).toBe(false);
  });
});

describe('renderDesignFallback', () => {
  it('omits the details list when there is nothing to put in it', () => {
    const html = renderDesignFallback(
      design({
        category: '',
        description: '',
        thumbnailUrl: '',
        metrics: { width: 0, depth: 0, height: 0, gridUnitMm: 0 },
        counts: { likes: 0, remixes: 0, prints: 0 },
      }),
      `${SITE}/community/d/Abc123456789`
    );
    expect(html).not.toContain('<h2>Design details</h2>');
    expect(html).not.toContain('<img');
    expect(html).toContain('<h1>Hex Driver Nest</h1>');
  });

  it('names an empty design rather than emitting an empty heading', () => {
    const html = renderDesignFallback(design({ name: '  ' }), SITE);
    expect(html).toContain('<h1>Untitled design</h1>');
  });

  it('links back to the gallery and the tool', () => {
    const html = renderDesignFallback(design(), SITE);
    expect(html).toContain('href="/community"');
    expect(html).toContain('href="/"');
  });
});

describe('designJsonLd', () => {
  const url = `${SITE}/community/d/Abc123456789`;

  it('declares a CC BY licensed CreativeWork, not a product', () => {
    const graph: unknown = JSON.parse(
      designJsonLd(design(), url)
        .replace('<script type="application/ld+json">', '')
        .replace('</script>', '')
    );
    expect(graph).toMatchObject({
      '@type': 'CreativeWork',
      url,
      name: 'Hex Driver Nest',
      author: { '@type': 'Person', name: 'ada' },
      license: 'https://creativecommons.org/licenses/by/4.0/',
      isAccessibleForFree: true,
    });
  });

  it('omits fields the design does not have rather than emitting empties', () => {
    const json = designJsonLd(
      design({
        description: '',
        thumbnailUrl: '',
        category: '',
        counts: { likes: 0, remixes: 0, prints: 0 },
      }),
      url
    );
    expect(json).not.toContain('"description"');
    expect(json).not.toContain('"image"');
    expect(json).not.toContain('"genre"');
    expect(json).not.toContain('interactionStatistic');
  });

  it('cannot be broken out of with a closing script tag in a design name', () => {
    // HTML escaping does not apply inside a <script> block, so `</script>` in
    // user text would close the element and turn the rest into live markup.
    const json = designJsonLd(
      design({ name: '</script><img src=x onerror=alert(1)>', description: '</SCRIPT>' }),
      url
    );
    expect(json).not.toContain('</script><img');
    expect(json.match(/<\/script>/gi)).toHaveLength(1);
    expect(json).toContain('\\u003c/script>');
    // Still valid JSON, and the name survives intact once parsed.
    const parsed = JSON.parse(
      json.replace('<script type="application/ld+json">', '').replace(/<\/script>$/, '')
    ) as { name: string };
    expect(parsed.name).toBe('</script><img src=x onerror=alert(1)>');
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
