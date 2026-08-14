import { describe, it, expect } from 'vitest';
import type { CellMask } from '@/shared/utils/cellMask';
import { MASK_CELL_SIZE } from '@/shared/utils/cellMask';
import { edgeRotationDeg, insetAlongNormal, maskEdgesMm } from './maskEdgeGeometry';

const PITCH = 42;

/** Build a mask from a picture: row 0 is the BOTTOM, matching grid convention. */
function maskFrom(rowsBottomFirst: readonly string[]): CellMask {
  const rows = rowsBottomFirst.length;
  const cols = rowsBottomFirst[0].length;
  const cells: (0 | 1)[] = [];
  for (const row of rowsBottomFirst) {
    for (const ch of row) cells.push(ch === '#' ? 1 : 0);
  }
  return { cols, rows, cells };
}

/** Is `(x, y)` inside the filled region? Cheap point-in-mask, for normal checks. */
function filledAt(mask: CellMask, x: number, y: number): boolean {
  const halfW = (mask.cols * MASK_CELL_SIZE * PITCH) / 2;
  const halfD = (mask.rows * MASK_CELL_SIZE * PITCH) / 2;
  const col = Math.floor((x + halfW) / (MASK_CELL_SIZE * PITCH));
  const row = Math.floor((y + halfD) / (MASK_CELL_SIZE * PITCH));
  if (col < 0 || col >= mask.cols || row < 0 || row >= mask.rows) return false;
  return mask.cells[row * mask.cols + col] === 1;
}

describe('maskEdgesMm', () => {
  it('walks a plain square and centres it on the origin', () => {
    const edges = maskEdgesMm(maskFrom(['##', '##']), PITCH, PITCH);
    expect(edges).toHaveLength(4);
    const half = (2 * MASK_CELL_SIZE * PITCH) / 2;
    for (const e of edges) {
      expect(e.loop).toBe(0);
      expect(e.length).toBeCloseTo(2 * half, 6);
      expect(Math.abs(e.midX) === half || Math.abs(e.midY) === half).toBe(true);
    }
  });

  it('points every normal at material, on an L-shape', () => {
    // The reflex corner is the case a naive "interior is inward" rule gets
    // wrong; stepping along each normal from each midpoint answers it directly.
    const mask = maskFrom(['###', '###', '#..', '#..']);
    for (const e of maskEdgesMm(mask, PITCH, PITCH)) {
      const inward = insetAlongNormal(e, e.midX, e.midY, 1);
      const outward = insetAlongNormal(e, e.midX, e.midY, -1);
      expect(filledAt(mask, inward.x, inward.y)).toBe(true);
      expect(filledAt(mask, outward.x, outward.y)).toBe(false);
    }
  });

  it('points a hole’s normals OUTWARD from the hole, into the material', () => {
    // The inner-loop trap (#3482): a hole winds CW, so a rule keyed on "CCW
    // means inward is left" pushes its band into the void. Every edge here
    // belongs to a loop whose material is still on its left.
    const mask = maskFrom(['####', '#..#', '#..#', '####']);
    const edges = maskEdgesMm(mask, PITCH, PITCH);
    const holeEdges = edges.filter((e) => e.loop > 0);
    expect(holeEdges).toHaveLength(4);
    for (const e of holeEdges) {
      const inward = insetAlongNormal(e, e.midX, e.midY, 1);
      expect(filledAt(mask, inward.x, inward.y)).toBe(true);
      const intoHole = insetAlongNormal(e, e.midX, e.midY, -1);
      expect(filledAt(mask, intoHole.x, intoHole.y)).toBe(false);
    }
  });

  it('reports the outer loop first and every hole after it', () => {
    const edges = maskEdgesMm(maskFrom(['####', '#..#', '#..#', '####']), PITCH, PITCH);
    expect(edges.filter((e) => e.loop === 0)).toHaveLength(4);
    expect(new Set(edges.map((e) => e.loop))).toEqual(new Set([0, 1]));
  });

  it('scales each axis by its own pitch', () => {
    const edges = maskEdgesMm(maskFrom(['##', '##']), 42, 36);
    const alongX = edges.filter((e) => e.dirY === 0);
    const alongY = edges.filter((e) => e.dirX === 0);
    expect(alongX[0].length).toBeCloseTo(42, 6);
    expect(alongY[0].length).toBeCloseTo(36, 6);
  });
});

describe('edgeRotationDeg', () => {
  it('matches the rail placement convention on each facing', () => {
    // Keyed on the OUTWARD normal, as `railPlacementsForRectangle` is: back
    // (outward +Y) takes 0 and front (outward -Y) takes 180. Keying on the
    // edge DIRECTION instead turns every wall through a half-turn, which no
    // bounding box would notice.
    const edges = maskEdgesMm(maskFrom(['##', '##']), PITCH, PITCH);
    const byFacing = new Map(edges.map((e) => [`${-e.inX},${-e.inY}`, edgeRotationDeg(e)]));
    expect(byFacing.get('0,1')).toBe(0); // outward +Y → back wall
    expect(byFacing.get('0,-1')).toBe(180); // outward -Y → front wall
    expect(byFacing.get('1,0')).toBe(-90); // outward +X → right wall
    expect(byFacing.get('-1,0')).toBe(90); // outward -X → left wall
  });
});
