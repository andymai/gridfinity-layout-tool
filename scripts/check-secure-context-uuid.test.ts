import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

// crypto.randomUUID is a secure-context API: absent over plain HTTP on a LAN
// address, which is how a self-hosted instance is often first opened. Adding a
// cutout, importing an STL or building an assembly threw there. generateUUID()
// falls back to getRandomValues, which every context has.
describe('crypto.randomUUID is only called through generateUUID', () => {
  const files = execFileSync('git', ['ls-files', 'src'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(
      (f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && f !== 'src/shared/utils/uuid.ts'
    );

  it('finds the source tree', () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it('has no direct caller outside src/shared/utils/uuid.ts', () => {
    const offenders: string[] = [];
    for (const file of files) {
      readFileSync(join(ROOT, file), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const code = line.trim();
          if (code.startsWith('*') || code.startsWith('//')) return;
          if (code.includes('crypto.randomUUID(')) offenders.push(`${file}:${i + 1}`);
        });
    }
    expect(offenders, 'use generateUUID() from @/shared/utils/uuid').toEqual([]);
  });
});
