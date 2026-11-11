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
import { MALFORMED_UI_TAG, UI_TAG, resolveUiLabel } from '../apps/docs/.vitepress/uiLabels';
import { nav, sidebar } from '../apps/docs/.vitepress/navigation';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOCS_DIR = 'apps/docs';
const HOME_PAGE = `${DOCS_DIR}/index.md`;
const APP_ORIGIN = 'https://gridfinitylayouttool.com';
const APP_ROUTES = new Set(['/', '/designer', '/baseplate', '/community', '/supporters']);
const LOCALES: ReadonlySet<string> = new Set(CONTENT_LOCALES);
const SCREENSHOT_TAG = /<Screenshot\s[^>]*\bid="([^"]+)"/g;
const APP_LINK = /https:\/\/gridfinitylayouttool\.com(\/[^\s)"'#?]*)?/g;
const DOC_LINK = /\]\(((?:\.{1,2}\/|\/(?!\/))[^)\s]*|#[^)\s]+)\)/g;

export interface DocPage {
  readonly file: string;
  readonly data: Record<string, unknown>;
  readonly body: string;
}

interface StagedSource {
  readonly page: string;
  readonly source: string;
}

function readDocPages(): DocPage[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'public')
        continue;
      const rel = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith('.md')) files.push(rel);
    }
  };
  walk(DOCS_DIR);
  return files.sort().map((file) => {
    const { data, content } = parseFrontmatter(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    return { file, data, body: content };
  });
}

function pageLink(file: string): string {
  return `/${file.slice(DOCS_DIR.length + 1).replace(/\.md$/, '')}`;
}

function sidebarLinks(): string[] {
  return sidebar.flatMap((group) => (group.items ?? []).map((item) => item.link ?? ''));
}

function pageSources(page: DocPage): string[] {
  const sources = page.data.sources;
  return Array.isArray(sources) ? sources.filter((s): s is string => typeof s === 'string') : [];
}

// The home page keeps its hero buttons and feature cards in frontmatter.
function frontmatterLinks(data: unknown): string[] {
  if (Array.isArray(data)) return data.flatMap(frontmatterLinks);
  if (typeof data !== 'object' || data === null) return [];
  return Object.entries(data).flatMap(([key, value]) =>
    key === 'link' && typeof value === 'string' ? [value] : frontmatterLinks(value)
  );
}

function isAppUrl(link: string): boolean {
  return URL.canParse(link) && new URL(link).origin === APP_ORIGIN;
}

export function checkAppLink(url: string, exists: (rel: string) => boolean): string | null {
  const route = new URL(url).pathname.replace(/\/$/, '') || '/';
  if (route === '/docs' || route.startsWith('/docs/'))
    return `${url}: link to another docs page with a relative link`;
  if (APP_ROUTES.has(route)) return null;
  // Content pages are checked by source file, not by the rewrite list: some,
  // like `/schema`, are served as a static folder and never get a rewrite.
  const segments = route.slice(1).split('/');
  const isContentRoute =
    segments.length === 1 || (segments.length === 2 && LOCALES.has(segments[0]));
  if (isContentRoute && exists(`content${route}.md`)) return null;
  if (exists(`public${route}`)) return null;
  return `${url}: no such page in the app`;
}

export function checkPage(page: DocPage, exists: (rel: string) => boolean): string[] {
  const problems: string[] = [];
  const at = (msg: string): string => `${page.file}: ${msg}`;

  if (page.file !== HOME_PAGE) {
    for (const field of ['title', 'description']) {
      const value = page.data[field];
      if (typeof value !== 'string' || value === '')
        problems.push(at(`frontmatter needs a "${field}"`));
    }
    const sources = pageSources(page);
    if (sources.length === 0)
      problems.push(at('frontmatter needs "sources": the code paths this page describes'));
    for (const source of sources) {
      if (!exists(source)) problems.push(at(`source "${source}" does not exist`));
    }
  }

  for (const [, key] of page.body.matchAll(UI_TAG)) {
    const label = resolveUiLabel(key);
    if (!label.ok) problems.push(at(label.reason));
  }
  if (MALFORMED_UI_TAG.test(page.body.replace(UI_TAG, '')))
    problems.push(at('malformed <Ui> tag: write <Ui k="the.key" />'));
  const appLinks = [
    ...[...page.body.matchAll(APP_LINK)].map(([url]) => url),
    ...frontmatterLinks(page.data).filter(isAppUrl),
  ];
  for (const url of appLinks) {
    const problem = checkAppLink(url, exists);
    if (problem) problems.push(at(problem));
  }
  return problems;
}

