import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  checkAppLink,
  checkDocLinks,
  checkFeatureCoverage,
  checkMedia,
  checkPage,
  checkPrDocs,
  checkScreenshotIds,
  checkSidebar,
  collectProblems,
  docsForStagedSources,
  docsNoneReason,
  headingAnchors,
  mediaFiles,
  prDocsFailure,
  prTitleType,
  sliceNames,
} from './check-user-docs';
import type { DocPage, PullRequest } from './check-user-docs';

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
      '## Top\n[a](/designer/walls) [b](./designer/walls) [c](designer/walls) [d](#top) [e](https://x.dev/y)',
      { prev: { link: 'designer/walls' } }
    );
    expect(checkDocLinks([root, page('apps/docs/designer/walls.md', '')], exists)).toEqual([
      'apps/docs/index.md: link "./designer/walls" must start with "/" on the docs root',
      'apps/docs/index.md: link "designer/walls" must start with "/" on the docs root',
      'apps/docs/index.md: link "designer/walls" must start with "/" on the docs root',
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

describe('sliceNames', () => {
  it('lists the folders under src/features, without dot-folders or files', () => {
    const entry = (name: string, dir: boolean): { name: string; isDirectory: () => boolean } => ({
      name,
      isDirectory: () => dir,
    });
    expect(
      sliceNames([
        entry('walls', true),
        entry('.greptile', true),
        entry('README.md', false),
        entry('labs', true),
      ])
    ).toEqual(['labs', 'walls']);
  });
});

describe('checkFeatureCoverage', () => {
  const allowlist = 'scripts/user-docs-coverage-allowlist.json';
  const pages = [
    page('apps/docs/walls.md', '', { sources: ['src/features/walls/'] }),
    page('apps/docs/lids.md', '', { sources: ['src/features/lids'] }),
    page('apps/docs/labs.md', '', { sources: ['src/a.ts', 'src/features/labs/flags.ts'] }),
  ];

  it('accepts a slice cited as a folder, with or without a slash, or by a file in it', () => {
    expect(checkFeatureCoverage(['walls', 'lids', 'labs'], pages, {})).toEqual([]);
  });

  it('names an uncited slice and both ways to fix it', () => {
    expect(checkFeatureCoverage(['walls', 'scan'], pages, {})).toEqual([
      'src/features/scan: no docs page cites this feature. Add the folder, or a file in it, to the "sources" of the page that describes it, or list it in scripts/user-docs-coverage-allowlist.json with a one-line reason',
    ]);
  });

  it('does not count a citation of another slice whose name starts the same', () => {
    const designer = [page('apps/docs/d.md', '', { sources: ['src/features/bin-designer/'] })];
    expect(checkFeatureCoverage(['bin'], designer, {})).toEqual([
      expect.stringMatching(/^src\/features\/bin: no docs page cites this feature/),
    ]);
  });

  it('accepts an allowlisted slice with a reason', () => {
    expect(checkFeatureCoverage(['walls', 'scan'], pages, { scan: 'No UI of its own.' })).toEqual(
      []
    );
  });

  it('reports an allowlist entry that is cited, has no reason, or names no slice', () => {
    expect(
      checkFeatureCoverage(['walls', 'scan', 'tray'], pages, {
        scan: ' ',
        tray: 42,
        gone: 'Removed.',
        walls: 'Old.',
      })
    ).toEqual([
      `${allowlist}: "walls" is cited by apps/docs/walls.md, so remove it from the allowlist`,
      `${allowlist}: "scan" needs a one-line reason`,
      `${allowlist}: "tray" needs a one-line reason`,
      `${allowlist}: "gone" is not a folder in src/features`,
    ]);
  });
});

describe('prTitleType', () => {
  it('reads the conventional-commit type, with a scope or a breaking mark', () => {
    expect(prTitleType('feat: add lids')).toBe('feat');
    expect(prTitleType('feat(designer): add lids')).toBe('feat');
    expect(prTitleType('feat!: drop v1 files')).toBe('feat');
    expect(prTitleType('feat(api)!: drop v1 files')).toBe('feat');
    expect(prTitleType('fix(grid): snap to half cells')).toBe('fix');
    expect(prTitleType('featured: x')).toBe('featured');
    expect(prTitleType('Add lids')).toBeNull();
  });
});

describe('docsNoneReason', () => {
  it('reads the reason from a line that starts with "Docs: none"', () => {
    expect(docsNoneReason('## Summary\n\nDocs: none, the change does not show in the app')).toBe(
      'the change does not show in the app'
    );
    expect(docsNoneReason('Text\r\nDocs: none - internal refactor\r\nMore')).toBe(
      'internal refactor'
    );
    expect(docsNoneReason('Docs: none: telemetry only')).toBe('telemetry only');
  });

  it('needs a reason, at the start of a line', () => {
    expect(docsNoneReason('Docs: none')).toBeNull();
    expect(docsNoneReason('Docs: none.\r\nDocs: none -')).toBeNull();
    expect(docsNoneReason('We wrote Docs: none, internal')).toBeNull();
    expect(docsNoneReason('Docs: nonexistent page')).toBeNull();
    expect(docsNoneReason('')).toBeNull();
  });

  it('does not read the line in the PR template as an escape', () => {
    const template = readFileSync(
      join(import.meta.dirname, '../.github/pull_request_template.md'),
      'utf8'
    );
    expect(template).toContain('`Docs: none`');
    expect(docsNoneReason(template)).toBeNull();
  });
});

describe('checkPrDocs', () => {
  const pages = [page('apps/docs/walls.md', '', { sources: ['src/features/walls/'] })];
  const pr = (over: Partial<PullRequest>): PullRequest => ({
    title: 'feat(walls): add label slots',
    body: '',
    headRef: 'feat/label-slots',
    changed: ['src/features/walls/Wall.tsx'],
    ...over,
  });

  it('fails a feat PR that changes no docs, and names the pages its files touch', () => {
    expect(checkPrDocs(pr({}), pages)).toEqual({
      pass: false,
      pages: [{ page: 'apps/docs/walls.md', source: 'src/features/walls/Wall.tsx' }],
    });
    expect(
      checkPrDocs(pr({ title: 'feat!: drop old walls', changed: ['src/x.ts'] }), pages)
    ).toEqual({ pass: false, pages: [] });
  });

  it('passes a feat PR that changes any file under apps/docs', () => {
    expect(
      checkPrDocs(pr({ changed: ['src/features/walls/Wall.tsx', 'apps/docs/walls.md'] }), pages)
    ).toEqual({ pass: true, reason: 'changes apps/docs/' });
    expect(checkPrDocs(pr({ changed: ['apps/docs/media/walls.json'] }), pages).pass).toBe(true);
  });

  it('does not count a path that only looks like the docs', () => {
    expect(checkPrDocs(pr({ changed: ['apps/docs-old/x.md', 'docs/walls.md'] }), pages).pass).toBe(
      false
    );
  });

  it('passes a feat PR whose body has "Docs: none" and a reason, and only then', () => {
    expect(
      checkPrDocs(pr({ body: 'Summary\r\nDocs: none, slots are behind a Labs flag' }), pages)
    ).toEqual({ pass: true, reason: 'Docs: none, slots are behind a Labs flag' });
    expect(checkPrDocs(pr({ body: 'Docs: none' }), pages).pass).toBe(false);
  });

  it('passes a PR of any other type without a docs change', () => {
    expect(checkPrDocs(pr({ title: 'fix(walls): keep slots' }), pages)).toEqual({
      pass: true,
      reason: 'title type "fix" is not feat',
    });
    expect(checkPrDocs(pr({ title: 'Add label slots' }), pages)).toEqual({
      pass: true,
      reason: 'title type "none" is not feat',
    });
    for (const title of ['refactor: x', 'chore: x', 'docs: x', 'perf: x', 'revert: feat: x'])
      expect(checkPrDocs(pr({ title }), pages).pass).toBe(true);
  });

  it('passes a release-please PR', () => {
    expect(checkPrDocs(pr({ headRef: 'release-please--branches--main' }), pages)).toEqual({
      pass: true,
      reason: 'release PR',
    });
  });
});

describe('prDocsFailure', () => {
  it('names the pages to update and the escape line', () => {
    const lines = prDocsFailure([
      { page: 'apps/docs/walls.md', source: 'src/features/walls/Wall.tsx' },
    ]);
    expect(lines).toContain('    apps/docs/walls.md  (source: src/features/walls/Wall.tsx)');
    expect(lines).toContain('    Docs: none, <the reason>');
  });

  it('says so when no page cites the changed files', () => {
    expect(prDocsFailure([]).join('\n')).toContain('No docs page cites the files');
  });
});
