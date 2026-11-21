import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sidebar } from '../apps/docs/.vitepress/navigation';
import { resolveUiLabel } from '../apps/docs/.vitepress/uiLabels';
import { corpusSchema } from '../api/lib/docsAsk/corpus';
import { pageSections } from '../api/lib/docsAsk/search';
import { docsContext, pageMarkdown, sidebarLinks } from './build-docs-llms';
import { readDocPages, readManifest } from './check-user-docs';
import type { DocPage, MediaEntry } from './check-user-docs';
import { askCorpus, askLabels } from './docsAskCorpus';

const KEY = 'drawerDims.suggestionUse';
const media: Record<string, MediaEntry> = { shot: { kind: 'still', width: 10, height: 10 } };

function label(key: string): string {
  const result = resolveUiLabel(key);
  if (!result.ok) throw new Error(result.reason);
  return result.text;
}

function convert(body: string): string {
  const page: DocPage = { file: 'apps/docs/layouts/fill.md', data: { title: 'Fill' }, body };
  return pageMarkdown(page, docsContext([page], media, 'ask'));
}

describe('the ask flavor', () => {
  it('writes labels and captures as panel markers', () => {
    expect(
      convert(
        `# A\n\nClick **<Ui k="${KEY}" />.**\n\n<Screenshot id="shot" alt="A grid." spec="s" />`
      )
    ).toBe(`# A {#a}\n\nClick **[[ui:${label(KEY)}]].**\n\n[[capture:shot]] *Picture: A grid.*\n`);
  });

  it('puts the anchor on each heading, with a number on a repeat', () => {
    expect(convert('# A\n\n## Next steps\n\n## Next steps')).toBe(
      '# A {#a}\n\n## Next steps {#next-steps}\n\n## Next steps {#next-steps-1}\n'
    );
  });
});

describe('pageSections', () => {
  it('cuts at H2 and H3, and keeps the lead as a section of the page', () => {
    const markdown = [
      '# Fill {#fill}',
      'Lead with [[ui:Fit grid]].',
      '## One {#one}',
      '[[capture:shot]] *Picture: x*',
      'Text one.',
      '### Two {#two}',
      'Text two.',
      '## Empty {#empty}',
    ].join('\n');
    expect(pageSections('/l', 'Fill', markdown)).toEqual([
      { link: '/l', page: 'Fill', heading: '', anchor: '', text: 'Lead with Fit grid.' },
      { link: '/l', page: 'Fill', heading: 'One', anchor: 'one', text: '*Picture: x*\nText one.' },
      { link: '/l', page: 'Fill', heading: 'Two', anchor: 'two', text: 'Text two.' },
    ]);
  });
});

describe('the Ask AI corpus of the real docs', () => {
  const ctx = docsContext(readDocPages(), readManifest(), 'ask');
  const corpus = askCorpus(ctx);

  it('parses with the schema that the endpoint loads it with', () => {
    expect(corpusSchema.parse(corpus)).toEqual(corpus);
  });

  it('holds every sidebar page, and the map names each one', () => {
    const links = sidebarLinks(sidebar);
    expect(Object.keys(corpus.pages)).toEqual(links);
    for (const link of links) expect(corpus.map).toContain(`- ${link} | `);
    expect(corpus.map).not.toContain('Next steps #');
  });

  it('marks only captures that exist and labels that resolve', () => {
    const english = new Set(Object.values(askLabels(corpus, 'src/i18n/locales').en));
    for (const [link, page] of Object.entries(corpus.pages)) {
      for (const [, id] of page.markdown.matchAll(/\[\[capture:([^\]]+)\]\]/g))
        expect(readManifest()[id], `${link}: ${id}`).toBeDefined();
      for (const [, text] of page.markdown.matchAll(/\[\[ui:([^\]]+)\]\]/g))
        expect(english.has(text), `${link}: ${text}`).toBe(true);
    }
  });

  it('gives every locale a table of the labels the pages use', () => {
    const tables = askLabels(corpus, path.join('src', 'i18n', 'locales'));
    const keys = new Set(Object.values(corpus.pages).flatMap((page) => page.labels));
    expect(Object.keys(tables.en).sort()).toEqual([...keys].sort());
    expect(Object.keys(tables)).toContain('de');
    for (const table of Object.values(tables))
      for (const key of Object.keys(table)) expect(keys.has(key)).toBe(true);
  });

  it('is the same on a second build', () => {
    expect(askCorpus(ctx).version).toBe(corpus.version);
  });
});
