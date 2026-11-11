import { describe, it, expect } from 'vitest';
import {
  checkAppLink,
  checkDocLinks,
  checkMedia,
  checkPage,
  checkScreenshotIds,
  checkSidebar,
  collectProblems,
  docsForStagedSources,
  headingAnchors,
  mediaFiles,
} from './check-user-docs';
import type { DocPage } from './check-user-docs';

function page(file: string, body: string, data: Record<string, unknown> = {}): DocPage {
  return {
    file,
    body,
    data: { title: 'T', description: 'D', sources: ['src/a.ts'], ...data },
  };
}

describe('user docs', () => {
  it('pass every drift guard', () => {
    expect(collectProblems()).toEqual([]);
  });
});

describe('checkPage', () => {
  const exists = (rel: string): boolean => rel === 'src/a.ts';

  it('accepts a known label and an existing source', () => {
    expect(checkPage(page('apps/docs/x.md', '<Ui k="toolSwitcher.layout" />'), exists)).toEqual([]);
  });

  it('rejects an unknown label key', () => {
    const problems = checkPage(page('apps/docs/x.md', '<Ui k="no.such.key" />'), exists);
    expect(problems).toEqual(['apps/docs/x.md: unknown i18n key "no.such.key"']);
  });

  it('rejects a label with a placeholder', () => {
    const problems = checkPage(page('apps/docs/x.md', '<Ui k="layers.binCount_other" />'), exists);
    expect(problems[0]).toContain('{placeholder}');
  });

  it('rejects a missing source and missing frontmatter', () => {
    const problems = checkPage(
      page('apps/docs/x.md', '', { title: undefined, sources: ['src/gone.ts'] }),
      exists
    );
    expect(problems).toEqual([
      'apps/docs/x.md: frontmatter needs a "title"',
      'apps/docs/x.md: source "src/gone.ts" does not exist',
    ]);
  });

  it('asks every page for a title, a description and sources, the docs root too', () => {
    expect(checkPage(page('apps/docs/x.md', '', { sources: [] }), exists)[0]).toContain('sources');
    expect(checkPage({ file: 'apps/docs/index.md', body: '', data: {} }, exists)).toEqual([
      'apps/docs/index.md: frontmatter needs a "title"',
      'apps/docs/index.md: frontmatter needs a "description"',
      'apps/docs/index.md: frontmatter needs "sources": the code paths this page describes',
    ]);
  });
});

describe('checkAppLink', () => {
  const files = new Set([
    'content/guide.md',
    'content/schema.md',
    'content/de/guide.md',
    'public/schema/layout.schema.json',
  ]);
  const exists = (rel: string): boolean => files.has(rel);
  const link = (route: string): string | null =>
    checkAppLink(`https://gridfinitylayouttool.com${route}`, exists);

  it('accepts app routes, content pages, localized content pages and public files', () => {
    expect(link('/')).toBeNull();
    expect(link('/designer')).toBeNull();
    expect(link('/guide')).toBeNull();
    expect(link('/schema')).toBeNull();
    expect(link('/de/guide')).toBeNull();
    expect(link('/schema/layout.schema.json')).toBeNull();
  });

  it('rejects unknown pages, unknown locales and absolute links into the docs', () => {
    expect(link('/nope')).toContain('no such page');
    expect(link('/fr/guide')).toContain('no such page');
    expect(link('/xx/guide')).toContain('no such page');
    expect(link('/docs/faq')).toContain('relative link');
  });
});

describe('checkSidebar', () => {
  it('reports pages without a sidebar entry and entries without a page', () => {
    expect(
      checkSidebar(
        ['apps/docs/index.md', 'apps/docs/a/b.md', 'apps/docs/a/c.md'],
        ['/', '/a/b', '/a/d']
      )
    ).toEqual(['sidebar: "/a/d" has no page', 'sidebar: page "/a/c" is not in the sidebar']);
    expect(checkSidebar(['apps/docs/index.md'], [])).toEqual([
      'sidebar: page "/index" is not in the sidebar',
    ]);
  });
});

describe('checkScreenshotIds', () => {
  it('reports duplicate and badly formed ids', () => {
    const problems = checkScreenshotIds([
      page('apps/docs/a.md', '<Screenshot id="one" alt="" spec="" />'),
      page('apps/docs/b.md', '<Screenshot id="one" alt="" spec="" /><Screenshot id="Two" />'),
    ]);
    expect(problems).toEqual([
      'apps/docs/b.md: screenshot id "one" is also used in apps/docs/a.md',
      'apps/docs/b.md: screenshot id "Two" must be kebab-case',
    ]);
  });
});