export function checkSidebar(files: readonly string[], links: readonly string[]): string[] {
  const problems: string[] = [];
  const pages = new Set(files.filter((f) => f !== HOME_PAGE).map(pageLink));
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
    for (const [, id] of page.body.matchAll(SCREENSHOT_TAG)) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
        problems.push(`${page.file}: screenshot id "${id}" must be kebab-case`);
      const first = seen.get(id);
      if (first) problems.push(`${page.file}: screenshot id "${id}" is also used in ${first}`);
      else seen.set(id, page.file);
    }
  }
  return problems;
}

const MEDIA_DIR = `${DOCS_DIR}/media`;
const MANIFEST = `${MEDIA_DIR}/manifest.json`;

export interface MediaEntry {
  kind: 'still' | 'clip';
  width: number;
  height: number;
}

function readManifest(): Record<string, MediaEntry> {
  const file = path.join(ROOT, MANIFEST);
  return fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, MediaEntry>)
    : {};
}

/** The files `scripts/docs-capture` writes for one entry. */
export function mediaFiles(id: string, entry: MediaEntry): string[] {
  const exts = entry.kind === 'clip' ? ['webp', 'mp4'] : ['webp'];
  return ['light', 'dark'].flatMap((theme) => exts.map((ext) => `${id}.${theme}.${ext}`));
}

/**
 * Media must stay in step with the pages: each capture fills a `<Screenshot>`
 * on some page and has both themes on disk, and no file sits outside the
 * manifest, where nothing would ever show or replace it.
 */
export function checkMedia(
  pages: readonly DocPage[],
  manifest: Record<string, MediaEntry>,
  files: readonly string[]
): string[] {
  const used = new Set(
    pages.flatMap((p) => [...p.body.matchAll(SCREENSHOT_TAG)].map(([, id]) => id))
  );
  const present = new Set(files);
  const owned = new Set(['manifest.json']);
  const problems: string[] = [];
  for (const [id, entry] of Object.entries(manifest)) {
    if (!used.has(id)) problems.push(`${MANIFEST}: "${id}" fills no <Screenshot> on any page`);
    if (entry.kind !== 'still' && entry.kind !== 'clip')
      problems.push(`${MANIFEST}: "${id}" has kind "${String(entry.kind)}"`);
    if (!(entry.width > 0 && entry.height > 0))
      problems.push(`${MANIFEST}: "${id}" needs a positive width and height`);
    for (const file of mediaFiles(id, entry)) {
      owned.add(file);
      if (!present.has(file)) problems.push(`${MEDIA_DIR}: ${file} is missing for "${id}"`);
    }
  }
  for (const file of files) {
    if (!owned.has(file)) problems.push(`${MEDIA_DIR}: ${file} is not in the manifest`);
  }
  return problems;
}

// VitePress's own slugify (vitepress/dist/node, `slugify`), so anchors match the build.
function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, '_$1')
    .toLowerCase();
}

// VitePress builds a heading id from every token but HTML and emoji, so a tag
// drops out of the id while the text inside it stays, and a `<Ui>` label adds
// nothing. A character scan, not a regex, keeps CodeQL from reading this as
// HTML sanitizing.
function stripTags(text: string): string {
  let out = '';
  let inTag = false;
  for (const ch of text) {
    if (ch === '<') inTag = true;
    else if (ch === '>' && inTag) inTag = false;
    else if (!inTag) out += ch;
  }
  return out;
}

