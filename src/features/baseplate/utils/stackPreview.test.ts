import { describe, it, expect } from 'vitest';
import type { StackPrintParams } from '@/core/types';
import { mm } from '@/core/types';
import { buildStackPreviewMeshes } from './stackPreview';
import { meshBounds, type StackMeshArrays } from './stackPrint';

/** Body centre Y of plate() (footprint Y[0,30]) — passed to every tower fixture. */
const PLATE_BODY_Y = 15;

/** A 10mm-tall plate footprint 0..20 x 0..30 as an indexed mesh (2 triangles). */
function plate(): StackMeshArrays {
  return {
    vertices: new Float32Array([0, 0, 0, 20, 0, 0, 0, 30, 0, 0, 0, 10, 20, 0, 10, 0, 30, 10]),
    normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
    edgeVertices: new Float32Array(0),
  };
}

const airGap: StackPrintParams = { enabled: true, gapMm: mm(0.2) };

describe('buildStackPreviewMeshes', () => {
  it('returns empty geometry for no towers', () => {
    const out = buildStackPreviewMeshes([], airGap, 0, 42);
    expect(out.plates.vertices.length).toBe(0);
    expect(out.heightMm).toBe(0);
    expect(out.towerLayouts).toHaveLength(0);
  });

  it('stacks a single tower of N copies', () => {
    const out = buildStackPreviewMeshes(
      [{ mesh: plate(), copies: 3, bodyCenterYMm: PLATE_BODY_Y }],
      airGap,
      0,
      42
    );
    // 2 triangles * 3 copies = 6 triangles -> 6 indices * 3 = 18 index entries
    expect(out.plates.indices.length).toBe(18);
    // height = 2*(10+0.2)+10 = 30.4
    expect(out.heightMm).toBeCloseTo(30.4, 4);
    const b = meshBounds(out.plates.vertices);
    expect(b.minZ).toBeCloseTo(0, 4);
    expect(b.maxZ).toBeCloseTo(30.4, 4);
    expect(out.towerLayouts).toHaveLength(1);
    expect(out.towerLayouts[0].centerX).toBeCloseTo(0, 4);
    expect(out.towerLayouts[0].centerY).toBeCloseTo(0, 4);
    expect(out.towerLayouts[0].heightMm).toBeCloseTo(30.4, 4);
  });

  it('adds the separation slider distance to the stride', () => {
    const base = buildStackPreviewMeshes(
      [{ mesh: plate(), copies: 2, bodyCenterYMm: PLATE_BODY_Y }],
      airGap,
      0,
      42
    );
    const exploded = buildStackPreviewMeshes(
      [{ mesh: plate(), copies: 2, bodyCenterYMm: PLATE_BODY_Y }],
      airGap,
      20,
      42
    );
    expect(exploded.heightMm).toBeGreaterThan(base.heightMm + 19);
  });

  it('lays multiple towers in a centered grid', () => {
    const out = buildStackPreviewMeshes(
      [
        { mesh: plate(), copies: 1, bodyCenterYMm: PLATE_BODY_Y },
        { mesh: plate(), copies: 1, bodyCenterYMm: PLATE_BODY_Y },
      ],
      airGap,
      0,
      42
    );
    const b = meshBounds(out.plates.vertices);
    // 2 towers -> 2 cols x 1 row. Cells snap to whole grid units: a 20mm-wide
    // tower rounds to 1 unit, + TOWER_GAP_UNITS (1) = 2 units → cellW 2*42=84.
    // Centered cols at ±42; each 20mm tower spans ±10 -> X bounds [-52, 52].
    expect(b.minX).toBeCloseTo(-52, 4);
    expect(b.maxX).toBeCloseTo(52, 4);
    expect(out.widthMm).toBeCloseTo(168, 4);
    // towerLayouts must align 1:1 with the input towers array.
    expect(out.towerLayouts).toHaveLength(2);
    expect(out.towerLayouts[0].centerX).toBeCloseTo(-42, 4);
    expect(out.towerLayouts[1].centerX).toBeCloseTo(42, 4);
  });

  // Towers tile into a roughly-square grid (cols = ceil(sqrt(n))), centered on
  // origin — a single off-screen row was the "single line" preview bug. Cells
  // snap to whole grid units so towers align to the scene grid: 20×30 plate →
  // 1×1 units → (1+1)×(1+1) = 2×2 cells = 84×84mm.
  describe('grid layout (parameterized)', () => {
    const cases = [
      { towers: 1, cols: 1, rows: 1 },
      { towers: 2, cols: 2, rows: 1 },
      { towers: 3, cols: 2, rows: 2 },
      { towers: 4, cols: 2, rows: 2 },
      { towers: 5, cols: 3, rows: 2 },
      { towers: 9, cols: 3, rows: 3 },
      { towers: 16, cols: 4, rows: 4 },
    ];
    it.each(cases)('$towers towers → ${cols}×${rows} grid, centered', ({ towers, cols, rows }) => {
      const out = buildStackPreviewMeshes(
        Array.from({ length: towers }, () => ({
          mesh: plate(),
          copies: 1,
          bodyCenterYMm: PLATE_BODY_Y,
        })),
        airGap,
        0,
        42
      );
      expect(out.widthMm).toBeCloseTo(cols * 84, 4);
      expect(out.depthMm).toBeCloseTo(rows * 84, 4);
      // Centered on origin in X and Y.
      const b = meshBounds(out.plates.vertices);
      expect(b.minX).toBeCloseTo(-b.maxX, 3);
      expect(b.minY).toBeCloseTo(-b.maxY, 3);
    });
  });

  // "No stacks" case: each tower carries its tiling col/row, so the preview
  // mirrors the assembled split view instead of collapsing to a square grid.
  describe('spatial layout (matches assembled grid)', () => {
    it('keeps a 4-wide × 1-deep split in one row, not a 2×2 square', () => {
      const out = buildStackPreviewMeshes(
        [0, 1, 2, 3].map((col) => ({
          mesh: plate(),
          copies: 1,
          bodyCenterYMm: PLATE_BODY_Y,
          col,
          row: 0,
        })),
        airGap,
        0,
        42
      );
      // 4 cols × 1 row (the square-grid path would give 2×2 = 168×168).
      expect(out.widthMm).toBeCloseTo(4 * 84, 4);
      expect(out.depthMm).toBeCloseTo(1 * 84, 4);
      // Columns increase strictly left→right; all towers share one row (Y≈0).
      const xs = out.towerLayouts.map((l) => l.centerX);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
      expect(out.towerLayouts.every((l) => Math.abs(l.centerY) < 1e-6)).toBe(true);
    });

    it('orders rows front-to-back like the assembled view (row 0 at front)', () => {
      // One column, two rows: A1 (row 0) must sit in front of A2 (row 1). The
      // assembled view places row 0 at the smaller Y, so the preview must not
      // flip it (the square-grid path puts row 0 on top = larger Y).
      const out = buildStackPreviewMeshes(
        [
          { mesh: plate(), copies: 1, bodyCenterYMm: PLATE_BODY_Y, col: 0, row: 0 },
          { mesh: plate(), copies: 1, bodyCenterYMm: PLATE_BODY_Y, col: 0, row: 1 },
        ],
        airGap,
        0,
        42
      );
      expect(out.towerLayouts[0].centerY).toBeLessThan(out.towerLayouts[1].centerY);
    });

    it('falls back to the square grid when any tower lacks a position', () => {
      const out = buildStackPreviewMeshes(
        [
          { mesh: plate(), copies: 1, bodyCenterYMm: PLATE_BODY_Y, col: 0, row: 0 },
          { mesh: plate(), copies: 1, bodyCenterYMm: PLATE_BODY_Y },
        ],
        airGap,
        0,
        42
      );
      // 2 towers, square grid → 2 cols × 1 row.
      expect(out.widthMm).toBeCloseTo(2 * 84, 4);
      expect(out.depthMm).toBeCloseTo(1 * 84, 4);
    });
  });
});
