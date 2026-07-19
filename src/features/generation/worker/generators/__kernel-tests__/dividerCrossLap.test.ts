// @vitest-environment node
/**
 * Real-kernel verification of cross-lap divider notching: when both slot
 * axes are enabled, each divider piece must lose exactly the notch volume
 * to the boolean cut, and the mesh must stay finite and manifold-clean.
 *
 * Run:
 *   pnpm exec vitest run --config vitest.profile.config.ts dividerCrossLap --reporter=verbose
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getKernelName } from './wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import {
  calculateDividerLength,
  calculateShortDividerLengths,
  calculateShortDividerSpans,
  calculateSlotPositions,
  getEffectiveSlotDimensions,
  getReceptacleDepth,
} from '@/shared/utils/slotMath';

const INNER_W = 80;
const INNER_D = 60;
const WALL_HEIGHT = 30;

function makeParams(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    style: 'slotted',
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      x: { enabled: true, pitch: 20 },
      y: { enabled: true, pitch: 20 },
    },
    dividerPieces: { height: 'auto', thickness: 1.6, clearance: 0.25 },
    ...overrides,
  };
}

/** Signed volume of a triangle mesh via the divergence theorem. */
function meshVolume(vertices: ArrayLike<number>, triangles: ArrayLike<number>): number {
  let vol = 0;
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i] * 3;
    const b = triangles[i + 1] * 3;
    const c = triangles[i + 2] * 3;
    vol +=
      (vertices[a] * (vertices[b + 1] * vertices[c + 2] - vertices[b + 2] * vertices[c + 1]) -
        vertices[a + 1] * (vertices[b] * vertices[c + 2] - vertices[b + 2] * vertices[c]) +
        vertices[a + 2] * (vertices[b] * vertices[c + 1] - vertices[b + 1] * vertices[c])) /
      6;
  }
  return Math.abs(vol);
}

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

describe(`cross-lap divider pieces on ${getKernelName()}`, () => {
  it('cuts exactly the notch volume from each piece and stays finite', async () => {
    const { mesh } = await import('brepjs');
    const { buildUniqueDividerPieces } = await import('../dividerBuilder');

    const params = makeParams();
    const { thickness, clearance } = params.dividerPieces;
    const { slotWidth, slotDepth } = getEffectiveSlotDimensions(
      params.wallThickness,
      thickness,
      clearance
    );
    const dividerHeight = WALL_HEIGHT; // height 'auto', no lip
    const notchDepth = dividerHeight / 2 + clearance;

    const pieces = buildUniqueDividerPieces(params, INNER_W, INNER_D, WALL_HEIGHT, false).map(
      (p) => p.shape
    );
    expect(pieces).toHaveLength(2);

    const expected = [
      // X piece spans innerW, notched at Y-axis positions
      {
        length: calculateDividerLength(INNER_W, slotDepth, clearance),
        notches: calculateSlotPositions(INNER_W, params.slotConfig.y.pitch, 0).length,
      },
      // Y piece spans innerD, notched at X-axis positions
      {
        length: calculateDividerLength(INNER_D, slotDepth, clearance),
        notches: calculateSlotPositions(INNER_D, params.slotConfig.x.pitch, 0).length,
      },
    ];
    expect(expected[0].notches).toBeGreaterThan(0);
    expect(expected[1].notches).toBeGreaterThan(0);

    try {
      for (let i = 0; i < pieces.length; i++) {
        const m = mesh(pieces[i], { tolerance: 0.01, angularTolerance: 5, cache: false });
        for (const v of m.vertices) expect(Number.isFinite(v)).toBe(true);

        const vol = meshVolume(m.vertices, m.triangles);
        const solid = expected[i].length * dividerHeight * thickness;
        const notchVol = expected[i].notches * slotWidth * notchDepth * thickness;
        expect(vol).toBeGreaterThan(0);
        expect(vol).toBeCloseTo(solid - notchVol, 0);
      }
    } finally {
      for (const p of pieces) p.delete();
    }
  });

  it('leaves single-axis pieces uncut', async () => {
    const { mesh } = await import('brepjs');
    const { buildUniqueDividerPieces } = await import('../dividerBuilder');

    const params = makeParams({
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 20 },
        y: { enabled: false, pitch: 20 },
      },
    });
    const { thickness, clearance } = params.dividerPieces;
    const { slotDepth } = getEffectiveSlotDimensions(params.wallThickness, thickness, clearance);

    const pieces = buildUniqueDividerPieces(params, INNER_W, INNER_D, WALL_HEIGHT, false).map(
      (p) => p.shape
    );
    expect(pieces).toHaveLength(1);

    try {
      const m = mesh(pieces[0], { tolerance: 0.01, angularTolerance: 5, cache: false });
      const vol = meshVolume(m.vertices, m.triangles);
      const solid = calculateDividerLength(INNER_W, slotDepth, clearance) * WALL_HEIGHT * thickness;
      expect(vol).toBeCloseTo(solid, 0);
    } finally {
      for (const p of pieces) p.delete();
    }
  });

  it('insert mode: grooves remove exactly 2n receptacle volumes; short pieces stay solid', async () => {
    const { mesh } = await import('brepjs');
    const { buildUniqueDividerPieces } = await import('../dividerBuilder');

    const params = makeParams({
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 20 },
        y: { enabled: true, pitch: 20 },
        crossStyle: 'insert',
        longAxis: 'y',
      },
    });
    const { thickness, clearance } = params.dividerPieces;
    const { slotWidth, slotDepth } = getEffectiveSlotDimensions(
      params.wallThickness,
      thickness,
      clearance
    );
    const grooveDepth = getReceptacleDepth(thickness);

    const pieces = buildUniqueDividerPieces(params, INNER_W, INNER_D, WALL_HEIGHT, false);
    expect(pieces.map((p) => p.label)).toEqual([
      'divider-vertical',
      'divider-horizontal-compartment',
      'divider-horizontal-compartment-edge',
    ]);

    const longPositions = calculateSlotPositions(INNER_W, params.slotConfig.y.pitch, 0);
    const groovePositions = calculateSlotPositions(INNER_D, params.slotConfig.x.pitch, 0);
    const spans = calculateShortDividerSpans(longPositions, INNER_W, thickness);
    const lengths = calculateShortDividerLengths(spans, slotDepth, grooveDepth, clearance);

    const expectedVolumes = [
      calculateDividerLength(INNER_D, slotDepth, clearance) * WALL_HEIGHT * thickness -
        2 * groovePositions.length * slotWidth * WALL_HEIGHT * grooveDepth,
      (lengths.interior ?? 0) * WALL_HEIGHT * thickness,
      (lengths.edge ?? 0) * WALL_HEIGHT * thickness,
    ];

    try {
      for (let i = 0; i < pieces.length; i++) {
        const m = mesh(pieces[i].shape, { tolerance: 0.01, angularTolerance: 5, cache: false });
        for (const v of m.vertices) expect(Number.isFinite(v)).toBe(true);
        const vol = meshVolume(m.vertices, m.triangles);
        expect(vol).toBeGreaterThan(0);
        expect(vol).toBeCloseTo(expectedVolumes[i], 0);
      }
    } finally {
      for (const p of pieces) p.shape.delete();
    }
  });
});
