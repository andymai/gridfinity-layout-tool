import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import { countWallVerticesInZone } from '../__dual-kernel__/meshAssertions';
import { defineScenario } from '../__dual-kernel__/scenarioTypes';
import type { ScenarioCase } from '../__dual-kernel__/scenarioTypes';

const SIZE = GRIDFINITY.GRID_SIZE;
const HEIGHT_781 = 10;
const meshWallHeight781 = HEIGHT_781 * GRIDFINITY.HEIGHT_UNIT;

const lipWallCases = [
  { width: 6, depth: 2, label: '6x2 (reported in #781, small bin)' },
  { width: 4, depth: 4, label: '4x4 (threshold)' },
  { width: 5, depth: 4, label: '5x4 (above threshold)' },
  { width: 8, depth: 2, label: '8x2 (large, elongated)' },
];

export const lipWall: ScenarioCase[] = lipWallCases.map(({ width, depth, label }) => {
  const outerW = width * SIZE - GRIDFINITY.TOLERANCE;
  const outerD = depth * SIZE - GRIDFINITY.TOLERANCE;

  return defineScenario('lip-wall #781', `${label} slotted + stacking lip preview`, {
    assert: 'structural',
    params: {
      width,
      depth,
      height: HEIGHT_781,
      style: 'slotted',
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
    timeout: 120_000,
    customAssert: (result) => {
      const zMin = meshWallHeight781 - 2.0;
      const zMax = meshWallHeight781 + 1.0;
      const stats = countWallVerticesInZone(result, outerW, outerD, zMin, zMax, 1.5);

      // Lip must exist (maxZ above wallHeight)
      expect(stats.maxZ).toBeGreaterThan(meshWallHeight781);

      // Each outer wall must have vertices in the lip junction zone
      expect(stats.left).toBeGreaterThanOrEqual(2);
      expect(stats.right).toBeGreaterThanOrEqual(2);
      expect(stats.front).toBeGreaterThanOrEqual(2);
      expect(stats.back).toBeGreaterThanOrEqual(2);
    },
  });
});
