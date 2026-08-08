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

  // The derivation above only sees literal pathname comparisons. The
  // community detail deep link is matched by regex in useCommunityRouting.ts,
  // so its parameterized rewrite has to be asserted by hand here.
  // It resolves to api/community/page rather than straight to the SPA: that
  // handler serves the same shell with the design's own title and social image
  // injected, and falls back to the unmodified shell on any failure, so the
  // route still boots the SPA either way.
  it('/community/d/:id resolves to the meta-injecting shell handler', () => {
    const source = '/community/d/:id([a-zA-Z0-9]{12})';
    const rewrite = rewrites.find((r) => r.source === source);
    expect(rewrite, `vercel.json needs a rewrite for "${source}"`).toBeDefined();
    // :id, not $id. Vercel interpolates named parameters with the colon form
    // used by every other rewrite in the file; $id would arrive literally,
    // fail the handler's id check, and silently serve the generic shell for
    // every design — the feature would ship doing nothing.
    expect(rewrite?.destination).toBe('/api/community/page?id=:id');
  });

  it('no rewrite destination uses $param interpolation', () => {
    // Vercel substitutes :name, not $name. A $ reference is passed through
    // literally, so the handler receives the placeholder as the value — which
    // fails silently rather than erroring, and is invisible until someone
    // notices the feature never worked.
    const dollarRefs = rewrites.filter((r) => /\$[A-Za-z_]\w*/.test(r.destination));
    expect(dollarRefs.map((r) => `${r.source} -> ${r.destination}`)).toEqual([]);
  });
});
