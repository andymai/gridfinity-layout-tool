import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = join(__dirname, '../..');

/** A project missing from main's command runs nowhere, and nothing else fails. */
describe('CI runs every vitest project', () => {
  const config = readFileSync(join(ROOT, 'vitest.config.ts'), 'utf8');
  const workflow = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');

  const declaredProjects = [...config.matchAll(/^\s+name: '([a-z-]+)',$/gm)].map((m) => m[1]);
  const mainCommand = workflow.split('\n').find((l) => l.includes('vitest run --coverage')) ?? '';

  it('declares the projects this guard expects', () => {
    expect(declaredProjects).toEqual(
      expect.arrayContaining(['unit', 'dom', 'generators', 'generators-heavy', 'integration'])
    );
  });

  // `integration` needs a Redis service and runs as its own job.
  it.each(declaredProjects.filter((p) => p !== 'integration'))(
    'main runs the %s project',
    (project) => {
      expect(mainCommand).toContain(`--project=${project}`);
    }
  );
});
