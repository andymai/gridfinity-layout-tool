/**
 * Scenario test: authored (removable) divider pieces build real geometry.
 *
 * Coverage guard. `dividerPieces` is the one bin feature whose only unmocked
 * tests live in `__kernel-tests__`, which `vitest.config.ts` excludes from every
 * project — so CI ran `dividerBuilder.test.ts` and `slotBuilder.test.ts`, both of
 * which `vi.mock('brepjs')` and therefore stay green through any geometry
 * regression. `binGenerator.scenario.tilted-dividers` covers
 * `compartments.dividerOverrides`, a different feature.
 *
 * The invariant is the one `__kernel-tests__/authoredDividers` verifies at
 * depth: each piece is its solid wall box minus exactly its cross-lap notches.
 * That file stays as the cross-kernel probe; this one is the in-suite guard.
 *
 * Cross-kernel:
 *   BREPJS_KERNEL=brepkit pnpm exec vitest run --project=generators authoredDividers
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import {
  calculateDividerPieceHeight,
  dividerGrooveDepth,
  dividerSeatZ,
  getEffectiveSlotDimensions,
} from '@/shared/utils/slotMath';
import { deriveWallSegments } from '@/shared/utils/compartmentGeometry';
import { computeAuthoredDividers } from '@/shared/utils/authoredDividerMath';

const INNER_W = 80;
const INNER_D = 80;
const WALL_HEIGHT = 30;

/** Divergence-theorem volume of a closed triangle mesh. */
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

function customParams(cols: number, rows: number, cells: number[]): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    style: 'slotted',
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      layout: 'custom',
      customGrid: { cols, rows, cells },
    },
    dividerPieces: { height: 'auto', thickness: 1.6, clearance: 0.25, floorGroove: true },
  };
}

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

describe('authored divider pieces through the real kernel', () => {
  it('emits one finite piece per wall segment, each minus exactly its notch volume', async () => {
    const { mesh } = await import('brepjs');
    const { buildUniqueDividerPieces } = await import('./dividerBuilder');

    const params = customParams(2, 2, [0, 1, 2, 3]);
    const { thickness, clearance } = params.dividerPieces;
    const { slotWidth, slotDepth } = getEffectiveSlotDimensions(
      params.wallThickness,
      thickness,
      clearance
    );
    // Pieces stand on the divider seat, not the box bottom, so they are shorter
    // than the wall by the floor above that seat.
    const pieceHeight = calculateDividerPieceHeight(
      params.dividerPieces,
      WALL_HEIGHT,
      false,
      dividerSeatZ(params.wallThickness, dividerGrooveDepth(params))
    );
    const notchDepth = pieceHeight / 2 + clearance;

    const segments = deriveWallSegments(
      { cols: 2, rows: 2, cells: [0, 1, 2, 3] },
      INNER_W,
      INNER_D
    );
    const specs = computeAuthoredDividers(
      segments,
      INNER_W,
      INNER_D,
      thickness,
      slotDepth,
      clearance
    );

    const pieces = buildUniqueDividerPieces(params, INNER_W, INNER_D, WALL_HEIGHT, false);
    // 2x2 with 4 distinct cells → one full vertical + one full horizontal.
    expect(pieces.map((p) => p.label)).toEqual(['divider-01', 'divider-02']);
    expect(specs).toHaveLength(2);

    try {
      for (let i = 0; i < pieces.length; i++) {
        const m = mesh(pieces[i].shape, { tolerance: 0.01, angularTolerance: 5, cache: false });
        for (const v of m.vertices) expect(Number.isFinite(v)).toBe(true);
        const vol = meshVolume(m.vertices, m.triangles);
        const solid = specs[i].length * pieceHeight * thickness;
        const notchVol = specs[i].notchOffsets.length * slotWidth * notchDepth * thickness;
        // Each piece is its solid box minus its cross-lap notches and a small
        // tab neck relief at each wall-anchored end (getDividerLockPlan). The
        // relief is under a mm³, so the piece sits just below solid − notchVol;
        // a dropped notch (~50 mm³) still falls far outside this window.
        const expected = solid - notchVol;
        expect(vol).toBeGreaterThan(0);
        expect(vol).toBeLessThanOrEqual(expected + 0.01);
        expect(vol).toBeGreaterThan(expected - 2);
      }
    } finally {
      for (const p of pieces) p.shape.delete();
    }
  }, 120_000);

  it('produces finite geometry for an irregular layout with T-junction and friction pieces', async () => {
    const { mesh } = await import('brepjs');
    const { buildUniqueDividerPieces } = await import('./dividerBuilder');

    // col0 & col2 full-height; col1 split → a lone horizontal (friction) piece.
    const params = customParams(3, 3, [0, 1, 2, 0, 3, 2, 0, 3, 2]);
    const pieces = buildUniqueDividerPieces(params, 90, 90, WALL_HEIGHT, false);
    expect(pieces.length).toBeGreaterThanOrEqual(3);
    try {
      for (const p of pieces) {
        const m = mesh(p.shape, { tolerance: 0.01, angularTolerance: 5, cache: false });
        for (const v of m.vertices) expect(Number.isFinite(v)).toBe(true);
        expect(meshVolume(m.vertices, m.triangles)).toBeGreaterThan(0);
      }
    } finally {
      for (const p of pieces) p.shape.delete();
    }
  }, 120_000);
});
