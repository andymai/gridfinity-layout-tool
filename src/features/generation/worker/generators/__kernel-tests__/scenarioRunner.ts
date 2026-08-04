/**
 * Shared bin-generation scenario runner.
 *
 * Each domain test file (`binGenerator.scenario.<module>.test.ts`) imports the
 * matching scenario module from `./scenarios/` and passes its cases here. This
 * keeps one test file per scenario domain so Vitest runs them on separate
 * workers in parallel (the categories used to share one ~370s file), and makes
 * placement obvious: a scenario lives in `scenarios/<domain>.ts` and runs in
 * `binGenerator.scenario.<domain>.test.ts`.
 *
 * Update snapshots after verified geometry changes (whole domain or one file):
 *   pnpm exec vitest run src/features/generation/worker/generators/binGenerator.scenario.handles -u
 *
 * Put the filter BEFORE `-u`. Two separate ways to lose it, both silent:
 *   1. A bare `-u`/`--update` consumes the NEXT token as its value, so
 *      `-u <path>` leaves no filter and runs all ~1550 files. Verified on
 *      vitest 4.1.10: `vitest list -u <path>` enumerates the whole project,
 *      while `vitest list --update=true <path>` lists just that file — so
 *      `--update=true <path>` is the other safe form.
 *   2. Routing through `pnpm run <script> -- ...` puts a literal `--` in the
 *      vitest argv; everything after it is read as a positional filter and the
 *      `-u` is ignored outright (b2ee64e5, #1329, same trap with --shard).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { assertKernelReturnedGeometry, assertStructurallyValid } from './meshAssertions';
import { printTimingTable } from './reportTable';
import type { TimingEntry } from './reportTable';
import { buildParams } from './scenarioTypes';
import type { ScenarioCase } from './scenarioTypes';

function runScenario(scenario: ScenarioCase, timings: TimingEntry[]): void {
  const generateBin = getGenerateBin();
  const fullParams = buildParams(scenario.params);
  const start = performance.now();
  try {
    const result = generateBin(fullParams, undefined, scenario.forExport);

    if (scenario.assert === 'snapshot') {
      // Before the snapshot, never after: a kernel that returned nothing must
      // report itself as a kernel failure, not as a triangle-count diff against
      // the baseline (#3184). This also keeps a zero out of the baseline under
      // `-u`, which would bake the failure in.
      assertKernelReturnedGeometry(result, scenario.name);
      // Triangle counts are kernel-specific (each kernel tessellates to its
      // own density). The vitest config's `resolveSnapshotPath` routes each
      // non-default kernel to its own `.<kernel>.snap` file, so occt-wasm and
      // brepkit pin separate baselines instead of sharing one that only the
      // default kernel can match. See vitest.config.ts.
      expect(result.triangleCount).toMatchSnapshot();
    } else {
      assertStructurallyValid(result, scenario.name);
    }

    if (scenario.compareWith) {
      const compareParams = buildParams(scenario.compareWith.params);
      const compareResult = generateBin(compareParams, undefined, scenario.compareWith.forExport);
      // The comparison arm is a generated mesh too, and an empty one makes any
      // "removed material" / "differs from" assertion trivially true.
      assertKernelReturnedGeometry(compareResult, `${scenario.name} (comparison)`);
      scenario.compareWith.assert(result, compareResult);
    }

    if (scenario.customAssert) {
      scenario.customAssert(result, fullParams);
    }

    timings.push({
      name: scenario.name,
      category: scenario.category,
      triangleCount: result.triangleCount,
      timeMs: performance.now() - start,
      passed: true,
    });
  } catch (error: unknown) {
    timings.push({
      name: scenario.name,
      category: scenario.category,
      triangleCount: 0,
      timeMs: performance.now() - start,
      passed: false,
    });
    throw error;
  }
}

/**
 * Register suites for the given scenarios, grouped into one `describe` per
 * category (so snapshot keys stay `<category> > <name>`). Call once at the top
 * level of a domain test file.
 */
export function runScenarios(scenarios: readonly ScenarioCase[]): void {
  const timings: TimingEntry[] = [];

  beforeAll(async () => {
    await initBrepjs();
  }, 30_000);

  afterAll(() => {
    printTimingTable(timings);
  });

  const byCategory = new Map<string, ScenarioCase[]>();
  for (const scenario of scenarios) {
    const existing = byCategory.get(scenario.category);
    if (existing) existing.push(scenario);
    else byCategory.set(scenario.category, [scenario]);
  }

  for (const [category, cases] of byCategory) {
    describe(category, () => {
      for (const scenario of cases) {
        it(
          scenario.name,
          () => {
            runScenario(scenario, timings);
          },
          scenario.timeout
        );
      }
    });
  }
}
