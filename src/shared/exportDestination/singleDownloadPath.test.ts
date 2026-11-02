/**
 * Every file the app saves has to pass through deliverExport, or it skips the
 * user's export destination. The one anchor download left is the primitive
 * deliverExport itself falls back to.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PRIMITIVE = join('src', 'shared', 'generation', 'exportUtils.ts');

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
      (path) => path !== PRIMITIVE && /\.download\s*=/.test(readFileSync(path, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });

  it('calls the plain download primitive only from deliverExport', () => {
    const callers = sourceFiles('src').filter(
      (path) => path !== PRIMITIVE && /\btriggerDownload\(/.test(readFileSync(path, 'utf8'))
    );
    expect(callers).toEqual([join('src', 'shared', 'exportDestination', 'deliverExport.ts')]);
  });
});
