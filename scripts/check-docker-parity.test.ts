import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToRegexp } from 'path-to-regexp';
import { describe, expect, it } from 'vitest';
import { ErrorCode } from '../api/lib/shared';
import { CONTENT_LOCALES, CONTENT_SLUGS } from './contentRoutes';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

interface VercelRoute {
  source: string;
  destination: string;
}
interface VercelHeaderEntry {
  source: string;
  headers: { key: string; value: string }[];
}
interface VercelConfig {
  redirects?: (VercelRoute & { permanent?: boolean })[];
  rewrites?: VercelRoute[];
  headers?: VercelHeaderEntry[];
}

const vercel = JSON.parse(read('vercel.json')) as VercelConfig;
const redirects = vercel.redirects ?? [];
const rewrites = vercel.rewrites ?? [];
const headerEntries = vercel.headers ?? [];
const nginx = read('docker/nginx.conf');
const nginxLines = nginx.split('\n');

/** Vercel compiles rewrite/redirect sources with path-to-regexp 6 and these options. */
const vercelRegex = (source: string): RegExp =>
  pathToRegexp(source, [], { strict: true, sensitive: true, delimiter: '/' });

// A line holding one nginx directive, with every `# vercel:` marker stacked
// directly above it. The conf keeps one regex location or map row per line,
// so a marker always refers to the next non-marker line.
interface MarkedLine {
  lineNo: number;
  text: string;
  sources: string[];
}

function markedLines(): MarkedLine[] {
  const out: MarkedLine[] = [];
  let pending: string[] = [];
  nginxLines.forEach((raw, i) => {
    const marker = /^\s*# vercel: (.+)$/.exec(raw);
    if (marker) {
      pending.push(
        ...marker[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      );
      return;
    }
    if (pending.length === 0) return;
    if (raw.trim() === '' || raw.trim().startsWith('#')) {
      throw new Error(
        `docker/nginx.conf:${i + 1}: a "# vercel:" marker must sit directly above a directive`
      );
    }
    out.push({ lineNo: i + 1, text: raw, sources: pending });
    pending = [];
  });
  return out;
}

const marked = markedLines();
const claimedSources = new Set(marked.flatMap((m) => m.sources));
const allSources = [
  ...redirects.map((r) => r.source),
  ...rewrites.map((r) => r.source),
  ...headerEntries.map((h) => h.source),
];

// The API has no counterpart in the image, so its CORS headers have none either.
const UNMIRRORED = new Set(['/api/(.*)']);

/** The nginx regex of a `location ~ "..."` line, or the exact literal as an anchored regex. */
function locationRegex(line: string): RegExp {
  const m = /^\s*location\s+(=|\^~|~\*?)\s*(?:"([^"]+)"|(\S+))\s*\{/.exec(line);
  if (!m) throw new Error(`not a location line: ${line.trim().slice(0, 80)}`);
  const modifier = m[1];
  const pattern = m[2] ?? m[3];
  if (modifier === '=') return new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  if (modifier === '~') return new RegExp(pattern);
  if (modifier === '~*') return new RegExp(pattern, 'i');
  throw new Error(`prefix locations are not markers: ${line.trim()}`);
}

interface MapRow {
  key: string;
  regex: RegExp | null;
  value: string;
}

/** Rows of `map $x $name { ... }` in file order, quotes stripped. */
function mapRows(name: string): MapRow[] {
  const start = nginxLines.findIndex((l) => new RegExp(`^map \\$\\w+ \\$${name} \\{`).test(l));
  if (start < 0) throw new Error(`map $${name} not found`);
  const rows: MapRow[] = [];
  for (let i = start + 1; i < nginxLines.length; i++) {
    const line = nginxLines[i];
    if (line.trim() === '}') break;
    const m = /^\s*(?:"([^"]*)"|(\S+))\s+(?:"([^"]*)"|(\S+));\s*$/.exec(line);
    if (!m) continue;
    const key = m[1] ?? m[2];
    const value = m[3] ?? m[4];
    const regex = key.startsWith('~*')
      ? new RegExp(key.slice(2), 'i')
      : key.startsWith('~')
        ? new RegExp(key.slice(1))
        : null;
    rows.push({ key, regex, value });
  }
  return rows;
}

