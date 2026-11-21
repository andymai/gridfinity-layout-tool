/**
 * Post-build step: write the user docs as Markdown for AI tools, and for readers
 * who paste a page into a chat.
 *
 *   <page>.md        each page, with labels, pictures and widgets as plain text
 *   llms.txt         the pages in sidebar order, in the llmstxt.org format
 *   llms-full.txt    every page in one file
 *
 * Usage: `pnpm run docs:llms`, after docs:build and before copy-docs.ts. It runs
 * with tsconfig.app.json, because the drawer link imports app code through `@`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { APP_URL, sidebar } from '../apps/docs/.vitepress/navigation';
import { drawerLink } from '../apps/docs/.vitepress/theme/drawerPlan';
import { UI_TAG, resolveUiLabel } from '../apps/docs/.vitepress/uiLabels';
import { DOC_LINK, pageLink, readDocPages, readManifest, resolveDocLink } from './check-user-docs';
import type { DocPage, MediaEntry } from './check-user-docs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOCS_BUILD = path.join(ROOT, 'apps', 'docs', '.vitepress', 'dist');
export const DOCS_URL = `${APP_URL}/docs`;
const TITLE = 'Gridfinity Layout Tool Docs';
const HOME = '/index';

type SidebarItem = (typeof sidebar)[number];

export interface DocsContext {
  readonly pages: ReadonlyMap<string, DocPage>;
  readonly media: Readonly<Record<string, MediaEntry>>;
}

export function docsContext(
  pages: readonly DocPage[],
  media: Readonly<Record<string, MediaEntry>>
): DocsContext {
  return { pages: new Map(pages.map((page) => [pageLink(page.file), page])), media };
}

export function pageUrl(link: string): string {
  const rel = link.replace(/(^|\/)index$/, '').replace(/^\//, '');
  return rel ? `${DOCS_URL}/${rel}` : DOCS_URL;
}

export function markdownUrl(link: string): string {
  return `${DOCS_URL}${link}.md`;
}

export function sidebarLinks(items: readonly SidebarItem[]): string[] {
  return items.flatMap((item) => [
    ...(item.link ? [item.link.endsWith('/') ? `${item.link}index` : item.link] : []),
    ...sidebarLinks(item.items ?? []),
  ]);
}

function textField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function pageEntry(link: string, ctx: DocsContext, url: (link: string) => string): string {
  const page = ctx.pages.get(link);
  if (!page) throw new Error(`build-docs-llms: the sidebar links ${link}, which has no page`);
  const title = textField(page.data, 'title') ?? link;
  const description = textField(page.data, 'description');
  return `- [${title}](${url(link)})${description ? `: ${description}` : ''}`;
}

const SCREENSHOT_TAG = /<Screenshot\s[^>]*\/>/g;
const PLAN_DRAWER_TAG = /<PlanDrawerButton\s[^>]*\/>/g;
const BLOCK_COMPONENT = /^\s*<(RecipeCards|DrawerCalculator)\s*\/>\s*$/;
const ANY_COMPONENT = /<([A-Z][A-Za-z]*)\b/;
const ATTRIBUTE = /\b([a-z]+)="([^"]*)"/g;
const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;
const CONTAINER_OPEN = /^:::\s*(tip|info|warning|danger|details)\b\s*(.*)$/;
const CONTAINER_CLOSE = /^:::\s*$/;
const CONTAINER_TITLES: Readonly<Record<string, string>> = {
  tip: 'Tip',
  info: 'Info',
  warning: 'Warning',
  danger: 'Danger',
  details: 'Details',
};

function escapeMarkdown(text: string): string {
  return text.replace(/[\\*]/g, '\\$&');
}

function attributes(tag: string): Map<string, string> {
  return new Map([...tag.matchAll(ATTRIBUTE)].map(([, key, value]) => [key, value]));
}

// A label inside bold text, such as `**<Ui k="x" />.**`, stays plain, or the
// bold markers would pile up.
function uiLabel(key: string, line: string, offset: number, where: string): string {
  const result = resolveUiLabel(key);
  if (!result.ok) throw new Error(`${where}: ${result.reason}`);
  const text = escapeMarkdown(result.text);
  const insideBold = (line.slice(0, offset).match(/\*\*/g) ?? []).length % 2 === 1;
  return insideBold ? text : `**${text}**`;
}

