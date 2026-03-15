/**
 * Unified bin generation scenario test runner.
 *
 * Consumes scenario definitions from `binGenerator.scenarios.ts` and runs
 * them with appropriate assertion modes (snapshot, structural, comparison).
 *
 * Update snapshots after verified geometry changes:
 *   pnpm run test:run -- -u src/features/generation/worker/generators/binGenerator.scenario.test
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__dual-kernel__/wasmInit';
import { assertStructurallyValid } from './__dual-kernel__/meshAssertions';
import { printTimingTable } from './__dual-kernel__/reportTable';
import type { TimingEntry } from './__dual-kernel__/reportTable';
import { buildParams } from './__dual-kernel__/scenarioTypes';
import type { ScenarioCase } from './__dual-kernel__/scenarioTypes';
import { getCategories, getScenariosByCategory } from './binGenerator.scenarios';

// ─── Setup ───────────────────────────────────────────────────────────────────

const timings: TimingEntry[] = [];

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

afterAll(() => {
  printTimingTable(timings);
});

// ─── Runner ──────────────────────────────────────────────────────────────────

function runScenario(scenario: ScenarioCase): void {
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

// ─── Test generation ─────────────────────────────────────────────────────────

for (const category of getCategories()) {
  describe(category, () => {
    for (const scenario of getScenariosByCategory(category)) {
      it(
        scenario.name,
        () => {
          runScenario(scenario);
        },
        scenario.timeout
      );
    }
  });
}
