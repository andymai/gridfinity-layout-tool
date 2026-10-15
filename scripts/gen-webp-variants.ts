/**
 * Writes the WebP variants content pages serve through `<picture>`:
 * `<name>-720.webp` and `<name>-1440.webp` beside each PNG in
 * public/images/landing/ that a content page references (OG-card insets are
 * left alone). Run after regenerating landing images
 * (`pnpm run gen:seo-images`). Needs `cwebp` on PATH (libwebp).
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WEBP_WIDTHS } from './contentImage';

const LANDING = resolve(process.cwd(), 'public/images/landing');
const CONTENT = resolve(process.cwd(), 'content');
// Screenshots carry small UI text; below ~80 it smears.
const QUALITY = '82';

function main(): void {
  try {
    execFileSync('cwebp', ['-version'], { stdio: 'ignore' });
  } catch {
    console.error('cwebp not found: install libwebp (for example `brew install webp`).');
    process.exit(1);
  }

  const referenced = new Set<string>();
  for (const file of readdirSync(CONTENT, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.md')) continue;
    const text = readFileSync(join(CONTENT, file), 'utf8');
    for (const match of text.matchAll(/\/images\/landing\/([\w-]+\.png)/g))
      referenced.add(match[1]);
  }
  const pngs = readdirSync(LANDING).filter((f) => referenced.has(f));
  for (const png of pngs) {
    const source = join(LANDING, png);
    for (const width of WEBP_WIDTHS) {
      const target = join(LANDING, png.replace(/\.png$/, `-${width}.webp`));
      execFileSync('cwebp', [
        '-quiet',
        '-q',
        QUALITY,
        '-resize',
        String(width),
        '0',
        source,
        '-o',
        target,
      ]);
      console.log(`${target} ${Math.round(statSync(target).size / 1024)} kB`);
    }
  }
}

main();