function absoluteLink(self: string, target: string): string {
  if (target.startsWith('#')) return `${pageUrl(self)}${target}`;
  const hashAt = target.indexOf('#');
  const file = hashAt < 0 ? target : target.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : target.slice(hashAt);
  const ext = path.posix.extname(file);
  if (ext && ext !== '.md' && ext !== '.html') {
    const served = file.startsWith('/') ? file : path.posix.join(path.posix.dirname(self), file);
    return `${DOCS_URL}${served}${hash}`;
  }
  return `${pageUrl(resolveDocLink(self, file.replace(/\.html$/, '')))}${hash}`;
}

function screenshotText(tag: string, ctx: DocsContext, where: string): string {
  const attrs = attributes(tag);
  const id = attrs.get('id');
  const alt = attrs.get('alt');
  if (!id || !alt) throw new Error(`${where}: <Screenshot> needs an id and an alt`);
  const entry = ctx.media[id];
  // The site leaves out a picture that is not captured yet, so this does too.
  if (!entry) return '';
  return `*${entry.kind === 'clip' ? 'Video' : 'Picture'}: ${escapeMarkdown(alt)}*`;
}

function planDrawerText(tag: string, where: string): string {
  const attrs = attributes(tag);
  const width = Number(attrs.get('width'));
  const depth = Number(attrs.get('depth'));
  const height = attrs.get('height');
  const name = attrs.get('name');
  if (!(width > 0 && depth > 0)) throw new Error(`${where}: <PlanDrawerButton> needs a size`);
  const size = {
    widthMm: width,
    depthMm: depth,
    ...(height === undefined ? {} : { heightMm: Number(height) }),
  };
  return `[Plan this drawer in the app](${drawerLink(size, name ? { name } : {})})`;
}

function blockComponent(name: string, self: string, ctx: DocsContext): string[] {
  if (name === 'RecipeCards') {
    const recipes = sidebar.find((group) => group.text === 'Recipes')?.items ?? [];
    return sidebarLinks(recipes)
      .filter((link) => link !== self)
      .map((link) => pageEntry(link, ctx, pageUrl));
  }
  return [
    `*The web page has a [drawer calculator](${pageUrl(self)}) here: type the inside width, ` +
      'depth and height of a drawer to see the grid that fits and how tall the bins can be.*',
  ];
}

function inlineText(line: string, self: string, ctx: DocsContext, where: string): string {
  const text = line
    .replace(SCREENSHOT_TAG, (tag) => screenshotText(tag, ctx, where))
    .replace(PLAN_DRAWER_TAG, (tag) => planDrawerText(tag, where))
    .replace(UI_TAG, (_tag, key: string, offset: number, all: string) =>
      uiLabel(key, all, offset, where)
    )
    .replace(DOC_LINK, (_link, target: string) => `](${absoluteLink(self, target)})`);
  const left = ANY_COMPONENT.exec(text);
  if (left) throw new Error(`${where}: no Markdown form for <${left[1]}>`);
  return text;
}

