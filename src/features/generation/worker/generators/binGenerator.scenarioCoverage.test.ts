// @vitest-environment node
/**
 * Guards the one-file-per-scenario-domain convention:
 *   1. every scenario module under `./scenarios/` is aggregated into
 *      `ALL_SCENARIOS` (i.e. wired into `scenarios/index.ts`), and
 *   2. every scenario module has a matching
 *      `binGenerator.scenario.<module>.test.ts` that runs it.
 *
 * Without this, adding a `scenarios/<domain>.ts` module but forgetting to wire
 * it into `index.ts` or to add its test file would silently skip those
 * scenarios. Pure data / filesystem checks — no WASM kernel, so it stays fast.
 */
import { describe, it, expect } from 'vitest';
import { ALL_SCENARIOS } from './binGenerator.scenarios';

const moduleGlob = import.meta.glob('./scenarios/*.ts', { eager: true });
const testFileGlob = import.meta.glob('./binGenerator.scenario.*.test.ts');

function moduleName(path: string): string {
  return path.split('/').pop()?.replace(/\.ts$/, '') ?? '';
}

describe('binGenerator scenario domain coverage', () => {
  const moduleNames = Object.keys(moduleGlob)
    .map(moduleName)
    .filter((name) => name !== 'index');

  it('aggregates every scenario module into ALL_SCENARIOS', () => {
    const fromModules = Object.entries(moduleGlob)
      .filter(([path]) => moduleName(path) !== 'index')
      .flatMap(([, mod]) =>
        Object.values(mod as Record<string, unknown>)
          .filter((value): value is unknown[] => Array.isArray(value))
          .flat()
      );
    expect(new Set(fromModules)).toEqual(new Set(ALL_SCENARIOS));
  });

  it('has a domain test file for every scenario module', () => {
    const testFiles = new Set(Object.keys(testFileGlob).map((path) => path.split('/').pop()));
    const missing = moduleNames.filter(
      (name) => !testFiles.has(`binGenerator.scenario.${name}.test.ts`)
    );
    expect(missing).toEqual([]);
  });
});
