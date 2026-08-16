/**
 * Kumiko composed with other bin features: wall cutouts, handles, compartment
 * dividers, magnet bases and asymmetric overhang.
 *
 * Split out of the kumiko wrapping cases so the catalogue's slowest domain is
 * three test files rather than one. Vitest never parallelizes within a file, so
 * a single 200s file floored the whole generators shard regardless of sharding
 * (same reasoning as). Per-pattern coverage lives in `kumikoPatterns.ts`
 * and corner-wrap proofs in `kumikoWrapping.ts`.
 */
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { ALL_SIDES_OFF } from './kumikoWrapping';

export const kumikoComposition: ScenarioCase[] = [
  defineScenario('kumiko', 'mitsukude composes with a front wall cutout', {
    assert: 'structural',
    timeout: 180_000,
    params: {
      width: 2,
      depth: 1,
      height: 6,
      wallPattern: { enabled: true, pattern: 'mitsukude', scale: 0.5 },
      walls: {
        ...ALL_SIDES_OFF,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 60, depth: 50 },
      },
    },
  }),
  defineScenario('kumiko', 'mitsukude composes with handles', {
    assert: 'structural',
    timeout: 180_000,
    params: {
      width: 2,
      depth: 1,
      height: 6,
      wallPattern: { enabled: true, pattern: 'mitsukude', scale: 0.5 },
      walls: ALL_SIDES_OFF,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: { ...DEFAULT_BIN_PARAMS.handles.front, enabled: true },
      },
    },
  }),
  defineScenario('kumiko', 'mitsukude composes with 2×2 compartment dividers', {
    assert: 'structural',
    timeout: 180_000,
    params: {
      width: 2,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'mitsukude', scale: 0.5 },
      walls: ALL_SIDES_OFF,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    },
  }),
  defineScenario('kumiko', 'mitsukude on a half-grid 1.5×1×6 bin with magnets', {
    assert: 'structural',
    timeout: 180_000,
    params: {
      width: 1.5,
      depth: 1,
      height: 6,
      wallPattern: { enabled: true, pattern: 'mitsukude', scale: 0.5 },
      walls: ALL_SIDES_OFF,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' },
    },
  }),
  defineScenario('kumiko', 'mitsukude with asymmetric overhang', {
    assert: 'structural',
    timeout: 180_000,
    params: {
      width: 2,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'mitsukude', scale: 0.5 },
      walls: ALL_SIDES_OFF,
      overhang: { ...DEFAULT_BIN_PARAMS.overhang, left: 4, right: 0, front: 2, back: 0 },
    },
  }),
];
