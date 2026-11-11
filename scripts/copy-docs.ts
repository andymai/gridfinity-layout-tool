/**
 * Post-build step: copy the user docs build (apps/docs/.vitepress/dist) into
 * dist/docs, then fail the build if the service worker precaches any of it.
 *
 * It has to run after `vite build`: that build empties dist/, and the service
 * worker's precache globs whatever dist/ holds while it runs. Docs present at
 * that point would download to every installed app.
 *
 * Usage: runs after `vite build` and `pnpm run docs:build` (see package.json "build").
 */

import fs from 'node:fs';
import path from 'node:path';
import { DOCS_PREFIX } from './contentRoutes';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const DOCS_BUILD = path.join(ROOT, 'apps', 'docs', '.vitepress', 'dist');

const MANIFEST_START = 'precacheAndRoute([';

export function precacheUrls(serviceWorker: string): string[] {
  const start = serviceWorker.indexOf(MANIFEST_START);
  if (start < 0) return [];
  // Entries are flat {url, revision} objects, so the first ] closes the array.
  const end = serviceWorker.indexOf(']', start + MANIFEST_START.length);
  if (end < 0) return [];
  const manifest = serviceWorker.slice(start + MANIFEST_START.length, end);
  return [...manifest.matchAll(/["']?url["']?\s*:\s*["']([^"']+)["']/g)].map((m) => m[1]);
}

export function docsUrls(urls: readonly string[]): string[] {
  const prefix = `${DOCS_PREFIX.slice(1)}/`;
  return urls.filter((url) => url.replace(/^\//, '').startsWith(prefix));
}

function main(): void {
  if (!fs.existsSync(path.join(DOCS_BUILD, 'index.html'))) {
    throw new Error(
      'copy-docs: apps/docs/.vitepress/dist/index.html not found. Run docs:build first.'
    );
  }
  const swPath = path.join(DIST, 'sw.js');
  if (!fs.existsSync(swPath)) {
    throw new Error('copy-docs: dist/sw.js not found. Run vite build first.');
  }

  const target = path.join(DIST, DOCS_PREFIX.slice(1));
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(DOCS_BUILD, target, { recursive: true });
  console.log(`✓ Copied the docs build to dist${DOCS_PREFIX}`);

  const urls = precacheUrls(fs.readFileSync(swPath, 'utf8'));
  // index.html is always precached, so a list without it means the parser no
  // longer reads the manifest, and the check below would pass on nothing.
  if (!urls.includes('index.html')) {
    throw new Error('copy-docs: could not read the precache manifest in dist/sw.js');
  }
  const leaked = docsUrls(urls);
  if (leaked.length > 0) {
    throw new Error(
      `copy-docs: the service worker precaches docs files: ${leaked.join(', ')}. ` +
        'The docs must reach dist/ only after vite build.'
    );
  }
  console.log(`✓ Precache manifest has ${urls.length} entries and none under ${DOCS_PREFIX}/`);
}

if (process.argv[1]?.endsWith('copy-docs.ts')) main();
