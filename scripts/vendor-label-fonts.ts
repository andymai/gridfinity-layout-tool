/**
 * Copy the unicode-font-resolver data that troika-three-text falls back to for
 * 3D labels into public/, so no label fetches a font from a third-party CDN.
 *
 *   pnpm exec tsx scripts/vendor-label-fonts.ts
 *
 * Bin names show on the layout preview in whatever script the user typed, so
 * every font is kept. Each keeps only the one file troika asks for: no label
 * sets a weight or a style, which troika sends as weight 400, style normal.
 */

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { LABEL_FONT_DATA_PATH } from '../src/shared/webgl/labelFontData';

const REPO = 'https://github.com/lojjic/unicode-font-resolver.git';
// Tag v1.0.1, the dataset troika-three-text 0.52 defaults to.
const COMMIT = '4faa2778f9a5cefa04cc2295849fbd1f6fb50919';
const DATA = 'packages/data';
// `font-files/LICENSE` is the fonts' OFL, which has to travel with them.
const COPIED_WHOLE = [
  'codepoint-index',
  'font-meta',
  'LICENSE',
  'font-files/LICENSE',
  'schema-version.json',
];

export const VENDORED_DIR = join('public', LABEL_FONT_DATA_PATH);

type Typeforms = Record<string, Record<string, number[]>>;

export interface FontMeta {
  readonly id: string;
  readonly typeforms: Typeforms;
}

function pick<T>(options: Record<string, T>, wanted: string): string {
  if (wanted in options) return wanted;
  const [first] = Object.keys(options);
  if (first === undefined) throw new Error('font meta lists no typeforms');
  return first;
}

function nearest(weights: readonly number[], wanted: number): number {
  if (weights.includes(wanted)) return wanted;
  return weights.reduce((best, w) => (Math.abs(w - wanted) < Math.abs(best - wanted) ? w : best));
}

/**
 * The file the resolver client requests for `meta` at sans-serif, normal, 400.
 */
export function fallbackFontFile(meta: FontMeta): string {
  const category = pick(meta.typeforms, 'sans-serif');
  const styles = meta.typeforms[category];
  const style = pick(styles, 'normal');
  const weight = nearest(styles[style], 400);
  return `font-files/${meta.id}/${category}.${style}.${weight}.woff`;
}

export function readFontMeta(file: string): FontMeta {
  try {
    const [, meta] = JSON.parse(readFileSync(file, 'utf8')) as [number, FontMeta];
    return meta;
  } catch (cause) {
    throw new Error(`Cannot read font meta ${file}`, { cause });
  }
}

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'inherit' });
}

function main(): void {
  const work = mkdtempSync(join(tmpdir(), 'label-fonts-'));
  try {
    git(work, 'init', '--quiet');
    git(work, 'remote', 'add', 'origin', REPO);
    git(
      work,
      'sparse-checkout',
      'set',
      '--no-cone',
      ...COPIED_WHOLE.map((entry) => `/${DATA}/${entry}`)
    );
    git(work, 'fetch', '--quiet', '--depth=1', '--filter=blob:none', 'origin', COMMIT);
    git(work, 'checkout', '--quiet', COMMIT);

    const metaDir = join(work, DATA, 'font-meta');
    const files = readdirSync(metaDir).map((name) =>
      fallbackFontFile(readFontMeta(join(metaDir, name)))
    );
    git(work, 'sparse-checkout', 'add', ...files.map((file) => `/${DATA}/${file}`));

    rmSync(VENDORED_DIR, { recursive: true, force: true });
    mkdirSync(VENDORED_DIR, { recursive: true });
    for (const entry of COPIED_WHOLE) {
      mkdirSync(dirname(join(VENDORED_DIR, entry)), { recursive: true });
      cpSync(join(work, DATA, entry), join(VENDORED_DIR, entry), { recursive: true });
    }
    for (const file of files) {
      mkdirSync(dirname(join(VENDORED_DIR, file)), { recursive: true });
      copyFileSync(join(work, DATA, file), join(VENDORED_DIR, file));
    }
    console.info(`Vendored ${files.length} fonts into ${VENDORED_DIR}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1]?.endsWith('vendor-label-fonts.ts')) main();
