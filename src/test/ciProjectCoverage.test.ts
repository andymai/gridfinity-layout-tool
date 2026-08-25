import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = join(__dirname, '../..');

/** A project missing from main's command runs nowhere, and nothing else fails. */
describe('CI runs every vitest project', () => {
  const config = readFileSync(join(ROOT, 'vitest.config.ts'), 'utf8');
  const workflow = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');

  const declaredProjects = [...config.matchAll(/^\s+name: '([^']+)',$/gm)].map((m) => m[1]);
  const mainCommand = workflow.split('\n').find((l) => l.includes('vitest run --coverage')) ?? '';
  // Parsed into exact flags rather than substring-matched: `--project=generators`
  // is a prefix of `--project=generators-heavy`, so `toContain` would call the
  // regular suite present when only the heavy one is.
  const runProjects = new Set([...mainCommand.matchAll(/--project=(\S+)/g)].map((m) => m[1]));

  it('declares the projects this guard expects', () => {
    expect(declaredProjects).toEqual(
      expect.arrayContaining(['unit', 'dom', 'generators', 'generators-heavy', 'integration'])
    );
  });

  // `integration` needs a Redis service and runs as its own job.
  it.each(declaredProjects.filter((p) => p !== 'integration'))(
    'main runs the %s project',
    (project) => {
      expect(runProjects).toContain(project);
    }
  );
});
