import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const HOOKS_DIR = join(ROOT, 'src', 'shared', 'hooks');

interface VercelRewrite {
  source: string;
  destination: string;
}

/**
 * Client-side routes, read from the routing hooks that own them.
 *
 * Each `use*Routing` hook decides it is active by comparing
 * `window.location.pathname` against a literal. That literal is the route, so
 * deriving it here means a new page can't be added without this check seeing it.
 */
function spaRoutesFromHooks(): string[] {
  const routes = new Set<string>();
  for (const file of readdirSync(HOOKS_DIR)) {
    if (!/^use.*Routing\.ts$/.test(file) || file.endsWith('.test.ts')) continue;
    const src = readFileSync(join(HOOKS_DIR, file), 'utf8');
    for (const m of src.matchAll(/window\.location\.pathname === '(\/[^']*)'/g)) {
      const route = m[1].replace(/\/$/, '');
      if (route) routes.add(route);
    }
  }
  return [...routes].sort();
}

function vercelRewrites(): VercelRewrite[] {
  const config = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
    rewrites?: VercelRewrite[];
  };
  return config.rewrites ?? [];
}

/**
 * Every SPA route needs a Vercel rewrite to `/`.
 *
 * Without one, the route only works via `history.pushState` from inside the
 * app. A direct visit, a refresh, a Cmd-click, or a shared link hits Vercel,
 * finds no file, and 404s — while in-app navigation keeps working, which is
 * exactly why `/supporters` shipped broken and stayed unnoticed.
 */
const routes = spaRoutesFromHooks();
const rewrites = vercelRewrites();

describe('SPA routes are served by Vercel', () => {
  it('finds the routing hooks', () => {
    // Guards the derivation itself: if the hooks are renamed and this silently
    // returns nothing, the checks below would all vacuously pass.
    expect(routes.length).toBeGreaterThanOrEqual(3);
    expect(routes).toContain('/supporters');
  });

  it.each(routes)('%s rewrites to the SPA', (route) => {
    const rewrite = rewrites.find((r) => r.source === route);
    expect(rewrite, `vercel.json needs { "source": "${route}", "destination": "/" }`).toBeDefined();
    expect(rewrite?.destination).toBe('/');
  });
});