describe('docsForStagedSources', () => {
  const pages = [
    page('apps/docs/walls.md', '', { sources: ['src/features/walls/'] }),
    page('apps/docs/lids.md', '', { sources: ['src/lid.ts'] }),
  ];

  it('names a page whose source file or folder is staged', () => {
    expect(docsForStagedSources(pages, ['src/features/walls/Wall.tsx', 'src/lid.ts'])).toEqual([
      { page: 'apps/docs/walls.md', source: 'src/features/walls/Wall.tsx' },
      { page: 'apps/docs/lids.md', source: 'src/lid.ts' },
    ]);
  });

  it('stays quiet when the page is staged too', () => {
    expect(docsForStagedSources(pages, ['src/lid.ts', 'apps/docs/lids.md'])).toEqual([]);
  });
});

describe('headingAnchors', () => {
  it('slugs headings the way VitePress does, without <Ui> labels', () => {
    const body = [
      '# Walls',
      '## Add label slots',
      '## Turn on <Ui k="toolSwitcher.layout" /> mode',
      '## Add label slots',
      '```',
      '## not a heading',
      '```',
      '## Use `R` to rotate',
      '## Custom {#my-id}',
      '## Paths like C:\\tools',
    ].join('\n');
    expect([...headingAnchors(body)]).toEqual([
      'walls',
      'add-label-slots',
      'turn-on-mode',
      'add-label-slots-1',
      'use-r-to-rotate',
      'my-id',
      'paths-like-c-tools',
    ]);
  });
});

describe('checkDocLinks', () => {
  const files = new Set(['apps/docs/public/screenshots/a.png', 'apps/docs/designer/b.png']);
  const exists = (rel: string): boolean => files.has(rel);

  it('accepts links to real pages, headings and files, and reports the rest', () => {
    const pages = [
      page(
        'apps/docs/designer/walls.md',
        '## Add label slots\n[base](./base#magnets) [self](#add-label-slots) ![a](/screenshots/a.png) ![b](./b.png)'
      ),
      page(
        'apps/docs/designer/base.md',
        '## Magnets\n[walls](../designer/walls#nope) [gone](../concepts/gone) ![c](/screenshots/c.png)'
      ),
    ];
    expect(checkDocLinks(pages, exists)).toEqual([
      'apps/docs/designer/base.md: link "../designer/walls#nope" has no heading "#nope"',
      'apps/docs/designer/base.md: link "../concepts/gone" has no page',
      'apps/docs/designer/base.md: link "/screenshots/c.png" has no file apps/docs/public/screenshots/c.png',
    ]);
  });

  it('wants links from the docs root to start with a slash', () => {
    const root = page(
      'apps/docs/index.md',
      '## Top\n[a](/designer/walls) [b](./designer/walls) [c](#top)'
    );
    expect(checkDocLinks([root, page('apps/docs/designer/walls.md', '')], exists)).toEqual([
      'apps/docs/index.md: link "./designer/walls" must start with "/" on the docs root',
    ]);
  });

  it('checks the links in frontmatter, such as prev and next', () => {
    const lids: DocPage = {
      file: 'apps/docs/designer/lids.md',
      body: '',
      data: {
        prev: { text: 'Walls', link: '/designer/walls' },
        next: { text: 'Gone', link: '/designer/gone' },
      },
    };
    expect(checkDocLinks([lids, page('apps/docs/designer/walls.md', '')], exists)).toEqual([
      'apps/docs/designer/lids.md: link "/designer/gone" has no page',
    ]);
  });
});

describe('checkMedia', () => {
  const pages = [page('apps/docs/a.md', '<Screenshot id="a-still" /> <Screenshot id="a-clip" />')];
  const manifest = {
    'a-still': { kind: 'still', width: 400, height: 300 },
    'a-clip': { kind: 'clip', width: 640, height: 480 },
  } as const;
  const all = [
    'a-still.json',
    'a-clip.json',
    ...mediaFiles('a-still', manifest['a-still']),
    ...mediaFiles('a-clip', manifest['a-clip']),
  ];

  it('accepts captures that fill a page and have both themes', () => {
    expect(all).toHaveLength(8);
    expect(checkMedia(pages, manifest, all)).toEqual([]);
  });

  it('reports a missing theme, an orphan entry and a stray file', () => {
    const problems = checkMedia(
      pages,
      { ...manifest, gone: { kind: 'still', width: 1, height: 1 } },
      [
        ...all.filter((f) => f !== 'a-clip.dark.mp4'),
        'gone.json',
        'gone.light.webp',
        'gone.dark.webp',
        'old.png',
      ]
    );
    expect(problems).toEqual([
      'apps/docs/media: a-clip.dark.mp4 is missing for "a-clip"',
      'apps/docs/media/gone.json: fills no <Screenshot> on any page',
      'apps/docs/media: old.png belongs to no capture',
    ]);
  });
});
