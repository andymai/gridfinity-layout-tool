/**
 * Drift guards for the user docs in apps/docs.
 *
 *   tsx scripts/check-user-docs.ts            fail on any problem (pre-commit, CI test)
 *   tsx scripts/check-user-docs.ts --staged   warn about docs whose sources are staged
 *   tsx scripts/check-user-docs.ts --stale    list docs whose sources changed after them
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseFrontmatter } from './contentFrontmatter';
import { CONTENT_LOCALES } from './contentRoutes';
import { UI_TAG, resolveUiLabel } from '../apps/docs/.vitepress/uiLabels';
import { sidebar } from '../apps/docs/.vitepress/sidebar';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOCS_DIR = 'apps/docs';
const APP_ORIGIN = 'https://gridfinitylayouttool.com';
const APP_ROUTES = new Set(['/', '/designer', '/baseplate', '/community', '/supporters']);
const SCREENSHOT_TAG = /<Screenshot\s[^>]*\bid="([^"]+)"/g;
const APP_LINK = /https:\/\/gridfinitylayouttool\.com(\/[^\s)"'#?]*)?/g;

export interface DocPage {
  readonly file: string;
  readonly data: Record<string, unknown>;
  readonly body: string;
}

export function listDocPages(root: string = ROOT): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'public')
        continue;
      const rel = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith('.md')) out.push(rel);
    }
  };
  if (fs.existsSync(path.join(root, DOCS_DIR))) walk(DOCS_DIR);
  return out.sort();
}

export function readDocPage(file: string, root: string = ROOT): DocPage {
  const { data, content } = parseFrontmatter(fs.readFileSync(path.join(root, file), 'utf8'));
  return { file, data, body: content };
}

/** `apps/docs/designer/walls.md` → `/designer/walls`, the form sidebar links use. */
export function pageLink(file: string): string {
  return `/${file.slice(DOCS_DIR.length + 1).replace(/\.md$/, '')}`;
}

export function sidebarLinks(): string[] {
  return sidebar.flatMap((group) => (group.items ?? []).map((item) => item.link ?? ''));
}

export function pageSources(page: DocPage): string[] {
  const s = page.data.sources;
  return Array.isArray(s) ? s.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * A link into the app must reach a fixed route, a content page (`content/<slug>.md`,
 * optionally under a locale), or a static file in `public/`. The content pages are
 * checked by source file, not by the rewrite list: some, like `/schema`, are
 * served as a static folder and never get a rewrite.
 */
export function checkAppLink(url: string, exists: (rel: string) => boolean): string | null {
  const route = url.slice(APP_ORIGIN.length).replace(/\/$/, '') || '/';
  if (route === '/docs' || route.startsWith('/docs/'))
    return `${url}: link to another docs page with a relative link`;
  if (APP_ROUTES.has(route)) return null;
  const parts = route.slice(1).split('/');
  if (parts.length === 1 && exists(`content/${parts[0]}.md`)) return null;
  if (
    parts.length === 2 &&
    (CONTENT_LOCALES as readonly string[]).includes(parts[0]) &&
    exists(`content/${parts[0]}/${parts[1]}.md`)
  )
    return null;
  if (exists(`public${route}`)) return null;
  return `${url}: no such page in the app`;
}

export function checkPage(page: DocPage, exists: (rel: string) => boolean): string[] {
  const problems: string[] = [];
  const at = (msg: string): string => `${page.file}: ${msg}`;
  const isHome = page.file === `${DOCS_DIR}/index.md`;

  if (!isHome) {
    for (const field of ['title', 'description']) {
      if (typeof page.data[field] !== 'string' || page.data[field] === '')
        problems.push(at(`frontmatter needs a "${field}"`));
    }
    const sources = pageSources(page);
    if (sources.length === 0)
      problems.push(at('frontmatter needs "sources": the code paths this page describes'));
    for (const src of sources) {
      if (!exists(src)) problems.push(at(`source "${src}" does not exist`));
    }
  }

  for (const m of page.body.matchAll(UI_TAG)) {
    const r = resolveUiLabel(m[1]);
    if (!r.ok) problems.push(at(r.reason));
  }
  for (const m of page.body.matchAll(APP_LINK)) {
    const p = checkAppLink(m[0], exists);
    if (p) problems.push(at(p));
  }
  return problems;
}

export function checkSidebar(files: readonly string[], links: readonly string[]): string[] {
  const problems: string[] = [];
  const pages = new Set(files.filter((f) => f !== `${DOCS_DIR}/index.md`).map(pageLink));
  const linked = new Set(links);
  for (const link of linked) {
    if (!pages.has(link)) problems.push(`sidebar: "${link}" has no page`);
  }
  for (const page of pages) {
    if (!linked.has(page)) problems.push(`sidebar: page "${page}" is not in the sidebar`);
  }
  return problems;
}

export function checkScreenshotIds(pages: readonly DocPage[]): string[] {
  const seen = new Map<string, string>();
  const problems: string[] = [];
  for (const page of pages) {
    for (const m of page.body.matchAll(SCREENSHOT_TAG)) {
      const id = m[1];
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
        problems.push(`${page.file}: screenshot id "${id}" must be kebab-case`);
      const first = seen.get(id);
      if (first) problems.push(`${page.file}: screenshot id "${id}" is also used in ${first}`);
      else seen.set(id, page.file);
    }
  }
  return problems;
}

// VitePress's own slugify (vitepress/dist/node, `slugify`), so anchors match the build.
const SLUG_CONTROL = /[\u0000-\u001f]/g;
const SLUG_SPECIAL = /[\s~`!@#$%^&*()\-_+=[\]{}|\;:"'“”‘’<>,.?/]+/g;
const SLUG_COMBINING = /[̀-ͯ]/g;

export function slugify(str: string): string {
  return str
    .normalize('NFKD')
    .replace(SLUG_COMBINING, '')
    .replace(SLUG_CONTROL, '')
    .replace(SLUG_SPECIAL, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, '_$1')
    .toLowerCase();
}

/**
 * The heading ids VitePress gives a page. Its anchor plugin reads only text and
 * inline-code tokens, so a `<Ui>` label in a heading adds nothing to the id, and
 * a repeated heading gets `-1`, `-2`.
 */
export function headingAnchors(body: string): Set<string> {
  const anchors = new Set<string>();
  let inFence = false;
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    const m = inFence ? null : /^#{1,6}\s+(.*?)\s*$/.exec(line);
    if (!m) continue;
    const custom = /\{#([^}]+)\}$/.exec(m[1]);
    const base = custom
      ? custom[1]
      : slugify(
          m[1]
            .replace(UI_TAG, '')
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
            .replace(/`/g, '')
        );
    let slug = base;
    for (let i = 1; anchors.has(slug); i++) slug = `${base}-${i}`;
    anchors.add(slug);
  }
  return anchors;
}

