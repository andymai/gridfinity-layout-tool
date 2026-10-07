import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

const sourceFiles = readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' })
  .map((f) => f.split(sep).join('/'))
  .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f));

function callersOutside(helper: string, pattern: RegExp): string[] {
  return sourceFiles.filter((file) => {
    if (file === helper) return false;
    const source = readFileSync(join(ROOT, 'src', file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    return pattern.test(source);
  });
}

// crypto.randomUUID is a secure-context API: absent over plain HTTP on a LAN
// address, which is how a self-hosted instance is often first opened. Adding a
// cutout, importing an STL or building an assembly threw there. generateUUID()
// falls back to getRandomValues, which every context has.
//
// The walk uses the filesystem rather than git so the suite runs in a tarball
// or a container, and the match is the bare identifier on comment-stripped
// source, so destructuring, bracket access and line breaks cannot slip past.
describe('randomUUID is only reached through generateUUID', () => {
  it('finds the source tree', () => {
    expect(sourceFiles.length).toBeGreaterThan(500);
  });

  it('has no direct caller outside the helper', () => {
    expect(
      callersOutside('shared/utils/uuid.ts', /\brandomUUID\b/),
      'use generateUUID() from @/shared/utils/uuid'
    ).toEqual([]);
  });
});

// crypto.subtle is missing in the same contexts, and naming a mesh file there
// would otherwise fail every STL import and stored design. "subtle" is also a
// common design-token word, so the match is the member, bracket and
// destructured forms rather than the bare identifier.
describe('crypto.subtle is only reached through sha256Hex', () => {
  it('has no direct caller outside the helper', () => {
    expect(
      callersOutside(
        'shared/generation/sha256.ts',
        /\.\s*subtle\b|\[\s*['"]subtle['"]\s*\]|[{,]\s*subtle\s*[,}]/
      ),
      'hash through sha256Hex() from @/shared/generation/sha256'
    ).toEqual([]);
  });
});
