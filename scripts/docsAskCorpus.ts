import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sidebar } from '../apps/docs/.vitepress/navigation';
import { UI_TAG, resolveUiLabel } from '../apps/docs/.vitepress/uiLabels';
import { CORPUS_PATH, labelsPath } from '../api/lib/docsAsk/corpus';
import type { AskCorpus, AskLabels } from '../api/lib/docsAsk/corpus';
import { HEADING, plainText } from '../api/lib/docsAsk/search';
import { pageMarkdown, pageUrl, sidebarLinks } from './build-docs-llms';
import type { DocsContext } from './build-docs-llms';

const MAP_DEPTH = 2;
// Link lists that close every page, not topics.
const NAV_HEADINGS = new Set(['Next steps', 'More recipes']);

function textField(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function capabilityMap(
  ctx: DocsContext,
  markdownByLink: ReadonlyMap<string, string>
): string {
  const lines = [
    'Docs page map. Each entry is one page: its link for read_page, its title and what it covers,',
    'then its sections, each with the anchor that links to it.',
  ];
  for (const group of sidebar) {
    const links = sidebarLinks(group.items ?? []).filter((link) => ctx.pages.has(link));
    if (links.length === 0) continue;
    lines.push('', `## ${group.text ?? 'Docs'}`);
    for (const link of links) {
      const page = ctx.pages.get(link);
      const markdown = markdownByLink.get(link);
      if (!page || markdown === undefined) continue;
      const sections = markdown
        .split('\n')
        .map((line) => HEADING.exec(line))
        .filter(
          (m): m is RegExpExecArray => m !== null && m[1].length >= 2 && m[1].length <= MAP_DEPTH
        )
        .filter((m) => !NAV_HEADINGS.has(plainText(m[2])))
        .map((m) => `${plainText(m[2])} #${m[3]}`);
      lines.push(
        `- ${link} | ${textField(page.data, 'title')}: ${textField(page.data, 'description')}`,
        ...(sections.length > 0 ? [`  Sections: ${sections.join('; ')}`] : [])
      );
    }
  }
  return lines.join('\n');
}

export function askCorpus(ctx: DocsContext): AskCorpus {
  if (ctx.flavor !== 'ask') throw new Error('askCorpus needs a docs context with the ask flavor');
  const markdownByLink = new Map(
    [...ctx.pages].map(([link, page]) => [link, pageMarkdown(page, ctx)] as const)
  );
  const pages: AskCorpus['pages'] = {};
  for (const group of sidebar) {
    for (const link of sidebarLinks(group.items ?? [])) {
      const page = ctx.pages.get(link);
      const markdown = markdownByLink.get(link);
      if (!page || markdown === undefined) continue;
      const title = textField(page.data, 'title');
      const labels = [...new Set([...page.body.matchAll(UI_TAG)].map(([, key]) => key))];
      pages[link] = { group: group.text ?? 'Docs', title, url: pageUrl(link), markdown, labels };
    }
  }
  const content = { map: capabilityMap(ctx, markdownByLink), pages };
  const version = createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 12);
  return { version, ...content };
}

export function askLabels(corpus: AskCorpus, localesDir: string): Record<string, AskLabels> {
  const keys = [...new Set(Object.values(corpus.pages).flatMap((page) => page.labels))].sort();
  const english: AskLabels = {};
  for (const key of keys) {
    const label = resolveUiLabel(key);
    if (label.ok) english[key] = label.text;
  }
  const byLocale: Record<string, AskLabels> = { en: english };
  // en.json is generated from en.ts and can be stale; the English table above
  // reads en.ts itself.
  const files = fs
    .readdirSync(localesDir)
    .filter((f) => f.endsWith('.json') && f !== 'en.json')
    .sort();
  for (const file of files) {
    const strings = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8')) as Record<
      string,
      unknown
    >;
    const labels: AskLabels = {};
    for (const key of keys) {
      const value = strings[key];
      if (typeof value === 'string') labels[key] = value;
    }
    byLocale[file.slice(0, -'.json'.length)] = labels;
  }
  return byLocale;
}

export function writeAskFiles(ctx: DocsContext, localesDir: string, outDir: string): AskCorpus {
  const corpus = askCorpus(ctx);
  const write = (rel: string, data: unknown): void => {
    const file = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  };
  write(CORPUS_PATH, corpus);
  for (const [locale, labels] of Object.entries(askLabels(corpus, localesDir))) {
    write(labelsPath(locale), labels);
  }
  return corpus;
}
