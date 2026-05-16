import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

function sha256Base64(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('base64');
}

interface VercelHeader {
  key: string;
  value: string;
}

interface VercelHeadersEntry {
  source: string;
  headers: VercelHeader[];
}

interface VercelConfig {
  headers?: VercelHeadersEntry[];
}

/**
 * Find executable inline scripts: any <script>…</script> that isn't
 * `type="…"` (JSON-LD, module, etc.) and isn't `src="…"` (external).
 * Case-insensitive so `<SCRIPT>` or `<script defer>` aren't silently
 * skipped — the test exists precisely to catch what `index.html` ships.
 *
 * Closing tag matches anything between `</script` and `>` (not just
 * pure whitespace) so browser-permissive forms like `</script foo=bar>`
 * or `</script\n\tjunk>` still terminate the body — otherwise CodeQL
 * `js/bad-tag-filter` (and a real `index.html` typo) could slip a
 * script past hash verification.
 */
function findInlineScripts(html: string): string[] {
  const scripts: string[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)) {
    const attrs = m[1];
    if (/\bsrc\s*=/i.test(attrs)) continue;
    if (/\btype\s*=/i.test(attrs)) continue;
    scripts.push(m[2]);
  }
  return scripts;
}

/**
 * Extract `script-src` source list from every CSP header (enforced and
 * report-only) declared in vercel.json. A hash that lands in `style-src`
 * by mistake must not satisfy the test.
 */
function scriptSrcDirectives(config: VercelConfig): string[] {
  const directives: string[] = [];
  for (const entry of config.headers ?? []) {
    for (const header of entry.headers) {
      if (!/^content-security-policy(-report-only)?$/i.test(header.key)) continue;
      for (const part of header.value.split(';')) {
        const trimmed = part.trim();
        if (/^script-src\b/i.test(trimmed)) directives.push(trimmed);
      }
    }
  }
  return directives;
}

// CSP inline-script hashes drift on the slightest byte change. Without this
// check, edits to the theme or www-migration scripts in index.html silently
// produce CSP violations in production (report-only today, enforced later).
describe('CSP inline-script hashes are in sync with vercel.json', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const config = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as VercelConfig;
  const inlineScripts = findInlineScripts(html);
  const scriptSrcs = scriptSrcDirectives(config);

  it('finds at least one inline script to verify', () => {
    expect(inlineScripts.length).toBeGreaterThan(0);
  });

  it('finds at least one script-src directive in vercel.json', () => {
    expect(scriptSrcs.length).toBeGreaterThan(0);
  });

  for (const [i, body] of inlineScripts.entries()) {
    const directive = `'sha256-${sha256Base64(body)}'`;
    it(`inline script #${i + 1} has matching script-src hash ${directive}`, () => {
      expect(scriptSrcs.some((src) => src.includes(directive))).toBe(true);
    });
  }
});
