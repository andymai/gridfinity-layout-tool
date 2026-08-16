/**
 * Per-pattern kumiko coverage: one case per pattern, each asserting the lattice
 * removes material from a 1×1×6 bin against its solid-walled twin.
 *
 * Split out of the kumiko wrapping cases so the catalogue's slowest domain is
 * three test files rather than one. Vitest never parallelizes within a file, so
 * a single 200s file floored the whole generators shard regardless of sharding
 * (same reasoning as). Corner-wrap proofs live in `kumikoWrapping.ts` and
 * feature interactions in `kumikoComposition.ts`.
 */
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import type { WallPatternType } from '@/shared/types/bin';
import { ALL_SIDES_OFF } from './kumikoWrapping';
import { assertRemovesMaterial } from './wallPatterns';

/** Compact per-pattern case: valid geometry + material removed vs solid twin. */
function kumikoPatternCase(pattern: WallPatternType): ScenarioCase {
  return defineScenario('kumiko', `${pattern} carves a 1×1×6 bin`, {
    assert: 'structural',
    timeout: 180_000,
    params: {
      width: 1,
      depth: 1,
      height: 6,
      wallPattern: { enabled: true, pattern, scale: 0.5 },
      walls: ALL_SIDES_OFF,
    },
    compareWith: {
      params: {
        width: 1,
        depth: 1,
        height: 6,
        wallPattern: { enabled: false, pattern, scale: 0.5 },
        walls: ALL_SIDES_OFF,
      },
      assert: assertRemovesMaterial,
    },
  });
}

export const kumikoPatterns: ScenarioCase[] = [
  kumikoPatternCase('goma'),
  kumikoPatternCase('sakura'),
  kumikoPatternCase('rindo'),
  kumikoPatternCase('mikado'),
  kumikoPatternCase('tsumiishi-kikko'),
];
