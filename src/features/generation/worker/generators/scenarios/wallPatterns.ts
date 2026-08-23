/**
 * Wall pattern generation scenarios (round, diamond, triangle, slots) + scale.
 *
 * Each new pattern must actually carve the walls on the active kernel: the
 * generated mesh is structurally valid and encloses LESS volume than the same
 * bin with solid walls (material removed). Volume is robust to per-CPU
 * tessellation drift, unlike exact triangle counts, so these use `structural`
 * assertions + a volume comparison rather than snapshots.
 */
import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT, GRIDFINITY } from '@/shared/constants/bin';
import { countWallVerticesInZone } from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import type { MeshData } from '@/features/generation/bridge/types';
import type { WallPatternType } from '@/shared/types/bin';

/** Enclosed (solid) volume of a triangle mesh via the signed-tetrahedron sum. */
function meshVolume({ vertices, indices }: MeshData): number {
  let v = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = (indices[i] ?? 0) * 3;
    const b = (indices[i + 1] ?? 0) * 3;
    const c = (indices[i + 2] ?? 0) * 3;
    const ax = vertices[a] ?? 0,
      ay = vertices[a + 1] ?? 0,
      az = vertices[a + 2] ?? 0;
    const bx = vertices[b] ?? 0,
      by = vertices[b + 1] ?? 0,
      bz = vertices[b + 2] ?? 0;
    const cx = vertices[c] ?? 0,
      cy = vertices[c + 1] ?? 0,
      cz = vertices[c + 2] ?? 0;
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return Math.abs(v) / 6;
}

const ALL_SIDES_OFF = {
  ...DEFAULT_BIN_PARAMS.walls,
  enabled: false,
  front: DISABLED_WALL_CUTOUT,
  back: DISABLED_WALL_CUTOUT,
  left: DISABLED_WALL_CUTOUT,
  right: DISABLED_WALL_CUTOUT,
  interior: DISABLED_WALL_CUTOUT,
} as const;

/** A pattern must remove wall material vs the solid-walled equivalent. */
export function assertRemovesMaterial(patterned: MeshData, solid: MeshData): void {
  const solidVol = meshVolume(solid);
  const patternedVol = meshVolume(patterned);
  expect(
    patternedVol,
    'wall pattern did not reduce enclosed volume — walls may not be carved'
  ).toBeLessThan(solidVol * 0.999);
}

function patternCase(pattern: WallPatternType, scale = 0.5): ScenarioCase {
  return defineScenario('wall patterns', `${pattern} carves 3×3×5 walls (scale ${scale})`, {
    params: {
      width: 3,
      depth: 3,
      height: 5,
      wallPattern: { enabled: true, pattern, scale },
      walls: ALL_SIDES_OFF,
    },
    assert: 'structural',
    compareWith: {
      params: {
        width: 3,
        depth: 3,
        height: 5,
        wallPattern: { enabled: false, pattern, scale },
        walls: ALL_SIDES_OFF,
      },
      assert: assertRemovesMaterial,
    },
  });
}

/**
 * Per-side selection: the pattern must land on the picked wall and
 * leave the others solid. Asserted on vertex density in the pattern band rather
 * than volume — volume alone can't tell one carved wall from four sparse ones.
 * With all four selected the front count drops to ~1/4 of this, so the ratio
 * catches a filter that silently stops filtering.
 */
function frontOnlyCase(): ScenarioCase {
  const outerW = 3 * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = outerW;
  const params = {
    width: 3,
    depth: 3,
    height: 5,
    wallPattern: {
      enabled: true,
      pattern: 'honeycomb' as const,
      sides: { left: false, right: false, front: true, back: false },
    },
    walls: ALL_SIDES_OFF,
  };

  return defineScenario('wall patterns', 'front-only selection carves only the front wall', {
    params,
    assert: 'structural',
    customAssert: (result) => {
      // Mid-band of the pattern zone on a 35mm-tall bin — comfortably inside
      // the keep-outs at both ends whatever the exact band works out to.
      const stats = countWallVerticesInZone(result, outerW, outerD, 12, 22, 1.0);
      for (const count of [stats.back, stats.left, stats.right]) {
        expect(stats.front, 'front wall must carry far more pattern geometry').toBeGreaterThan(
          count * 4
        );
      }
    },
    compareWith: {
      params: { ...params, wallPattern: { ...params.wallPattern, enabled: false } },
      assert: assertRemovesMaterial,
    },
  });
}

export const wallPatterns: ScenarioCase[] = [
  frontOnlyCase(),
  patternCase('round'),
  patternCase('diamond'),
  patternCase('triangle'),
  patternCase('slots'),
  // Scale extremes on honeycomb must still produce valid, carved geometry.
  patternCase('honeycomb', 0),
  patternCase('honeycomb', 1),
];
