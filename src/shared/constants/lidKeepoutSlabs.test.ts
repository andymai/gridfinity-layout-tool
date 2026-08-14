import { describe, it, expect } from 'vitest';
import type { CellMask } from '@/shared/utils/cellMask';
import { MASK_CELL_SIZE } from '@/shared/utils/cellMask';
import {
  LID_KEEPOUT_OUTLINE_INSET_MM,
  lidKeepoutRing,
  lidKeepoutSlabs,
  lidKeepoutWidthMm,
  type LidKeepoutSlab,
} from './lidKeepout';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';

const PITCH = 42;
const WALL = 1.2;

function maskFrom(rowsBottomFirst: readonly string[]): CellMask {
  const rows = rowsBottomFirst.length;
  const cols = rowsBottomFirst[0].length;
  const cells: (0 | 1)[] = [];
  for (const row of rowsBottomFirst) {
    for (const ch of row) cells.push(ch === '#' ? 1 : 0);
  }
  return { cols, rows, cells };
}

const inSlab = (s: LidKeepoutSlab, x: number, y: number, tol = 1e-6): boolean =>
  x >= s.minX - tol && x <= s.maxX + tol && y >= s.minY - tol && y <= s.maxY + tol;

const covered = (slabs: readonly LidKeepoutSlab[], x: number, y: number): boolean =>
  slabs.some((s) => inSlab(s, x, y));

/** Is `(x, y)` inside the filled footprint? */
function filledAt(mask: CellMask, x: number, y: number): boolean {
  const halfW = (mask.cols * MASK_CELL_SIZE * PITCH) / 2;
  const halfD = (mask.rows * MASK_CELL_SIZE * PITCH) / 2;
  const col = Math.floor((x + halfW) / (MASK_CELL_SIZE * PITCH));
  const row = Math.floor((y + halfD) / (MASK_CELL_SIZE * PITCH));
  if (col < 0 || col >= mask.cols || row < 0 || row >= mask.rows) return false;
  return mask.cells[row * mask.cols + col] === 1;
}

/**
 * Chebyshev distance from `(x, y)` to the outside of the footprint, in mm — the
 * erosion the slab union is supposed to equal. Sampled rather than derived, so
 * it is an independent opinion about the same set.
 */
function distanceToOutside(mask: CellMask, x: number, y: number, limit: number): number {
  if (!filledAt(mask, x, y)) return 0;
  for (let r = 0.25; r <= limit; r += 0.25) {
    for (const [dx, dy] of [
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
      [r, r],
      [r, -r],
      [-r, r],
      [-r, -r],
    ] as const) {
      if (!filledAt(mask, x + dx, y + dy)) return r;
    }
  }
  return limit + 1;
}