/** nginx map semantics: exact strings (case-insensitively) first, then regexes in file order, else default. */
function evalMap(rows: MapRow[], input: string): string {
  const exact = rows.find(
    (r) => r.regex === null && r.key !== 'default' && r.key.toLowerCase() === input.toLowerCase()
  );
  if (exact) return exact.value;
  for (const row of rows) {
    if (!row.regex) continue;
    const m = row.regex.exec(input);
    if (m) return row.value.replace(/\$(\d)/g, (_, n: string) => m[Number(n)] ?? '');
  }
  return rows.find((r) => r.key === 'default')?.value ?? '';
}

/** The final `$uri` nginx sees for a vercel header source, i.e. after try_files. */
function sampleFinalUri(source: string): string {
  if (source === '/(.*)') return '/index.html';
  if (source === '/assets/:path*') return '/assets/main-abc123.js';
  if (source === '/content.:hash.css') return '/content.abc123.css';
  if (source === '/workbox-:hash.js') return '/workbox-abc123.js';
  const locale = /^\/([A-Za-z-]+)\/:path\(\(\?!api\/\)\.\*\)$/.exec(source);
  if (locale) return `/${locale[1]}/guide/index.html`;
  if (/^\/[a-z-]+$/.test(source)) return `${source}/index.html`;
  if (/^\/[\w.-]+$/.test(source)) return source;
  throw new Error(`no sample final uri for header source ${source}`);
}

const UUID = '0f3b6a1e-2c4d-4e8f-9a1b-3c5d7e9f0a1b';
const SAMPLE_PATHS = [
  '/',
  '/guide',
  '/Guide',
  '/guide/',
  '/privacy',
  '/de/guide',
  '/de/privacy',
  '/xx/guide',
  '/pt-BR/gridfinity-sizes',
  '/designer',
  '/baseplate',
  '/supporters',
  '/community',
  '/community/d/AbCdEfGhIjKl',
  '/community/d/short',
  '/s/AbCdEfGhIjKl',
  '/s/AbCdEfGhIjKl/x',
  '/l/AbCdEfGhIjKl',
  '/l/AbCdEfGhIjKl/some-slug',
  '/l/AbCdEfGhIjKl/x/y',
  '/l/short',
  `/l/${UUID}`,
  `/l/${UUID}/slug`,
  `/scan/${UUID}`,
  '/scan/not-a-uuid',
  '/generator',
  '/generators',
  '/generatorx',
  '/sizes',
  '/assets/main-abc.js',
  '/api/share',
  '/does-not-exist',
];

