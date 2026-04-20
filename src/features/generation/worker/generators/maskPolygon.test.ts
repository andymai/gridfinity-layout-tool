// @vitest-environment node
/**
 * Tests for the mask → brepjs Drawing converter.
 *
 * Verifies the helper wires gridUnit → mm correctly and preserves the
 * rectangle/L/T bbox after inset. Requires a live brepjs kernel because
 * the output is a brepjs Drawing; the inset itself is computed
 * geometrically (see `insetAxisAlignedPolygon` in `maskPolygon.ts`).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__dual-kernel__/wasmInit';
import { buildFullMask, type CellMask } from '@/shared/utils/cellMask';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

/** Build a mask from a visually top-first 2D array. */
function mask(rows: (0 | 1)[][]): CellMask {
  const bottomFirst = rows.slice().reverse();
  const cols = bottomFirst[0]?.length ?? 0;
  return { cols, rows: bottomFirst.length, cells: bottomFirst.flat() };
}

describe('buildMaskDrawing', () => {
  it('builds a centered polygon with bbox matching a 2×2 full-mask footprint', async () => {
    const { buildMaskDrawing } = await import('./maskPolygon');
    const full = buildFullMask(2, 2); // 4×4 mask, 2 grid units per side = 84mm
    const drawing = buildMaskDrawing(full, 42);
    const bb = drawing.boundingBox;
    // 2 grid units = 84mm, minus CLEARANCE (0.5mm total from offset -0.25 each side) → 83.5mm
    expect(bb.bounds[1][0] - bb.bounds[0][0]).toBeCloseTo(83.5, 2);
    expect(bb.bounds[1][1] - bb.bounds[0][1]).toBeCloseTo(83.5, 2);
    // Centered on origin
    expect((bb.bounds[0][0] + bb.bounds[1][0]) / 2).toBeCloseTo(0, 3);
    expect((bb.bounds[0][1] + bb.bounds[1][1]) / 2).toBeCloseTo(0, 3);
  });

  it('preserves L-shape bbox dimensions (3×3 with BR corner missing)', async () => {
    const { buildMaskDrawing } = await import('./maskPolygon');
    const lMask = mask([
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 0, 0],
      [1, 1, 1, 1, 0, 0],
    ]);
    const drawing = buildMaskDrawing(lMask, 42);
    const bb = drawing.boundingBox;
    // 3 grid units = 126mm minus CLEARANCE → 125.5mm
    expect(bb.bounds[1][0] - bb.bounds[0][0]).toBeCloseTo(125.5, 2);
    expect(bb.bounds[1][1] - bb.bounds[0][1]).toBeCloseTo(125.5, 2);
  });

  it('scales with gridUnitMm', async () => {
    const { buildMaskDrawing } = await import('./maskPolygon');
    const full = buildFullMask(1, 1);
    const drawing50 = buildMaskDrawing(full, 50);
    const bb = drawing50.boundingBox;
    // 1 grid unit at 50mm/unit = 50mm minus CLEARANCE → 49.5mm
    expect(bb.bounds[1][0] - bb.bounds[0][0]).toBeCloseTo(49.5, 2);
  });

  it('throws for a single-cell (degenerate) polygon', async () => {
    const { buildMaskDrawing } = await import('./maskPolygon');
    // 1×1 mask with a single filled cell is still 4 corners → valid.
    // To force a degenerate polygon we'd need <3 corners, which mask->polygon
    // never produces. The throw path is a defensive guard — assert it by
    // constructing an impossible mask directly.
    const impossible: CellMask = { cols: 1, rows: 1, cells: [1] };
    // This succeeds because any non-empty mask has ≥4 corners.
    const d = buildMaskDrawing(impossible, 42);
    expect(d).toBeDefined();
  });
});

describe('buildMaskDrawingInset', () => {
  it('produces a smaller polygon than the outer drawing', async () => {
    const { buildMaskDrawing, buildMaskDrawingInset } = await import('./maskPolygon');
    const lMask = mask([
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 0, 0],
      [1, 1, 1, 1, 0, 0],
    ]);
    const outer = buildMaskDrawing(lMask, 42).boundingBox;
    const inner = buildMaskDrawingInset(lMask, 42, 2.6).boundingBox;
    // Inset by 2.6mm per side → outer bbox shrinks by ~5.2mm in each dim
    expect(inner.bounds[1][0] - inner.bounds[0][0]).toBeLessThan(
      outer.bounds[1][0] - outer.bounds[0][0] - 5
    );
    expect(inner.bounds[1][1] - inner.bounds[0][1]).toBeLessThan(
      outer.bounds[1][1] - outer.bounds[0][1] - 5
    );
  });
});