describe('lidKeepoutSlabs', () => {
  it('lays the same band a full mask’s rectangle ring does', () => {
    // The equivalence that lets one flag serve both footprints. A fully-filled
    // mask is the one shape both paths describe, so they have to agree on it or
    // a polygon bin is relieved to a different depth than a rectangle.
    const mask = maskFrom(['####', '####', '####', '####']);
    const slabs = lidKeepoutSlabs(mask, PITCH, PITCH, WALL);
    const outerW = 2 * PITCH - GRIDFINITY_SPEC.TOLERANCE;
    const ring = lidKeepoutRing(outerW - 2 * WALL, outerW - 2 * WALL, WALL);

    const halfMask = (4 * MASK_CELL_SIZE * PITCH) / 2;
    // Outer boundary: the outermost covered point on the +X axis.
    const outermost = Math.max(...slabs.map((s) => s.maxX));
    expect(outermost).toBeCloseTo(halfMask - LID_KEEPOUT_OUTLINE_INSET_MM, 6);
    expect(outermost).toBeCloseTo(ring.outerHalfX, 6);

    // ...and the band reaches exactly `width` inward from it.
    expect(covered(slabs, ring.outerHalfX - ring.width + 0.05, 0)).toBe(true);
    expect(covered(slabs, ring.outerHalfX - ring.width - 0.05, 0)).toBe(false);
  });

  it('covers each corner, which is where a per-edge band could leave a gap', () => {
    const mask = maskFrom(['####', '####', '####', '####']);
    const slabs = lidKeepoutSlabs(mask, PITCH, PITCH, WALL);
    const ring = lidKeepoutRing(0, 0, WALL);
    const half = (4 * MASK_CELL_SIZE * PITCH) / 2 - LID_KEEPOUT_OUTLINE_INSET_MM;
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        // Just inside the ring's outer corner, and just inside its inner corner.
        expect(covered(slabs, sx * (half - 0.05), sy * (half - 0.05))).toBe(true);
        expect(
          covered(slabs, sx * (half - ring.width + 0.05), sy * (half - ring.width + 0.05))
        ).toBe(true);
      }
    }
  });

  it('never reaches outside the footprint’s own material', () => {
    // The band must not touch the wall or the lip's undercut. Every covered
    // point has to be at least the outline inset deep inside the shape.
    const mask = maskFrom(['###', '###', '#..', '#..']);
    const slabs = lidKeepoutSlabs(mask, PITCH, PITCH, WALL);
    for (const s of slabs) {
      for (const [x, y] of [
        [s.minX + 0.01, s.minY + 0.01],
        [s.maxX - 0.01, s.maxY - 0.01],
        [s.minX + 0.01, s.maxY - 0.01],
        [s.maxX - 0.01, s.minY + 0.01],
      ] as const) {
        expect(distanceToOutside(mask, x, y, 6)).toBeGreaterThan(0);
      }
    }
  });

  it('matches an independent erosion of an L-shape', () => {
    // Sampled both ways: a point is in the band exactly when it is inside the
    // shape but within `inset + width` of the outside. The reflex corner is the
    // case a true offset gets wrong, so it is the point of this shape.
    const mask = maskFrom(['###', '###', '#..', '#..']);
    const slabs = lidKeepoutSlabs(mask, PITCH, PITCH, WALL);
    const reach = LID_KEEPOUT_OUTLINE_INSET_MM + lidKeepoutWidthMm(WALL);
    const halfW = (3 * MASK_CELL_SIZE * PITCH) / 2;
    const halfD = (4 * MASK_CELL_SIZE * PITCH) / 2;

    let checked = 0;
    for (let x = -halfW + 0.5; x < halfW; x += 2.5) {
      for (let y = -halfD + 0.5; y < halfD; y += 2.5) {
        const depth = distanceToOutside(mask, x, y, reach + 2);
        // Skip the band either side of each boundary, where a 0.25mm-stepped
        // distance and an exact half-plane test legitimately disagree.
        if (Math.abs(depth - LID_KEEPOUT_OUTLINE_INSET_MM) < 0.6) continue;
        if (Math.abs(depth - reach) < 0.6) continue;
        const shouldCover = depth > LID_KEEPOUT_OUTLINE_INSET_MM && depth < reach;
        expect(covered(slabs, x, y), `at (${x.toFixed(1)}, ${y.toFixed(1)}) depth ${depth}`).toBe(
          shouldCover
        );
        checked++;
      }
    }
    // Anti-vacuity: a sampling bug that skipped everything would pass silently.
    expect(checked).toBeGreaterThan(200);
  });

  it('fills the diagonal wedge at a reflex corner', () => {
    // Two perpendicular bands do not cover a reflex corner: this point is 3mm
    // from one edge and 4mm from the other, so it clears both bands' reach
    // while sitting 4mm from the void along the diagonal — inside a 5.8mm ring.
    // Left un-relieved it is a wedge of material right where an L-shaped bin's
    // inner corner meets the lid.
    const mask = maskFrom(['###', '###', '#..', '#..']);
    const slabs = lidKeepoutSlabs(mask, PITCH, PITCH, WALL);
    expect(covered(slabs, -13.5, -4)).toBe(true);
    // ...and the wedge stops where the ring does. 1mm from the void on both
    // axes is wall, not ring, and cutting it would thin the corner.
    expect(covered(slabs, -11.5, -1)).toBe(false);
  });

  it('follows a hole’s edges into the surrounding material, not into the hole', () => {
    // The inner-loop trap: an offset pushes a hole's band the wrong way. The
    // band belongs around the hole, in the ring of material bounding it.
    const mask = maskFrom(['####', '#..#', '#..#', '####']);
    const slabs = lidKeepoutSlabs(mask, PITCH, PITCH, WALL);
    const cell = MASK_CELL_SIZE * PITCH;
    // Dead centre of the 2x2-cell hole: void, so nothing may cover it.
    expect(covered(slabs, 0, 0)).toBe(false);
    // Just outside the hole's wall, inside the material: covered.
    const holeEdge = cell;
    expect(covered(slabs, holeEdge + LID_KEEPOUT_OUTLINE_INSET_MM + 0.2, 0)).toBe(true);
  });

  it('takes a neck whole when it is narrower than two bands', () => {
    // Where a true offset self-intersects. With a 6mm pitch a single cell is
    // 3mm across, far under `2 * (inset + width)`, so the bands from both sides
    // overlap and the neck is entirely keep-out — which is what eroding it to
    // nothing means.
    const mask = maskFrom(['###', '.#.', '###']);
    const slabs = lidKeepoutSlabs(mask, 6, 6, WALL);
    expect(slabs.length).toBeGreaterThan(0);
    // The neck's centre line is covered from both sides rather than left as a
    // surviving core.
    expect(covered(slabs, 0, 0)).toBe(true);
  });
});
