/**
 * Kumiko wrapped-lattice wall pattern scenarios (mitsukude).
 *
 * The wrapped path is asserted two ways:
 *   - volume: the lattice must remove material vs the solid-walled twin
 *     (`assertRemovesMaterial`, shared with the stamp pattern scenarios)
 *   - wrap proof: the CORNER regions must gain mesh complexity vs the solid
 *     twin — flat-panel-only output leaves corners untouched, so a corner
 *     vertex-count ratio distinguishes a real wrap from the fallback.
 *
 * Volume/structural assertions are used instead of triangleCount snapshots —
 * robust to tessellation drift (see wallPatterns.ts).
 */
import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import type { MeshData } from '@/features/generation/bridge/types';
import type { WallPatternType } from '@/shared/types/bin';
import { assertRemovesMaterial } from './wallPatterns';

const ALL_SIDES_OFF = {
  ...DEFAULT_BIN_PARAMS.walls,
  enabled: false,
  front: DISABLED_WALL_CUTOUT,
  back: DISABLED_WALL_CUTOUT,
  left: DISABLED_WALL_CUTOUT,
  right: DISABLED_WALL_CUTOUT,
  interior: DISABLED_WALL_CUTOUT,
} as const;

/**
 * Count mesh vertices inside the four corner regions above the socket
 * (z > 12mm clears socket + bottom keep-out on h ≥ 4 bins).
 */
function countCornerVertices(mesh: MeshData, widthU: number, depthU: number): number {
  const outerW = widthU * 42 - 0.5;
  const outerD = depthU * 42 - 0.5;
  const r = 3.75;
  const xEdge = outerW / 2 - r;
  const yEdge = outerD / 2 - r;
  const { vertices } = mesh;
  let count = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i] ?? 0;
    const y = vertices[i + 1] ?? 0;
    const z = vertices[i + 2] ?? 0;
    if (z < 12) continue;
    if (Math.abs(x) > xEdge && Math.abs(y) > yEdge) count++;
  }
  return count;
}

/** The wrap must open the corners: corner mesh complexity grows vs solid. */
function assertCornersWrapped(widthU: number, depthU: number) {
  return (patterned: MeshData, solid: MeshData): void => {
    assertRemovesMaterial(patterned, solid);
    const patternedCorners = countCornerVertices(patterned, widthU, depthU);
    const solidCorners = countCornerVertices(solid, widthU, depthU);
    expect(
      patternedCorners,
      `corners look untouched (patterned=${patternedCorners}, solid=${solidCorners}) — lattice did not wrap`
    ).toBeGreaterThan(solidCorners * 2);
  };
}

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

export const kumiko: ScenarioCase[] = [
  kumikoPatternCase('goma'),
  defineScenario('kumiko', 'asanoha wraps a 1×1×6 bin including corners', {
    assert: 'structural',
    timeout: 180_000,
    params: {
      width: 1,
      depth: 1,
      height: 6,
      wallPattern: { enabled: true, pattern: 'asanoha', scale: 0.5 },
      walls: ALL_SIDES_OFF,
    },
    compareWith: {
      params: {
        width: 1,
        depth: 1,
        height: 6,
        wallPattern: { enabled: false, pattern: 'asanoha', scale: 0.5 },
        walls: ALL_SIDES_OFF,
      },
      assert: assertCornersWrapped(1, 1),
    },
  }),
  kumikoPatternCase('sakura'),
  kumikoPatternCase('rindo'),
  kumikoPatternCase('mikado'),
  kumikoPatternCase('tsumiishi-kikko'),
  defineScenario('kumiko', 'mitsukude wraps a 1×1×6 bin including corners', {
    assert: 'structural',
    timeout: 180_000,
    params: {
      width: 1,
      depth: 1,
      height: 6,
      wallPattern: { enabled: true, pattern: 'mitsukude', scale: 0.5 },
      walls: ALL_SIDES_OFF,
    },
    compareWith: {
      params: {
        width: 1,
        depth: 1,
        height: 6,
        wallPattern: { enabled: false, pattern: 'mitsukude', scale: 0.5 },
        walls: ALL_SIDES_OFF,
      },
      assert: assertCornersWrapped(1, 1),
    },
  }),
  defineScenario('kumiko', 'mitsukude carves 3×3×5 walls', {
    assert: 'structural',
    timeout: 180_000,
    params: {
      width: 3,
      depth: 3,
      height: 5,
      wallPattern: { enabled: true, pattern: 'mitsukude', scale: 0.5 },
      walls: ALL_SIDES_OFF,
    },
    compareWith: {
      params: {
        width: 3,
        depth: 3,
        height: 5,
        wallPattern: { enabled: false, pattern: 'mitsukude', scale: 0.5 },
        walls: ALL_SIDES_OFF,
      },
      assert: assertRemovesMaterial,
    },
  }),
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
