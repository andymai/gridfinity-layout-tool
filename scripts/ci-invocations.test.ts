import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

/**
 * `pnpm run <script> -- --flag` forwards the `--` literally. A shell gate that
 * treats an unrecognised argument as a filename then "checks" one nonexistent
 * path and exits 0, so the job stays green while asserting nothing. CI ran
 * `check:exhaustiveness -- --all` that way: 1 file instead of 2,382.
 *
 * The scripts now reject a bare `--`, so this would fail loudly rather than
 * silently. This test is the earlier warning.
 */
describe('CI command invocations', () => {
  const workflows = ['ci.yml', 'pr-title.yml']
    .map((f) => join(ROOT, '.github/workflows', f))
    .flatMap((p) => {
      try {
        return [readFileSync(p, 'utf8')];
      } catch {
        return [];
      }
    });

  it('never separates pnpm script args with `--`', () => {
    const offenders = workflows.flatMap((text) =>
      text.split('\n').filter((l) => /pnpm run [a-z:0-9_-]+ -- /.test(l))
    );
    expect(offenders).toEqual([]);
  });

  it('passes --all to the exhaustiveness check so it does not run staged-only', () => {
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    const line = ci.split('\n').find((l) => l.includes('check:exhaustiveness'));
    expect(line).toBeDefined();
    expect(line).toContain('--all');
    expect(line).not.toMatch(/-- --all/);
  });
});