const DOC_LINK = /\]\(((?:\.{1,2}\/|\/(?!\/))[^)\s]*|#[^)\s]+)\)/g;

/** Links between docs pages must reach a page, and a `#hash` must reach one of its headings. */
export function checkDocLinks(pages: readonly DocPage[]): string[] {
  const anchorsByLink = new Map(pages.map((p) => [pageLink(p.file), headingAnchors(p.body)]));
  const problems: string[] = [];
  for (const page of pages) {
    const self = pageLink(page.file);
    for (const m of page.body.matchAll(DOC_LINK)) {
      const [target, hash = ''] = m[1].split('#');
      const linked = !target
        ? self
        : target.startsWith('/')
          ? target.replace(/\.md$/, '').replace(/\/$/, '/index')
          : path.posix
              .normalize(path.posix.join(path.posix.dirname(self), target))
              .replace(/\.md$/, '')
              .replace(/\/$/, '/index');
      const anchors = anchorsByLink.get(linked);
      if (!anchors) problems.push(`${page.file}: link "${m[1]}" has no page`);
      else if (hash && !anchors.has(hash))
        problems.push(`${page.file}: link "${m[1]}" has no heading "#${hash}"`);
    }
  }
  return problems;
}

export function collectProblems(root: string = ROOT): string[] {
  const files = listDocPages(root);
  const pages = files.map((f) => readDocPage(f, root));
  const exists = (rel: string): boolean => fs.existsSync(path.join(root, rel));
  return [
    ...pages.flatMap((p) => checkPage(p, exists)),
    ...checkSidebar(files, sidebarLinks()),
    ...checkScreenshotIds(pages),
    ...checkDocLinks(pages),
  ];
}

/** Pages that list a staged file (or a folder holding one) as a source, but are not staged. */
export function docsForStagedSources(
  pages: readonly DocPage[],
  staged: readonly string[]
): { page: string; source: string }[] {
  const stagedSet = new Set(staged);
  const out: { page: string; source: string }[] = [];
  for (const page of pages) {
    if (stagedSet.has(page.file)) continue;
    for (const src of pageSources(page)) {
      const dir = src.endsWith('/') ? src : `${src}/`;
      const hit = staged.find((f) => f === src || f.startsWith(dir));
      if (hit) {
        out.push({ page: page.file, source: hit });
        break;
      }
    }
  }
  return out;
}

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function lastCommitTime(paths: string[]): number {
  const out = git(['log', '-1', '--format=%ct', '--', ...paths]);
  return out ? Number(out) : 0;
}

function main(): void {
  const mode = process.argv[2];
  const pages = listDocPages().map((f) => readDocPage(f));

  if (mode === '--staged') {
    const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMRD'])
      .split('\n')
      .filter(Boolean);
    const hits = docsForStagedSources(pages, staged);
    if (hits.length > 0) {
      console.warn('\x1b[1;33m⚠ user docs:\x1b[0m these pages describe code you changed:');
      for (const h of hits) console.warn(`  ${h.page}  (source: ${h.source})`);
      console.warn('  Update them in this commit if the change is visible to users.\n');
    }
    return;
  }

  if (mode === '--stale') {
    const rows = pages
      .map((p) => {
        const sources = pageSources(p);
        const pageTime = lastCommitTime([p.file]);
        const sourceTime = sources.length > 0 ? lastCommitTime(sources) : 0;
        return { file: p.file, behindDays: (sourceTime - pageTime) / 86_400 };
      })
      .filter((r) => r.behindDays > 0)
      .sort((a, b) => b.behindDays - a.behindDays);
    if (rows.length === 0) console.warn('No docs page is older than its sources.');
    for (const r of rows) console.warn(`${r.behindDays.toFixed(1).padStart(6)} days  ${r.file}`);
    return;
  }

  const problems = collectProblems();
  if (problems.length > 0) {
    console.error('\x1b[1;31m✗ user docs check failed:\x1b[0m');
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main();
}
