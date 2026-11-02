/**
 * Every file the app saves has to pass through deliverExport, or it skips the
 * user's export destination. The one anchor download left is the primitive
 * deliverExport itself falls back to.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PRIMITIVE = join('src', 'shared', 'generation', 'exportUtils.ts');
const DOWNLOAD_ANCHOR = /\.download\s*=|setAttribute\(\s*['"]download['"]|<a\b[^>]*\sdownload\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.(test|testUtils|visual)\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('download routing', () => {
  it('builds a download anchor in exactly one place', () => {
    const offenders = sourceFiles('src').filter(
      (path) => path !== PRIMITIVE && DOWNLOAD_ANCHOR.test(readFileSync(path, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });

  it('recognises every way to mark an anchor as a download', () => {
    expect(DOWNLOAD_ANCHOR.test('a.download = name;')).toBe(true);
    expect(DOWNLOAD_ANCHOR.test("a.setAttribute('download', name);")).toBe(true);
    expect(DOWNLOAD_ANCHOR.test('<a href={url} download={name}>')).toBe(true);
    expect(DOWNLOAD_ANCHOR.test('<a href={url} download>')).toBe(true);
    expect(DOWNLOAD_ANCHOR.test('const downloaded = await save();')).toBe(false);
    expect(DOWNLOAD_ANCHOR.test('<Button onClick={save}>Download STL</Button>')).toBe(false);
  });

  it('calls the plain download primitive only from deliverExport', () => {
    const callers = sourceFiles('src').filter(
      (path) => path !== PRIMITIVE && /\btriggerDownload\(/.test(readFileSync(path, 'utf8'))
    );
    expect(callers).toEqual([join('src', 'shared', 'exportDestination', 'deliverExport.ts')]);
  });
});
