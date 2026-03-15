/**
 * All bin generation scenario case definitions.
 *
 * Split into category-based files under `./scenarios/`.
 * This barrel re-exports the aggregated array and helper functions.
 *
 * Update snapshots after verified geometry changes:
 *   pnpm run test:run -- -u src/features/generation/worker/generators/binGenerator.scenario.test
 */
export { ALL_SCENARIOS } from './scenarios/index';
export type { ScenarioCase } from './scenarios/index';

import { ALL_SCENARIOS } from './scenarios/index';
import type { ScenarioCase } from './scenarios/index';

/** Get unique category names in definition order. */
export function getCategories(): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of ALL_SCENARIOS) {
    if (!seen.has(s.category)) {
      seen.add(s.category);
      result.push(s.category);
    }
  }
  return result;
}

/** Get all scenarios for a given category. */
export function getScenariosByCategory(category: string): ScenarioCase[] {
  return ALL_SCENARIOS.filter((s) => s.category === category);
}
