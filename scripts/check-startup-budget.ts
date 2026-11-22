/**
 * Post-build check: fail when the JS that dist/index.html loads at startup
 * passes the "startupBudget" limits in package.json. Startup JS is the entry
 * script plus every modulepreload link, which is what the browser fetches
 * before first paint.
 *
 * The file count is a cost limit, not only a speed limit: Vercel bills each
 * request, so every startup file is one more billed request on each first
 * visit. The startup groups in vite.config.ts keep the count low.
 *
 * Usage: runs after `vite build` (see package.json "size" and "size:check").
 */

import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

export interface StartupBudget {
  readonly gzipKb: number;
  readonly files: number;
}

function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1];
}

export function startupFiles(html: string): string[] {
  const files: string[] = [];
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    const src = attribute(tag, 'src');
    if (attribute(tag, 'type') === 'module' && src) files.push(src);
  }
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const href = attribute(tag, 'href');
    if (attribute(tag, 'rel') === 'modulepreload' && href) files.push(href);
  }
  return [...new Set(files.map((file) => file.replace(/^\//, '')))];
}

export function budgetErrors(
  measured: { readonly gzipBytes: number; readonly files: number },
  budget: StartupBudget
): string[] {
  const errors: string[] = [];
  if (measured.files > budget.files) {
    errors.push(`${measured.files} startup JS files, over the limit of ${budget.files}`);
  }
  if (measured.gzipBytes > budget.gzipKb * 1000) {
    errors.push(
      `${(measured.gzipBytes / 1000).toFixed(1)} kB of startup JS (gzip), over the limit of ${budget.gzipKb} kB`
    );
  }
  return errors;
}

function main(): void {
  const root = process.cwd();
  const html = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
  const files = startupFiles(html);
  // The entry script is always there, so an empty list means the parser no
  // longer reads index.html, and the limits below would pass on nothing.
  if (files.length === 0) {
    throw new Error('check-startup-budget: found no module script in dist/index.html');
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    startupBudget: StartupBudget;
  };
  const gzipBytes = files.reduce(
    (sum, file) =>
      sum + gzipSync(fs.readFileSync(path.join(root, 'dist', file)), { level: 9 }).length,
    0
  );
  const measured = { gzipBytes, files: files.length };
  const errors = budgetErrors(measured, pkg.startupBudget);
  const summary =
    `${measured.files} files (limit ${pkg.startupBudget.files}), ` +
    `${(gzipBytes / 1000).toFixed(1)} kB gzip (limit ${pkg.startupBudget.gzipKb} kB)`;
  if (errors.length > 0) {
    console.error(`✗ Startup JS: ${summary}`);
    for (const error of errors) console.error(`  - ${error}`);
    console.error(
      '  Keep new code out of the startup graph with a dynamic import, or check the startup groups in vite.config.ts.'
    );
    process.exit(1);
  }
  console.log(`✓ Startup JS: ${summary}`);
}

if (process.argv[1]?.endsWith('check-startup-budget.ts')) main();