export function headingAnchors(body: string): Set<string> {
  const anchors = new Set<string>();
  let inFence = false;
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const heading = /^#{1,6}\s+(.*?)\s*$/.exec(line);
    if (!heading) continue;
    const custom = /\{#([^}]+)\}$/.exec(heading[1]);
    const base = custom
      ? custom[1]
      : slugify(
          stripTags(heading[1])
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

function resolveDocLink(fromLink: string, target: string): string {
  if (!target) return fromLink;
  const joined = target.startsWith('/')
    ? target
    : path.posix.join(path.posix.dirname(fromLink), target);
  return joined.replace(/\.md$/, '').replace(/\/$/, '/index');
}

/**
 * Links between docs pages must reach a page, and a `#hash` one of its headings.
 * A link to any other file (an image, a download) must reach a file: `/x.png`
 * is served from `public/`, a relative one sits next to the page.
 */
export function checkDocLinks(
  pages: readonly DocPage[],
  exists: (rel: string) => boolean
): string[] {
  const anchorsByLink = new Map(pages.map((p) => [pageLink(p.file), headingAnchors(p.body)]));
  const problems: string[] = [];
  for (const page of pages) {
    const self = pageLink(page.file);
    const links = [
      ...[...page.body.matchAll(DOC_LINK)].map(([, link]) => link),
      ...frontmatterLinks(page.data).filter((link) => link.startsWith('/')),
    ];
    for (const link of links) {
      const [target, hash = ''] = link.split('#');
      const ext = path.posix.extname(target);
      if (ext && ext !== '.md') {
        const file = target.startsWith('/')
          ? `${DOCS_DIR}/public${target}`
          : path.posix.join(path.posix.dirname(page.file), target);
        if (!exists(file)) problems.push(`${page.file}: link "${link}" has no file ${file}`);
        continue;
      }
      const anchors = anchorsByLink.get(resolveDocLink(self, target));
      if (!anchors) problems.push(`${page.file}: link "${link}" has no page`);
      else if (hash && !anchors.has(slugify(decodeURI(hash))))
        problems.push(`${page.file}: link "${link}" has no heading "#${hash}"`);
    }
  }
  return problems;
}

// The top nav lives in the VitePress config, outside any page, so its links
// are checked as if they were one more page's frontmatter.
const NAV_LINKS: DocPage = {
  file: `${DOCS_DIR}/.vitepress/navigation.ts`,
  data: { nav },
  body: '',
};

function mediaDirFiles(): string[] {
  const dir = path.join(ROOT, MEDIA_DIR);
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
}

export function collectProblems(pages: readonly DocPage[] = readDocPages()): string[] {
  const exists = (rel: string): boolean => fs.existsSync(path.join(ROOT, rel));
  const navAppLinks = frontmatterLinks(NAV_LINKS.data)
    .filter(isAppUrl)
    .flatMap((url) => {
      const problem = checkAppLink(url, exists);
      return problem ? [`${NAV_LINKS.file}: ${problem}`] : [];
    });
  return [
    ...navAppLinks,
    ...pages.flatMap((p) => checkPage(p, exists)),
    ...checkSidebar(
      pages.map((p) => p.file),
      sidebarLinks()
    ),
    ...checkScreenshotIds(pages),
    ...checkDocLinks([...pages, NAV_LINKS], exists),
    ...checkMedia(pages, readManifest(), mediaDirFiles()),
  ];
}

export function docsForStagedSources(
  pages: readonly DocPage[],
  staged: readonly string[]
): StagedSource[] {
  const hits: StagedSource[] = [];
  for (const page of pages) {
    if (staged.includes(page.file)) continue;
    for (const source of pageSources(page)) {
      const dir = source.endsWith('/') ? source : `${source}/`;
      const hit = staged.find((f) => f === source || f.startsWith(dir));
      if (hit) {
        hits.push({ page: page.file, source: hit });
        break;
      }
    }
  }
  return hits;
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
  const pages = readDocPages();

  if (mode === '--staged') {
    // --no-renames lists a moved file under its old path too, so a page that
    // names the old path still gets its warning.
    const staged = git(['diff', '--cached', '--name-only', '--no-renames', '--diff-filter=ACMRD'])
      .split('\n')
      .filter(Boolean);
    const hits = docsForStagedSources(pages, staged);
    if (hits.length > 0) {
      console.warn('\x1b[1;33m⚠ user docs:\x1b[0m these pages describe code you changed:');
      for (const hit of hits) console.warn(`  ${hit.page}  (source: ${hit.source})`);
      console.warn('  Update them in this commit if the change is visible to users.\n');
    }
    return;
  }

  if (mode === '--stale') {
    const rows = pages
      .map((page) => {
        const sources = pageSources(page);
        const pageTime = lastCommitTime([page.file]);
        const sourceTime = sources.length > 0 ? lastCommitTime(sources) : 0;
        return { file: page.file, behindDays: (sourceTime - pageTime) / 86_400 };
      })
      .filter((row) => row.behindDays > 0)
      .sort((a, b) => b.behindDays - a.behindDays);
    if (rows.length === 0) console.warn('No docs page is older than its sources.');
    for (const row of rows)
      console.warn(`${row.behindDays.toFixed(1).padStart(6)} days  ${row.file}`);
    const manifest = readManifest();
    const shots = pages.flatMap((page) =>
      [...page.body.matchAll(SCREENSHOT_TAG)].map(([, id]) => ({ page, id }))
    );
    const missing = shots.filter(({ id }) => !manifest[id]);
    if (missing.length > 0)
      console.warn(`\n${missing.length} of ${shots.length} screenshots are not captured yet.`);
    // A capture older than its page's sources may show a UI that has changed.
    const old = shots.filter(({ page, id }) => {
      const entry = manifest[id];
      if (!entry) return false;
      const shotTime = lastCommitTime(mediaFiles(id, entry).map((f) => `${MEDIA_DIR}/${f}`));
      const sources = pageSources(page);
      return shotTime > 0 && sources.length > 0 && lastCommitTime(sources) > shotTime;
    });
    if (old.length > 0) {
      console.warn(`\n${old.length} captures are older than their page's sources:`);
      for (const { id } of old) console.warn(`  pnpm run capture:docs ${id}`);
    }
    return;
  }

  const problems = collectProblems(pages);
  if (problems.length > 0) {
    console.error('\x1b[1;31m✗ user docs check failed:\x1b[0m');
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('check-user-docs.ts')) main();
