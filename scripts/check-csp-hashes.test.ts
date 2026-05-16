import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

function sha256Base64(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('base64');
}

/**
 * Hash every executable inline `<script>` in `index.html` and assert the
 * `script-src` directive in `vercel.json` contains that hash.
 *
 * CSP inline-script hashes drift on the slightest byte change (a single
 * whitespace edit breaks them). Without this check, edits to the theme-
 * detection or www-migration scripts in index.html would silently start
 * producing CSP violations in production — the policy is report-only
 * today but is intended to be enforced later.
 *
 * `<script type="application/ld+json">` and `<script src="…">` blocks are
 * intentionally skipped: only the body of an executable inline script is
 * subject to `script-src`.
 */
describe('CSP inline-script hashes are in sync with vercel.json', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const vercelConfig = readFileSync(join(ROOT, 'vercel.json'), 'utf8');

  // Match <script> with no attributes (executable inline). We deliberately
  // skip <script type="…"> (JSON-LD) and <script src="…"> (external).
  const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

  it('finds at least one inline script to verify', () => {
    expect(inlineScripts.length).toBeGreaterThan(0);
  });

  for (const [i, body] of inlineScripts.entries()) {
    const hash = sha256Base64(body);
    const directive = `'sha256-${hash}'`;
    it(`inline script #${i + 1} has matching CSP hash ${directive}`, () => {
      expect(vercelConfig).toContain(directive);
    });
  }
});
