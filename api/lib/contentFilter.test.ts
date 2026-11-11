/**
 * Tests for content filter module.
 */

import { describe, it, expect } from 'vitest';
import {
  checkText,
  filterDisplayName,
  filterLayoutContent,
  filterSharedDesignsContent,
  filterDesignParamsContent,
} from '../../api/lib/contentFilter.js';

describe('filterLayoutContent', () => {
  describe('clean content', () => {
    it('passes layout with normal text', () => {
      const result = filterLayoutContent({
        name: 'My Drawer Layout',
        bins: [
          { label: 'Screws', notes: 'For woodworking projects' },
          { label: 'Nails', notes: '2 inch and 3 inch sizes' },
        ],
        categories: [{ name: 'Hardware' }, { name: 'Tools' }],
      });

      expect(result.passed).toBe(true);
    });

    it('passes layout with empty strings', () => {
      const result = filterLayoutContent({
        name: 'Untitled',
        bins: [{ label: '', notes: '' }],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(true);
    });

    it('passes layout with numbers and special characters', () => {
      const result = filterLayoutContent({
        name: 'Layout #1 (2024)',
        bins: [{ label: 'M3x10mm', notes: 'Qty: 100+' }],
        categories: [{ name: 'Bolts & Screws' }],
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('offensive content in layout name', () => {
    it('blocks layouts with slurs in name', () => {
      const result = filterLayoutContent({
        name: 'Test nigger layout',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Layout name');
    });

    it('blocks layouts with hate speech in name', () => {
      const result = filterLayoutContent({
        name: 'faggot drawer',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });
  });

  describe('offensive content in bin labels', () => {
    it('blocks bins with slurs in label', () => {
      const result = filterLayoutContent({
        name: 'My Layout',
        bins: [{ label: 'retard stuff', notes: '' }],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Bin label');
    });
  });

  describe('offensive content in bin notes', () => {
    it('blocks bins with slurs in notes', () => {
      const result = filterLayoutContent({
        name: 'My Layout',
        bins: [{ label: 'Tools', notes: 'This is some cunt text' }],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Bin notes');
    });
  });

  describe('offensive content in bin items', () => {
    it.each([
      ['name', { name: 'This is some cunt text' }],
      ['note', { name: 'Screws', note: 'This is some cunt text' }],
    ])('blocks an item with a slur in its %s', (_field, item) => {
      const result = filterLayoutContent({
        name: 'My Layout',
        bins: [{ label: 'Tools', notes: '', items: [item] }],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Bin item');
    });

    it('passes ordinary item names and notes', () => {
      const result = filterLayoutContent({
        name: 'My Layout',
        bins: [{ label: 'Tools', items: [{ name: 'M3 screws', note: '8 mm' }] }],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('offensive content in categories', () => {
    it('blocks categories with slurs', () => {
      const result = filterLayoutContent({
        name: 'My Layout',
        bins: [],
        categories: [{ name: 'spic stuff' }],
      });

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Category');
    });
  });

  describe('harmful patterns', () => {
    it('blocks potential XSS in script tags', () => {
      const result = filterLayoutContent({
        name: '<script>alert("xss")</script>',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('blocks javascript: protocol', () => {
      const result = filterLayoutContent({
        name: 'javascript:void(0)',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('blocks event handlers', () => {
      const result = filterLayoutContent({
        name: 'onclick = alert(1)',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('blocks URLs (potential phishing)', () => {
      const result = filterLayoutContent({
        name: 'Check out https://malicious-site.com',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('blocks repeated character spam', () => {
      const result = filterLayoutContent({
        name: 'aaaaaaaaaaaaaaaaaaaaaaaaa', // 25 a's
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('blocks Zalgo text', () => {
      const result = filterLayoutContent({
        name: 'H̸̡̧̛̛̛̛̛̛e̸l̸l̸o̸', // Zalgo text with many combining chars
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });
  });

  describe('Unicode bypass resistance (MED-2 regression)', () => {
    it('blocks Cyrillic homoglyph "е" inside slur', () => {
      // Cyrillic 'е' (U+0435) replacing Latin 'e' — would have passed pre-fix.
      const result = filterLayoutContent({
        name: 'niggеr drawer',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('blocks zero-width-space inside slur', () => {
      const result = filterLayoutContent({
        name: 'ni​gger',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('blocks zero-width-joiner inside slur', () => {
      const result = filterLayoutContent({
        name: 'ni‍gger',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('blocks fullwidth Latin slur', () => {
      // ｎｉｇｇｅｒ — fullwidth forms (U+FF4E etc.) fold to ASCII via NFKD.
      const result = filterLayoutContent({
        name: 'ｎｉｇｇｅｒ',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('blocks slur with single combining accent', () => {
      // 'ńigger' — single combining acute on n. Single accent should NOT trigger
      // the zalgo pattern (>=5), so we rely on the strip-combining normalization.
      const result = filterLayoutContent({
        name: 'ńigger',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('blocks BOM inside slur', () => {
      const result = filterLayoutContent({
        name: 'ni﻿gger',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('blocks digit substitution (e.g. n1gger)', () => {
      const result = filterLayoutContent({
        name: 'n1gger',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('still passes legitimate text containing confusable chars', () => {
      // e.g. a layout name with a Cyrillic name shouldn't be blocked unless
      // it actually maps to a slur after normalization.
      const result = filterLayoutContent({
        name: 'Алексей drawer',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles undefined label and notes', () => {
      const result = filterLayoutContent({
        name: 'My Layout',
        bins: [{ label: undefined, notes: undefined }],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(true);
    });

    it('is case-insensitive for blocklist', () => {
      const result = filterLayoutContent({
        name: 'NIGGER',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('detects blocklist words with surrounding text', () => {
      const result = filterLayoutContent({
        name: 'This contains faggot in the middle',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });
  });

  // The blocklist matched as a substring, so any word that merely starts with
  // or contains a listed term blocked the whole share.
  describe('maker words that contain a listed term', () => {
    it.each(['Spices', 'Spiced rum', 'Flame retardant tape', 'cp sockets', 'Scunthorpe bolts'])(
      'passes the bin label %s',
      (label) => {
        const result = filterLayoutContent({
          name: 'Kitchen',
          bins: [{ label }],
          categories: [{ name: 'Default' }],
        });

        expect(result).toEqual({ passed: true });
      }
    );

    it('passes a category and a layout name made of such words', () => {
      const result = filterLayoutContent({
        name: 'Vandyke brown paints',
        bins: [],
        categories: [{ name: 'Spices' }],
      });

      expect(result.passed).toBe(true);
    });
  });

  // `on\w+=` was written for inline handlers, but it matched "on" anywhere in
  // a word, so ordinary key=value notes read as an event attribute.
  describe('key=value notes', () => {
    it.each([
      'Connector=JST',
      'Font=Arial',
      'Content = M3 screws',
      'Monitor=27in',
      'One=M3, Two=M4',
    ])('passes the note %s', (notes) => {
      const result = filterLayoutContent({
        name: 'Electronics',
        bins: [{ label: 'Cables', notes }],
        categories: [{ name: 'Default' }],
      });

      expect(result).toEqual({ passed: true });
    });
  });

  describe('the field a block names', () => {
    const clean = { name: 'My Layout', bins: [], categories: [{ name: 'Default' }] };

    it.each([
      ['layoutName', { ...clean, name: 'kys' }],
      ['category', { ...clean, categories: [{ name: 'kys' }] }],
      ['binLabel', { ...clean, bins: [{ label: 'kys' }] }],
      ['binNotes', { ...clean, bins: [{ label: 'Tools', notes: 'kys' }] }],
      ['binItem', { ...clean, bins: [{ items: [{ name: 'Screws', note: 'kys' }] }] }],
      ['binProperty', { ...clean, bins: [{ customProperties: { kys: 'M3' } }] }],
      ['binProperty', { ...clean, bins: [{ customProperties: { Size: 'kys' } }] }],
    ])('names %s', (field, layout) => {
      const result = filterLayoutContent(layout);

      expect(result.passed).toBe(false);
      expect(result.field).toBe(field);
    });

    it('names no field when the layout passes', () => {
      expect(filterLayoutContent(clean)).toEqual({ passed: true });
    });
  });
});

describe('filterDisplayName', () => {
  it('passes an ordinary name', () => {
    expect(filterDisplayName('Jo Example').passed).toBe(true);
  });

  it('rejects a slur', () => {
    expect(filterDisplayName('retard').passed).toBe(false);
  });

  it.each([
    ['a script tag', '<script>x</script>'],
    ['an inline handler', 'onclick=alert(1)'],
    ['a spaced inline handler', 'onerror =x'],
    ['an uppercase handler', 'ONMOUSEOVER=1'],
    ['a url', 'visit https://spam.example'],
  ])('rejects %s', (_label, text) => {
    expect(filterDisplayName(text).passed).toBe(false);
  });

  // The inline-handler pattern used unbounded quantifiers and backtracked
  // quadratically on 'ononon…'. Callers must be able to hand it hostile text
  // without burning the request budget.
  it('does not blow up on input crafted against the handler pattern', () => {
    const started = performance.now();
    filterDisplayName('on'.repeat(100_000));
    expect(performance.now() - started).toBeLessThan(150);
  });
});

// Designs riding along with a shared layout carry user-authored names and
// engraved text shown to whoever opens the link; without this they were a way
// around layout moderation entirely.
describe('filterSharedDesignsContent', () => {
  const design = (over: Record<string, unknown> = {}) => ({
    name: 'Socket Tray',
    params: { width: 2, depth: 2 },
    ...over,
  });

  it('passes clean designs', () => {
    expect(filterSharedDesignsContent([design()]).passed).toBe(true);
  });

  it('passes an empty set', () => {
    expect(filterSharedDesignsContent([]).passed).toBe(true);
  });

  it('blocks an offensive design name', () => {
    const result = filterSharedDesignsContent([design({ name: 'retard box' })]);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Design name');
  });

  it('blocks offensive text engraved on a wall', () => {
    const result = filterSharedDesignsContent([
      design({ params: { surfaceText: { front: { text: 'kill yourself' } } } }),
    ]);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('text');
  });

  it.each([
    ['name', design({ name: 'kys' })],
    ['engraved text', design({ params: { surfaceText: { lidText: 'kys' } } })],
  ])('names the linked design as the field when its %s is blocked', (_part, blocked) => {
    expect(filterSharedDesignsContent([design(), blocked]).field).toBe('linkedDesign');
  });

  it('blocks an offensive cutout label nested in an array', () => {
    const result = filterSharedDesignsContent([
      design({ params: { cutouts: [{ id: 'c1', label: 'faggot' }] } }),
    ]);

    expect(result.passed).toBe(false);
  });

  it('blocks a harmful pattern in engraved text', () => {
    const result = filterSharedDesignsContent([
      design({ params: { surfaceText: { front: { text: 'https://evil.example' } } } }),
    ]);

    expect(result.passed).toBe(false);
  });

  // Enum values, hex colours and font names share the params tree; running
  // them through the blocklist would be noise, so only text-bearing keys count.
  it('ignores non-text string values', () => {
    const result = filterSharedDesignsContent([
      design({ params: { style: 'solid', featureColors: { body: '#aabbcc' }, fontFamily: 'kys' } }),
    ]);

    expect(result.passed).toBe(true);
  });

  it('tolerates params that are not an object', () => {
    expect(filterSharedDesignsContent([design({ params: null })]).passed).toBe(true);
    expect(filterSharedDesignsContent([design({ params: 'nonsense' })]).passed).toBe(true);
  });

  it('terminates on deeply nested params', () => {
    let deep: Record<string, unknown> = { text: 'clean' };
    for (let i = 0; i < 200; i++) deep = { nested: deep };

    expect(filterSharedDesignsContent([design({ params: deep })]).passed).toBe(true);
  });

  // These are all accepted and stored by the designer validators and engraved
  // into the geometry the recipient sees, but the collector only looked at
  // {text,label,name} and never descended into arrays of strings, so every one
  // of them reached the public gallery unmoderated.
  describe('engraved text fields the collector used to miss', () => {
    it('blocks an offensive compartment caption', () => {
      const result = filterSharedDesignsContent([
        design({ params: { compartments: { compartmentTexts: ['screws', 'kys'] } } }),
      ]);

      expect(result.passed).toBe(false);
    });

    it('blocks an offensive label row caption', () => {
      const result = filterSharedDesignsContent([
        design({ params: { label: { rowTexts: ['bolts', 'faggot'] } } }),
      ]);

      expect(result.passed).toBe(false);
    });

    it('blocks offensive lid text', () => {
      const result = filterSharedDesignsContent([
        design({ params: { surfaceText: { lidText: 'kill yourself' } } }),
      ]);

      expect(result.passed).toBe(false);
    });

    it.each(['front', 'back', 'left', 'right'])('blocks offensive %s wall text', (side) => {
      const result = filterSharedDesignsContent([
        design({ params: { surfaceText: { walls: { [side]: 'kys' } } } }),
      ]);

      expect(result.passed).toBe(false);
    });

    it('blocks a phishing URL engraved into a compartment', () => {
      const result = filterSharedDesignsContent([
        design({ params: { compartments: { compartmentTexts: ['https://evil.example'] } } }),
      ]);

      expect(result.passed).toBe(false);
    });

    // The stash entry's text field is deliberately named `label` so the
    // object-property branch of collectDesignText picks it up via the
    // existing TEXT_BEARING_KEYS entry. Renaming the field would ship an
    // unmoderated public surface — this test is the tripwire.
    it('blocks an offensive bento stash label', () => {
      const result = filterSharedDesignsContent([
        design({ params: { compartments: { stash: [{ w: 2, h: 1, label: 'kys' }] } } }),
      ]);

      expect(result.passed).toBe(false);
    });

    it('passes a clean bento stash label', () => {
      const result = filterSharedDesignsContent([
        design({ params: { compartments: { stash: [{ w: 2, h: 1, label: 'M3 screws' }] } } }),
      ]);

      expect(result.passed).toBe(true);
    });

    it('still passes the same fields with clean text', () => {
      const result = filterSharedDesignsContent([
        design({
          params: {
            compartments: { compartmentTexts: ['M3 screws', 'M4 screws'] },
            label: { rowTexts: ['Top row'] },
            surfaceText: { lidText: 'Workshop', walls: { front: 'Hardware' } },
          },
        }),
      ]);

      expect(result.passed).toBe(true);
    });

    // The wall-cutout config shares the front/back/left/right key names but
    // holds objects, not prose — it must not start tripping the blocklist.
    it('leaves the wall cutout config alone', () => {
      const result = filterSharedDesignsContent([
        design({
          params: { walls: { enabled: true, shape: 'kys', front: { width: 10, depth: 5 } } },
        }),
      ]);

      expect(result.passed).toBe(true);
    });
  });
});

describe('checkText', () => {
  it('passes ordinary free-text descriptions', () => {
    const result = checkText('Holds 25 assorted M3 screws.\nPrint with 3 walls.');
    expect(result.passed).toBe(true);
  });

  it('rejects blocklisted terms', () => {
    expect(checkText('kys').passed).toBe(false);
  });

  it('rejects harmful patterns like URLs', () => {
    expect(checkText('visit https://spam.example now').passed).toBe(false);
  });

  it('is the same gate filterDisplayName applies', () => {
    const sample = ['clean text', 'kys', '<script>alert(1)</script>'];
    for (const text of sample) {
      expect(checkText(text).passed).toBe(filterDisplayName(text).passed);
    }
  });

  // Dropping the scheme was enough to get a link past the https? rule.
  it.each([
    'www.example.com',
    'Get the STL at WWW.Example.org/thing/42',
    'mirror:www.spam-site.net',
  ])('rejects the scheme-less link %s', (text) => {
    expect(checkText(text).passed).toBe(false);
  });

  it.each(['3.5mm drill', 'Firmware v2.1', 'bracket.stl', 'README.md', 'e.g. M3 screws', 'www.'])(
    'passes dotted text that is not a link: %s',
    (text) => {
      expect(checkText(text).passed).toBe(true);
    }
  );

  // Matching whole words must not open a gap for the forms the substring
  // match caught: inflections, and the listed word glued to digits or symbols.
  it.each([
    'spic',
    'Spics',
    'retarded',
    'Retards',
    'niggers',
    'n1ggers',
    'faggots',
    'faggot2',
    '#retard',
    'some_cunt_here',
  ])('still rejects %s', (text) => {
    expect(checkText(text).passed).toBe(false);
  });

  it.each(['kill-yourself', 'KILL   YOURSELF', 'kill\nyourself'])(
    'rejects a listed phrase split by punctuation or extra space: %j',
    (text) => {
      expect(checkText(text).passed).toBe(false);
    }
  );

  // The long slurs and the phrases match with every separator removed, so a
  // compound or a joined phrase does not get past the whole-word match.
  it.each([
    'niggerish',
    'dumbnigger',
    'n.i.g.g.e.r',
    'faggotry',
    'bigfaggot',
    'killyourself',
    'gokillyourself',
    'kill_your_self',
    'childporn',
  ])('rejects %s, which holds a term matched anywhere', (text) => {
    expect(checkText(text).passed).toBe(false);
  });

  it.each(['rеtard', 'ｃｕｎｔ', 'k​ys', 'SP1C'])(
    'rejects a disguised whole-word term: %j',
    (text) => {
      expect(checkText(text).passed).toBe(false);
    }
  );

  // Each of these terms sits inside innocent text, so only the whole word
  // blocks. "Aucun trou" is one of the app's own French strings.
  it.each([
    ['cuntface', 'cunt'],
    ['Aucun trou', 'cunt'],
    ['twatwaffle', 'twat'],
    ['niggardly', 'nigga'],
    ['Log chinking', 'chink'],
  ])('passes %s, because %s matches whole words only', (text) => {
    expect(checkText(text).passed).toBe(true);
  });

  // An attribute name in HTML starts after whitespace, "/" or a quote, so a
  // word-start anchor costs nothing against real markup.
  it.each([
    '<img src=x onerror=alert(1)>',
    '<svg/onload=alert(1)>',
    '<a href="#"onmouseover="alert(1)">x</a>',
    '" autofocus onfocus=alert(1) x="',
    'document.body.onload=steal',
  ])('rejects the event attribute in %s', (text) => {
    expect(checkText(text).passed).toBe(false);
  });
});

/**
 * The walk stops at MAX_TEXT_FIELDS. Returning "passed" on a truncated
 * collection would report success on text the filter never read, so an
 * attacker could pad the first 500 entries with benign strings and park the
 * blocked content past the cutoff.
 */
describe('filterDesignParamsContent — collection cap', () => {
  const padded = (count: number, tail: string[] = []) => ({
    compartments: { compartmentTexts: [...Array.from({ length: count }, () => 'ok'), ...tail] },
  });

  it('passes a design comfortably under the cap', () => {
    expect(filterDesignParamsContent(padded(100)).passed).toBe(true);
  });

  it('fails closed rather than passing a truncated walk', () => {
    const result = filterDesignParamsContent(padded(600));
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('too many text fields');
  });

  it('does not let padding hide blocked content past the cutoff', () => {
    expect(filterDesignParamsContent(padded(600, ['kys'])).passed).toBe(false);
  });

  it('still reports a blocked string that sits within the cap', () => {
    const result = filterDesignParamsContent(padded(10, ['kys']));
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('prohibited');
  });

  it('applies through the shared-designs entry point too', () => {
    const result = filterSharedDesignsContent([{ name: 'Padded', params: padded(600, ['kys']) }]);
    expect(result.passed).toBe(false);
  });
});
