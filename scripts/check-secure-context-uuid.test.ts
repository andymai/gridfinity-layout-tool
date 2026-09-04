import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const HELPER = 'shared/utils/uuid.ts';

// crypto.randomUUID is a secure-context API: absent over plain HTTP on a LAN
// address, which is how a self-hosted instance is often first opened. Adding a
// cutout, importing an STL or building an assembly threw there. generateUUID()
// falls back to getRandomValues, which every context has.
//
// The walk uses the filesystem rather than git so the suite runs in a tarball
// or a container, and the match is the bare identifier on comment-stripped
// source, so destructuring, bracket access and line breaks cannot slip past.
describe('randomUUID is only reached through generateUUID', () => {
  const files = readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' })
    .map((f) => f.split(sep).join('/'))
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && f !== HELPER);

  it('finds the source tree', () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it('has no direct caller outside the helper', () => {
    const offenders = files.filter((file) => {
      const source = readFileSync(join(ROOT, 'src', file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      return /\brandomUUID\b/.test(source);
    });
    expect(offenders, 'use generateUUID() from @/shared/utils/uuid').toEqual([]);
  });
});
