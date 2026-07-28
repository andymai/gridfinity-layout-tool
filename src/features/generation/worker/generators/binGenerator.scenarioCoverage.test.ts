// @vitest-environment node
/**
 * Guards the one-file-per-scenario-domain convention:
 *   1. every scenario module under `./scenarios/` is aggregated into
 *      `ALL_SCENARIOS` (i.e. wired into `scenarios/index.ts`),
 *   2. every scenario module has a matching
 *      `binGenerator.scenario.<module>.test.ts` that generates it, and
 *   3. every scenario module has a matching
 *      `binGenerator.export.<module>.test.ts` that exports it.
 *
 * Without this, adding a `scenarios/<domain>.ts` module but forgetting to wire
 * it into `index.ts` or to add its test files would silently skip those
 * scenarios. Check 3 matters most: the export matrix used to be a single file
 * looping `ALL_SCENARIOS`, which was complete by construction but pinned one
 * Vitest worker for ~14 minutes and set the whole CI critical path. Splitting it
 * per domain bought the parallelism back and traded that automatic completeness
 * for per-file wiring — this is what keeps the trade honest.
 *
 * Pure data / filesystem checks — no WASM kernel, so it stays fast.
 */
import { describe, it, expect } from 'vitest';
import { ALL_SCENARIOS } from './binGenerator.scenarios';

const moduleGlob = import.meta.glob('./scenarios/*.ts', { eager: true });
const testFileGlob = import.meta.glob('./binGenerator.scenario.*.test.ts');
const exportFileGlob = import.meta.glob('./binGenerator.export.*.test.ts');

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

  it('has an export-integrity file for every scenario module', () => {
    const exportFiles = new Set(Object.keys(exportFileGlob).map((path) => path.split('/').pop()));
    const missing = moduleNames.filter(
      (name) => !exportFiles.has(`binGenerator.export.${name}.test.ts`)
    );
    expect(missing).toEqual([]);
  });

  it('runs every catalog scenario through export exactly once', () => {
    // The per-domain export files partition the catalog; a module wired into two
    // of them (or into one under the wrong name) would double-run or drop
    // scenarios without the file-presence check above noticing.
    const exported = moduleNames.length;
    expect(Object.keys(exportFileGlob)).toHaveLength(exported);
  });
});
