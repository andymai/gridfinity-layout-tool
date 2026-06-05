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
 *   pnpm run test:run -- -u src/features/generation/worker/generators/binGenerator.scenario.handles
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { assertStructurallyValid } from './meshAssertions';
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
      expect(result.vertices.length).toBeGreaterThan(0);
      expect(result.triangleCount).toBeGreaterThan(0);
      expect(result.triangleCount).toMatchSnapshot();
    } else {
      assertStructurallyValid(result, scenario.name);
    }

    if (scenario.compareWith) {
      const compareParams = buildParams(scenario.compareWith.params);
      const compareResult = generateBin(compareParams, undefined, scenario.compareWith.forExport);
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
