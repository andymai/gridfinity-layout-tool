import { describe, it, expect } from 'vitest';
import type { DrawerOutline } from '@/core/types';
import { cornerCutVertices } from '@/shared/utils/cornerCutOutline';
import { turnedPlateOverhangMm, type TurnOverhangInput } from './plateTurnOverhang';

const U = 42;

const plate = (o: Partial<TurnOverhangInput> = {}): TurnOverhangInput => ({
  width: 3,
  depth: 2,
  gridUnitMm: U,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  ...o,
});

function cells(vertices: readonly (readonly [number, number])[]): DrawerOutline {
  return { vertices: vertices.map(([x, y]) => ({ x: x * U, y: y * U })) };
}

/** Front row of three plus the back-left cell. */
const L_SHAPE = cells([
  [0, 0],
  [3, 0],
  [3, 1],
  [1, 1],
  [1, 2],
  [0, 2],
]);

/** Back-middle cell missing. */
const U_SHAPE = cells([
  [0, 0],
  [3, 0],
  [3, 2],
  [2, 2],
  [2, 1],
  [1, 1],
  [1, 2],
  [0, 2],
]);

/** Right-middle cell missing on a 2×3 plate. */
const C_SHAPE = cells([
  [0, 0],
  [2, 0],
  [2, 1],
  [1, 1],
  [1, 2],
  [2, 2],
  [2, 3],
  [0, 3],
]);

const rounded = (w: number, d: number, r: number, onlyTl = false): DrawerOutline => {
  const arc = { kind: 'radius', r } as const;
  const none = { kind: 'none' } as const;
  return {
    vertices: cornerCutVertices(w, d, {
      tl: arc,
      tr: onlyTl ? none : arc,
      bl: onlyTl ? none : arc,
      br: onlyTl ? none : arc,
    }),
  };
};

describe('turnedPlateOverhangMm', () => {
  it('is zero for a plate without an outline', () => {
    expect(turnedPlateOverhangMm(plate(), 'x', 0)).toBe(0);
  });

  it('measures the cells an L turned over puts past the plate below, about either axis', () => {
    expect(turnedPlateOverhangMm(plate({ outline: L_SHAPE }), 'x', 0)).toBeGreaterThan(U / 2);
    expect(turnedPlateOverhangMm(plate({ outline: L_SHAPE }), 'y', 0)).toBeGreaterThan(U / 2);
  });

  it('is zero about the axis a shape is symmetric about, and half a cell about the other', () => {
    expect(turnedPlateOverhangMm(plate({ outline: U_SHAPE }), 'y', 0)).toBeLessThan(1e-6);
    expect(turnedPlateOverhangMm(plate({ outline: U_SHAPE }), 'x', 0)).toBeCloseTo(U / 2, 0);
    const c = plate({ width: 2, depth: 3, outline: C_SHAPE });
    expect(turnedPlateOverhangMm(c, 'x', 0)).toBeLessThan(1e-6);
    expect(turnedPlateOverhangMm(c, 'y', 0)).toBeCloseTo(U / 2, 0);
  });

  it('reads a uniformly rounded perimeter as symmetric despite its flattened arcs', () => {
    const p = plate({ width: 4, depth: 3, outline: rounded(4 * U, 3 * U, 30) });
    expect(turnedPlateOverhangMm(p, 'x', 0)).toBeLessThan(0.2);
    expect(turnedPlateOverhangMm(p, 'y', 0)).toBeLessThan(0.2);
  });

  it('catches a lone rounded corner the turn carries to the other side', () => {
    const p = plate({ width: 4, depth: 3, outline: rounded(4 * U, 3 * U, 30, true) });
    expect(turnedPlateOverhangMm(p, 'x', 0)).toBeGreaterThan(2);
    expect(turnedPlateOverhangMm(p, 'y', 0)).toBeGreaterThan(2);
  });

  it('counts padding on one side, which the turn moves off the lattice centre', () => {
    const p = plate({
      width: 4,
      depth: 3,
      paddingFront: 8.5,
      outline: rounded(4 * U, 3 * U + 8.5, 30),
    });
    expect(turnedPlateOverhangMm(p, 'x', 0)).toBeCloseTo(8.5, 0);
    expect(turnedPlateOverhangMm(p, 'y', 0)).toBeLessThan(0.2);
  });

  it('applies the seat a fractional extent turns with', () => {
    // 2.5 units wide with the half cell at the end: the Y turn seats the full
    // cells back on the plate below and leaves the half cell hanging past it.
    const p = plate({
      width: 2.5,
      depth: 2,
      outline: cells([
        [0, 0],
        [2.5, 0],
        [2.5, 2],
        [0, 2],
      ]),
    });
    expect(turnedPlateOverhangMm(p, 'y', -U / 2)).toBeCloseTo(U / 2, 0);
    expect(turnedPlateOverhangMm(p, 'y', 0)).toBeLessThan(1e-6);
  });

  it('reads a small cut corner at its full depth', () => {
    const c = 2.8;
    const p = plate({
      outline: {
        vertices: [
          { x: 0, y: 0 },
          { x: 3 * U, y: 0 },
          { x: 3 * U, y: 2 * U },
          { x: c, y: 2 * U },
          { x: 0, y: 2 * U - c },
        ],
      },
    });
    // The turned copy's square corner reaches c / sqrt(2) past the cut.
    expect(turnedPlateOverhangMm(p, 'x', 0)).toBeGreaterThan(1.8);
    expect(turnedPlateOverhangMm(p, 'y', 0)).toBeGreaterThan(1.8);
  });

  it('measures to the plate the slab keeps, not to outline the slab cuts away', () => {
    // A split piece keeps its parent's outline: here it runs 1mm past the slab
    // at the front and left, where there is no plate to rest on.
    const p = plate({
      outline: cells([
        [0, 0],
        [3, 0],
        [3, 2],
        [0, 2],
      ]),
      outlineOverhang: { left: 0, right: 1, front: 0, back: 1 },
    });
    const shifted = {
      ...p,
      outline: {
        vertices: (p.outline?.vertices ?? []).map((v) => ({ x: v.x + 1, y: v.y + 1 })),
      },
    };
    expect(turnedPlateOverhangMm(shifted, 'x', 0)).toBeGreaterThan(1);
  });

  it('stops at the first reading past a limit', () => {
    const p = plate({ outline: L_SHAPE });
    const limited = turnedPlateOverhangMm(p, 'x', 0, 1);
    expect(limited).toBeGreaterThan(1);
    expect(limited).toBeLessThanOrEqual(turnedPlateOverhangMm(p, 'x', 0));
    expect(turnedPlateOverhangMm(plate({ outline: U_SHAPE }), 'y', 0, 1)).toBeLessThan(1e-6);
  });
});
