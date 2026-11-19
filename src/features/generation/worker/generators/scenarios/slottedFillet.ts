/**
 * The interior fillet with removable dividers (#5101): the outer walls rounded,
 * each wall slot running down the fillet's curve into the floor groove.
 *
 * Each case exports and compares against the same slotted bin with no fillet.
 * The rounded bin adds material, keeps the sharp bin's outside, and keeps its
 * Euler characteristic: a channel that cut through the corner instead of
 * following it, or a fillet fused as a second shell, would change it. The
 * channel's own position is probed on the solid in `slottedFillet.kernel.test`.
 */
import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { boundingBox, meshTopologyStats, meshVolume } from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

function expectClosedManifold(mesh: MeshData): void {
  const { boundaryEdges, nonManifoldEdges } = meshTopologyStats(mesh);
  expect(boundaryEdges).toBe(0);
  expect(nonManifoldEdges).toBe(0);
}

const ONE_AXIS = {
  ...DEFAULT_BIN_PARAMS.slotConfig,
  x: { enabled: true, pitch: 40 },
  y: { enabled: false, pitch: 40 },
};

const BOTH_AXES = {
  ...DEFAULT_BIN_PARAMS.slotConfig,
  x: { enabled: true, pitch: 20 },
  y: { enabled: true, pitch: 20 },
};

function slottedFilletCase(name: string, params: Partial<BinParams>): ScenarioCase {
  const full: Partial<BinParams> = {
    width: 2,
    depth: 2,
    height: 5,
    style: 'slotted',
    interiorFilletMm: 2.5,
    slotConfig: ONE_AXIS,
    ...params,
  };
  const { interiorFilletMm: _r, ...sharp } = full;
  return defineScenario('slotted fillet #5101', name, {
    assert: 'structural',
    forExport: true,
    params: full,
    customAssert: (mesh) => expectClosedManifold(mesh),
    compareWith: {
      params: sharp,
      forExport: true,
      assert: (rounded, square) => {
        expect(meshTopologyStats(rounded).eulerCharacteristic).toBe(
          meshTopologyStats(square).eulerCharacteristic
        );
        expect(meshVolume(rounded)).toBeGreaterThan(meshVolume(square) + 1);
        const a = boundingBox(rounded.vertices);
        const b = boundingBox(square.vertices);
        for (const k of ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ'] as const) {
          expect(a[k]).toBeCloseTo(b[k], 2);
        }
      },
    },
  });
}

export const slottedFillet: ScenarioCase[] = [
  slottedFilletCase('one axis over the floor groove', {}),
  slottedFilletCase('one axis without the floor groove', {
    dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, floorGroove: false },
  }),
  slottedFilletCase('both axes interlocking', { slotConfig: BOTH_AXES }),
  slottedFilletCase('both axes with insert pieces', {
    slotConfig: { ...BOTH_AXES, crossStyle: 'insert' },
  }),
  slottedFilletCase('dense slots hold a large fillet back', {
    interiorFilletMm: 15,
    slotConfig: { ...BOTH_AXES, x: { enabled: true, pitch: 10 }, y: { enabled: true, pitch: 10 } },
  }),
  slottedFilletCase('a custom layout with a line near a corner', {
    interiorFilletMm: 12,
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      layout: 'custom',
      customGrid: { cols: 6, rows: 2, cells: [0, 1, 1, 1, 1, 2, 0, 3, 3, 3, 3, 2] },
    },
  }),
  slottedFilletCase('without a stacking lip', {
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
  }),
  slottedFilletCase('with a rounded rim, built in the shell', {
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false, rimFillet: true },
  }),
  slottedFilletCase('a magnet base', {
    base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' },
  }),
  slottedFilletCase('a half-grid width', { width: 1.5, depth: 2 }),
  slottedFilletCase('an asymmetric overhang', {
    overhang: { left: 4, right: 0, front: 2, back: 0, feet: false },
  }),
];