describe('docker/nginx.conf mirrors vercel.json', () => {
  it('parses enough of vercel.json to mean anything', () => {
    expect(rewrites.length).toBeGreaterThanOrEqual(10);
    expect(redirects.length).toBeGreaterThanOrEqual(3);
    expect(headerEntries.length).toBeGreaterThanOrEqual(30);
    expect(marked.length).toBeGreaterThanOrEqual(10);
  });

  it('claims every vercel.json source with a marker', () => {
    const missing = allSources.filter((s) => !claimedSources.has(s) && !UNMIRRORED.has(s));
    expect(
      missing,
      'add a "# vercel: <source>" marker above the nginx directive that mirrors it'
    ).toEqual([]);
  });

  it('has no marker for a source vercel.json no longer lists', () => {
    const live = new Set(allSources);
    const stale = [...claimedSources].filter((s) => !live.has(s));
    expect(stale, 'remove the nginx block or its marker').toEqual([]);
  });

  it('keeps its regex locations on single quoted lines', () => {
    for (const m of marked) {
      if (!/^\s*location\s+~/.test(m.text)) continue;
      expect(m.text, `docker/nginx.conf:${m.lineNo}`).toMatch(/^\s*location\s+~\*?\s*"[^"]+"\s*\{/);
    }
  });

  describe.each(redirects)('redirect $source', ({ source, destination, permanent }) => {
    const block = marked.find((m) => m.sources.includes(source));
    it('is an exact location returning 308 with the query preserved', () => {
      expect(block).toBeDefined();
      expect(permanent).toBe(true);
      expect(block?.text).toMatch(
        new RegExp(
          `location = ${source.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')} \\{ return 308 ${destination}\\$is_args\\$args; \\}`
        )
      );
    });
  });

  describe('rewrites', () => {
    const rewriteBlocks = marked.filter(
      (m) =>
        /^\s*location/.test(m.text) && m.sources.some((s) => rewrites.some((r) => r.source === s))
    );

    it.each(rewriteBlocks.map((b) => [b.lineNo, b] as const))(
      'line %i matches exactly the union of the vercel sources it claims',
      (_lineNo, block) => {
        const sources = block.sources.filter((s) => rewrites.some((r) => r.source === s));
        expect(sources.length).toBeGreaterThan(0);
        const vercelRegexes = sources.map(vercelRegex);
        const nginxRegex = locationRegex(block.text);
        for (const path of SAMPLE_PATHS) {
          const vercelSays = vercelRegexes.some((re) => re.test(path));
          expect(
            nginxRegex.test(path),
            `${path} (nginx) vs vercel sources ${sources.join(', ')}`
          ).toBe(vercelSays);
        }
      }
    );

    it('serves /community/d/:id from the shell, since the meta-injecting handler needs the API', () => {
      const source = rewrites.find((r) => r.source.startsWith('/community/d/'))?.source;
      expect(source).toBeDefined();
      const block = marked.find((m) => m.sources.includes(source ?? ''));
      expect(block?.text).toMatch(/try_files \$uri\/index\.html \/index\.html;/);
    });

    it('has no catch-all: the default location 404s like Vercel', () => {
      const fallback = nginxLines.find((l) => /^\s*location \/ \{/.test(l));
      expect(fallback).toMatch(/try_files \$uri \$uri\/index\.html =404;/);
    });
  });

  describe('content routes', () => {
    const [english, localized] = rewrites;
    const alt = (source: string, name: string): string[] =>
      (new RegExp(`:${name}\\(([^)]+)\\)`).exec(source)?.[1] ?? '').split('|');

    it('vercel.json, vite.config.ts and nginx agree on the slug and locale sets', () => {
      expect(new Set(alt(english.source, 'slug'))).toEqual(new Set(CONTENT_SLUGS));
      expect(new Set(alt(localized.source, 'locale'))).toEqual(new Set(CONTENT_LOCALES));
      const localizedSlugs = alt(localized.source, 'slug');
      for (const slug of localizedSlugs) expect(CONTENT_SLUGS).toContain(slug);
      const englishBlock = marked.find((m) => m.sources.includes(english.source));
      const localizedBlock = marked.find((m) => m.sources.includes(localized.source));
      for (const slug of CONTENT_SLUGS)
        expect(englishBlock?.text).toContain(
          `|${slug}`.replace(/^\|what-is-gridfinity$/, 'what-is-gridfinity')
        );
      for (const locale of CONTENT_LOCALES) expect(localizedBlock?.text).toContain(locale);
    });
  });

  describe('headers', () => {
    const global = headerEntries.find((h) => h.source === '/(.*)');
    const serverLevel = nginxLines.filter((l) => /^\s{4}add_header /.test(l));
    const ccRows = mapRows('cc_by_uri');
    const langRows = mapRows('content_language');

    it('sets every global header verbatim at server level, with always', () => {
      expect(global).toBeDefined();
      for (const { key, value } of global?.headers ?? []) {
        if (key === 'Strict-Transport-Security') {
          expect(mapRows('hsts').some((r) => r.value === value)).toBe(true);
          expect(
            serverLevel.some((l) => l.includes('Strict-Transport-Security $hsts always;'))
          ).toBe(true);
          continue;
        }
        expect(serverLevel, key).toContain(`    add_header ${key} "${value}" always;`);
      }
    });

    it('never adds a header inside a location (nginx would drop the server-level ones)', () => {
      const inLocation = nginxLines.filter((l) => /^\s{8,}add_header /.test(l));
      expect(inLocation).toEqual([]);
    });

    it('applies Cache-Control by status first: no-store off the happy path', () => {
      const rows = mapRows('cache_control');
      expect(rows.map((r) => [r.key, r.value])).toEqual([
        ['default', 'no-store'],
        ['~^(?:2\\d\\d|304)$', '$cc_by_uri'],
        ['~^3', 'public, max-age=0, must-revalidate'],
      ]);
      expect(serverLevel).toContain('    add_header Cache-Control $cache_control always;');
    });

    it.each(
      headerEntries
        .filter((h) => !UNMIRRORED.has(h.source) && h.source !== '/(.*)')
        .map((h) => [h.source, h] as const)
    )('resolves the same per-path headers as vercel for %s', (source, entry) => {
      const uri = sampleFinalUri(source);
      for (const { key, value } of entry.headers) {
        if (key === 'Cache-Control')
          expect(evalMap(ccRows, uri), `${source} -> ${uri}`).toBe(value);
        else if (key === 'Content-Language') expect(evalMap(langRows, uri), source).toBe(value);
        else if (key === 'Cross-Origin-Resource-Policy')
          expect(evalMap(mapRows('storage_bridge_corp'), uri)).toBe(value);
        else if (key === 'Content-Security-Policy')
          expect(evalMap(mapRows('storage_bridge_csp'), uri)).toBe(value);
        else
          throw new Error(
            `unmirrored header ${key} for ${source}: teach docker/nginx.conf and this test about it`
          );
      }
    });

    it('map string keys are matched case-insensitively, so a differently cased file must still be a 404', () => {
      expect(evalMap(ccRows, '/Version.json')).toBe('no-store, max-age=0');
    });
  });

  describe('api', () => {
    it('answers 503 from the self-hosted pages with the shared error code', () => {
      const block = nginx.slice(nginx.indexOf('location ^~ /api/ {'));
      expect(block).toMatch(/error_page 503 \$api_503_page;/);
      expect(block).toMatch(/return 503;/);
      const body = JSON.parse(read('docker/self-hosted/503.json')) as {
        error: string;
        code: string;
      };
      expect(body.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      expect(body.error.length).toBeGreaterThan(0);
      expect(read('docker/self-hosted/503.html')).toContain(body.error);
    });
  });
});

describe('Dockerfile', () => {
  const dockerfile = read('Dockerfile');
  const froms = dockerfile.split('\n').filter((l) => l.startsWith('FROM '));

  it('builds with the Node major the repo pins', () => {
    const major = read('.nvmrc').trim();
    expect(froms[0]).toMatch(new RegExp(`node:${major}-`));
  });

  it('pins both base images by digest', () => {
    expect(froms).toHaveLength(2);
    for (const line of froms) expect(line).toMatch(/@sha256:[0-9a-f]{64}/);
  });

  it('keeps the runtime stage free of RUN, so arm64 builds without emulation', () => {
    const runtime = dockerfile.slice(dockerfile.lastIndexOf('\nFROM '));
    expect(runtime).not.toMatch(/^RUN /m);
    expect(runtime).toContain('COPY docker/self-hosted /usr/share/nginx/self-hosted');
    expect(runtime).toContain('COPY docker/nginx.conf /etc/nginx/conf.d/default.conf');
  });
});
