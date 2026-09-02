/**
 * Scenario test: removable divider pieces span the overhang-expanded interior.
 *
 * Overhang grows the body outward and the wall slots move out with it, so a
 * piece stated against the nominal interior is short by `left + right` and
 * cannot reach its slot at either end. Nothing downstream catches that: the
 * piece is a valid, watertight, positive-volume solid at the wrong length.
 *
 * `dividerBuilder.test.ts` and `slotBuilder.test.ts` both `vi.mock('brepjs')`,
 * so this asserts on real geometry rather than on the length arithmetic alone.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { dividerInterior } from '@/shared/utils/slotMath';

const WALL_HEIGHT = 30;

function slottedParams(overhang?: BinParams['overhang']): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 4,
    depth: 1,
    style: 'slotted',
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      x: { enabled: true, pitch: 21 },
      y: { enabled: false, pitch: 42 },
    },
    dividerPieces: { height: 'auto', thickness: 1.6, clearance: 0.25, floorGroove: true },
    overhang,
  };
}

/** Axis-aligned extent of a meshed shape along `axis` (0=X, 1=Y, 2=Z). */
function meshExtent(vertices: ArrayLike<number>, axis: number): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = axis; i < vertices.length; i += 3) {
    if (vertices[i] < lo) lo = vertices[i];
    if (vertices[i] > hi) hi = vertices[i];
  }
  return hi - lo;
}

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

describe('removable dividers under overhang', () => {
  it('lengthens the printed piece by the per-side overhang it has to span', async () => {
    const { mesh } = await import('brepjs');
    const { buildUniqueDividerPieces } = await import('./dividerBuilder');

    const build = (params: BinParams): number => {
      const { innerW, innerD } = dividerInterior(params);
      const pieces = buildUniqueDividerPieces(params, innerW, innerD, WALL_HEIGHT, false);
      expect(pieces).toHaveLength(1);
      try {
        const m = mesh(pieces[0].shape, { tolerance: 0.01, angularTolerance: 5, cache: false });
        for (const v of m.vertices) expect(Number.isFinite(v)).toBe(true);
        // An X-axis piece spans width, which is the mesh's longest axis.
        return meshExtent(m.vertices, 0);
      } finally {
        for (const p of pieces) p.shape.delete();
      }
    };

    const nominal = build(slottedParams());
    const expanded = build(slottedParams({ enabled: true, left: 21, right: 0, front: 0, back: 0 }));

    expect(nominal).toBeGreaterThan(0);
    expect(expanded - nominal).toBeCloseTo(21, 1);
  }, 180_000);

  it('leaves the piece at nominal length when the overhang is disabled', async () => {
    const { mesh } = await import('brepjs');
    const { buildUniqueDividerPieces } = await import('./dividerBuilder');

    const build = (params: BinParams): number => {
      const { innerW, innerD } = dividerInterior(params);
      const pieces = buildUniqueDividerPieces(params, innerW, innerD, WALL_HEIGHT, false);
      try {
        const m = mesh(pieces[0].shape, { tolerance: 0.01, angularTolerance: 5, cache: false });
        return meshExtent(m.vertices, 0);
      } finally {
        for (const p of pieces) p.shape.delete();
      }
    };

    const nominal = build(slottedParams());
    const off = build(slottedParams({ enabled: false, left: 21, right: 0, front: 0, back: 0 }));
    expect(off).toBeCloseTo(nominal, 3);
  }, 180_000);
});
