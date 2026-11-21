import { describe, expect, it } from 'vitest';
import { sidebar } from '../apps/docs/.vitepress/navigation';
import { drawerLink } from '../apps/docs/.vitepress/theme/drawerPlan';
import { resolveUiLabel } from '../apps/docs/.vitepress/uiLabels';
import {
  DOCS_URL,
  docsContext,
  llmsFull,
  llmsIndex,
  markdownUrl,
  pageMarkdown,
  pageUrl,
  sidebarLinks,
} from './build-docs-llms';
import { readDocPages, readManifest } from './check-user-docs';
import type { DocPage, MediaEntry } from './check-user-docs';

const KEY = 'drawerDims.suggestionUse';

function label(key: string): string {
  const result = resolveUiLabel(key);
  if (!result.ok) throw new Error(result.reason);
  return result.text;
}

function page(file: string, body: string): DocPage {
  return { file: `apps/docs/${file}`, data: { title: 'Fill gaps', description: 'D' }, body };
}

const media: Record<string, MediaEntry> = {
  shot: { kind: 'still', width: 10, height: 10 },
  clip: { kind: 'clip', width: 10, height: 10 },
};

function convert(body: string, file = 'layouts/fill.md'): string {
  const p = page(file, body);
  return pageMarkdown(p, docsContext([p], media));
}

function outsideFences(markdown: string): string {
  return markdown.replace(/^```[\s\S]*?^```/gm, '');
}

describe('pageMarkdown', () => {
  it('writes a label in bold, and keeps a label plain inside bold text', () => {
    const text = label(KEY);
    expect(convert(`# A\n\nClick <Ui k="${KEY}" /> or **<Ui k="${KEY}" />.**`)).toBe(
      `# A\n\nClick **${text}** or **${text}.**\n`
    );
  });

  it('fails on a label key that en.ts does not have', () => {
    expect(() => convert('<Ui k="no.such.key" />')).toThrow(/unknown i18n key/);
  });

  it('writes a captured picture or clip as text, and drops one that is not captured', () => {
    const out = convert(
      [
        '# A',
        '',
        '<Screenshot id="shot" alt="A grid." spec="s" />',
        '',
        '<Screenshot id="clip" alt="Drawing a bin." spec="s" />',
        '',
        '<Screenshot id="later" alt="Not yet." spec="s" />',
        '',
        'End.',
      ].join('\n')
    );
    expect(out).toBe('# A\n\n*Picture: A grid.*\n\n*Video: Drawing a bin.*\n\nEnd.\n');
  });

  it('escapes asterisks and backslashes in alt text', () => {
    expect(convert('# A\n\n<Screenshot id="shot" alt="a*b\\c" spec="s" />')).toBe(
      '# A\n\n*Picture: a\\*b\\\\c*\n'
    );
  });

  it('makes every docs link absolute and keeps its heading', () => {
    const out = convert(
      '# A\n\n[a](./other) [b](../printing/x#step-1) [c](#here) [d](/reference/shortcuts) ' +
        '[e](https://example.com/x)'
    );
    expect(out).toContain(`[a](${DOCS_URL}/layouts/other)`);
    expect(out).toContain(`[b](${DOCS_URL}/printing/x#step-1)`);
    expect(out).toContain(`[c](${DOCS_URL}/layouts/fill#here)`);
    expect(out).toContain(`[d](${DOCS_URL}/reference/shortcuts)`);
    expect(out).toContain('[e](https://example.com/x)');
  });

  it('turns a ::: block into a quote with its title', () => {
    const text = label(KEY);
    expect(convert(`# A\n\n::: tip\nOne\n\n- two\n:::\n\nAfter`)).toBe(
      '# A\n\n> **Tip**\n>\n> One\n>\n> - two\n\nAfter\n'
    );
    expect(convert(`# A\n\n::: warning Before <Ui k="${KEY}" />\nOne\n:::`)).toBe(
      `# A\n\n> **Before ${text}**\n>\n> One\n`
    );
  });

  it('leaves code fences as they are', () => {
    const fence = '```\n<Ui k="no.such.key" />\n:::\n```';
    expect(convert(`# A\n\n${fence}`)).toBe(`# A\n\n${fence}\n`);
  });

  it('links Plan this drawer to the same URL as the button on the page', () => {
    const url = drawerLink({ widthMm: 345, depthMm: 260, heightMm: 40 }, { name: 'Screw drawer' });
    expect(
      convert('# A\n\n<PlanDrawerButton width="345" depth="260" height="40" name="Screw drawer" />')
    ).toContain(`[Plan this drawer in the app](${url})`);
  });

  it('fails on a component that has no Markdown form', () => {
    expect(() => convert('# A\n\n<NewWidget />')).toThrow(/no Markdown form for <NewWidget>/);
  });

  it('adds the title as a heading when the page has none', () => {
    expect(convert('Text only.')).toBe('# Fill gaps\n\nText only.\n');
  });
});

describe('the real docs', () => {
  const ctx = docsContext(readDocPages(), readManifest());
  const full = llmsFull(ctx);

  it('converts every page, with no tag or ::: block left', () => {
    for (const p of ctx.pages.values()) {
      const out = outsideFences(pageMarkdown(p, ctx));
      expect(out, p.file).not.toMatch(/<[A-Z]|^:::/m);
    }
  });

  it('links only to docs pages that exist', () => {
    const served = new Set(
      [...ctx.pages.keys()].flatMap((link) => [pageUrl(link), markdownUrl(link)])
    );
    const linked = [...full.matchAll(/https:\/\/gridfinitylayouttool\.com\/docs[^\s)#]*/g)].map(
      ([url]) => url
    );
    expect(linked.length).toBeGreaterThan(100);
    expect(linked.filter((url) => !served.has(url))).toEqual([]);
  });

  it('lists every sidebar page in llms.txt once, in sidebar order', () => {
    const listed = [...llmsIndex(ctx).matchAll(/\]\((https:[^)]+\.md)\)/g)].map(([, url]) => url);
    expect(listed).toEqual(sidebarLinks(sidebar).map(markdownUrl));
    expect(listed).toHaveLength(ctx.pages.size);
  });

  it('puts every page in llms-full.txt', () => {
    expect(full.match(/^Source: /gm)).toHaveLength(ctx.pages.size);
  });
});