export function pageMarkdown(page: DocPage, ctx: DocsContext): string {
  const self = pageLink(page.file);
  const out: string[] = [];
  let fence: string | null = null;
  let inContainer = false;
  const push = (line: string): void => {
    out.push(inContainer ? (line ? `> ${line}` : '>') : line);
  };
  const afterBlank = (): boolean => {
    const last = out.at(-1);
    return last === undefined || last === '' || last === '>';
  };

  for (const raw of page.body.split('\n')) {
    const [, run = '', rest = ''] = FENCE.exec(raw) ?? [];
    if (fence !== null) {
      // Only a run of the same character, at least as long and with nothing
      // after it, closes a fence, so a fence can show another fence.
      if (run[0] === fence[0] && run.length >= fence.length && !rest.trim()) fence = null;
      push(raw);
      continue;
    }
    if (run) {
      fence = run;
      push(raw);
      continue;
    }
    const open = CONTAINER_OPEN.exec(raw);
    if (open && !inContainer) {
      const title = open[2] || (CONTAINER_TITLES[open[1]] ?? open[1]);
      out.push(`> ${inlineText(`**${title}**`, self, ctx, page.file)}`, '>');
      inContainer = true;
      continue;
    }
    if (inContainer && CONTAINER_CLOSE.test(raw)) {
      inContainer = false;
      continue;
    }
    const block = BLOCK_COMPONENT.exec(raw);
    if (block) {
      for (const line of blockComponent(block[1], self, ctx)) push(line);
      continue;
    }
    const text = inlineText(raw, self, ctx, page.file);
    if (raw.trim() && !text.trim()) continue;
    if (!text.trim() && afterBlank()) continue;
    push(text);
  }
  if (fence !== null || inContainer)
    throw new Error(`${page.file}: a fence or a ::: block is not closed`);

  let markdown = out.join('\n').trim();
  if (!/^#\s/.test(markdown)) {
    markdown = `# ${textField(page.data, 'title') ?? TITLE}\n\n${markdown}`;
  }
  return `${markdown}\n`;
}

function orderedLinks(ctx: DocsContext): string[] {
  const inSidebar = sidebarLinks(sidebar).filter((link) => ctx.pages.has(link));
  const rest = [...ctx.pages.keys()].filter((link) => !inSidebar.includes(link)).sort();
  return [...new Set([...inSidebar, ...rest])];
}

function siteDescription(ctx: DocsContext): string {
  const home = ctx.pages.get(HOME);
  return (home && textField(home.data, 'description')) ?? TITLE;
}

export function llmsIndex(ctx: DocsContext): string {
  const lines = [
    `# ${TITLE}`,
    '',
    `> ${siteDescription(ctx)}`,
    '',
    `The Gridfinity Layout Tool is a free web app at ${APP_URL}. It plans Gridfinity drawer ` +
      'layouts, designs custom bins and baseplates, and exports files for 3D printing. Each link ' +
      `below is a docs page in Markdown. All the pages are also in one file: ${DOCS_URL}/llms-full.txt`,
    '',
  ];
  for (const group of sidebar) {
    const links = sidebarLinks(group.items ?? []).filter((link) => ctx.pages.has(link));
    if (links.length === 0) continue;
    lines.push(
      `## ${group.text ?? 'Docs'}`,
      '',
      ...links.map((l) => pageEntry(l, ctx, markdownUrl)),
      ''
    );
  }
  return `${lines.join('\n').trim()}\n`;
}

export function llmsFull(ctx: DocsContext): string {
  const parts = [`# ${TITLE}`, '', `> ${siteDescription(ctx)}`];
  for (const link of orderedLinks(ctx)) {
    const page = ctx.pages.get(link);
    if (!page) continue;
    parts.push('', '---', '', `Source: ${pageUrl(link)}`, '', pageMarkdown(page, ctx).trim());
  }
  return `${parts.join('\n')}\n`;
}

function main(): void {
  if (!fs.existsSync(path.join(DOCS_BUILD, 'index.html'))) {
    throw new Error(
      'build-docs-llms: apps/docs/.vitepress/dist/index.html not found. Run docs:build first.'
    );
  }
  const ctx = docsContext(readDocPages(), readManifest());
  for (const [link, page] of ctx.pages) {
    const file = path.join(DOCS_BUILD, `${link.slice(1)}.md`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, pageMarkdown(page, ctx));
  }
  fs.writeFileSync(path.join(DOCS_BUILD, 'llms.txt'), llmsIndex(ctx));
  fs.writeFileSync(path.join(DOCS_BUILD, 'llms-full.txt'), llmsFull(ctx));
  console.log(`✓ Wrote ${ctx.pages.size} Markdown pages, llms.txt and llms-full.txt`);
}

if (process.argv[1]?.endsWith('build-docs-llms.ts')) main();
