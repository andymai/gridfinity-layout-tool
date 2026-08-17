import { describe, it, expect } from 'vitest';
import {
  detachableFeetPlacements,
  footArmMm,
  footPinPositions,
  type DetachableFeetInput,
  type FootPlacement,
} from './detachableFeetPlan';
import { MAX_FOOT_SPAN_MM } from '@/features/bin-designer/types';

const STOCK_MAGNET_MM = 6.5;
const PIN_MM = 5;
/** What the magnet placement resolves to at 42mm pitch: 21 - 13. */
const SPEC_MAGNET_INSET_MM = 8;
const ARM = footArmMm({
  magnetDiameterMm: STOCK_MAGNET_MM,
  magnetInsetFromEdgeMm: SPEC_MAGNET_INSET_MM,
  pinDiameterMm: PIN_MM,
});

function plan(over: Partial<DetachableFeetInput>): FootPlacement[] {
  return detachableFeetPlacements({
    widthUnits: 3,
    depthUnits: 2,
    pitchX: 42,
    pitchY: 42,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    latticeX: 'grid',
    latticeY: 'grid',
    armMm: ARM,
    ...over,
  });
}

/** Largest unsupported run of floor along one axis, in mm. */
function worstSpan(feet: FootPlacement[], axis: 'x' | 'y'): number {
  const runs = feet.map((f) => {
    const pos = axis === 'x' ? f.x : f.y;
    const dir = axis === 'x' ? f.dirX : f.dirY;
    const cell = axis === 'x' ? f.cellW : f.cellD;
    return dir === 0
      ? { from: pos - cell / 2, to: pos + cell / 2 }
      : dir < 0
        ? { from: pos, to: pos + ARM }
        : { from: pos - ARM, to: pos };
  });
  const merged = [...runs].sort((a, b) => a.from - b.from);
  let worst = 0;
  for (let i = 1; i < merged.length; i++) {
    worst = Math.max(worst, merged[i].from - merged[i - 1].to);
  }
  return worst;
}

describe('footArmMm', () => {
  it('is driven by the magnet it has to contain at spec pitch', () => {
    // 8mm inset from the cell edge + 3.25mm radius + 1.2mm of solid around it.
    expect(ARM).toBeCloseTo(12.45, 5);
  });

  it('never gets so narrow that the foot stands on a knife edge', () => {
    // With no magnet the pin run alone would give 5.4mm at 3mm pins, and the
    // socket taper takes 3.2mm of that off the bottom face — leaving 2.2mm of
    // strip actually touching the pocket floor.
    expect(footArmMm({ pinDiameterMm: 3 })).toBeCloseTo(7.2, 5);
    expect(footArmMm({ pinDiameterMm: 3 }) - 3.2).toBeGreaterThanOrEqual(4);
  });

  it('shrinks with the inset, so a small cell does not oversize its foot', () => {
    // Down to the standing floor, which no input may cross.
    expect(
      footArmMm({
        magnetDiameterMm: STOCK_MAGNET_MM,
        magnetInsetFromEdgeMm: 2,
        pinDiameterMm: PIN_MM,
      })
    ).toBeCloseTo(7.4, 5);
  });

  it('grows with the magnet, so a larger magnet cannot be clipped by its own foot', () => {
    const big = footArmMm({
      magnetDiameterMm: 10,
      magnetInsetFromEdgeMm: SPEC_MAGNET_INSET_MM,
      pinDiameterMm: PIN_MM,
    });
    expect(big).toBeGreaterThan(ARM);
    expect(big).toBeCloseTo(8 + 5 + 1.2, 5);
  });
});

describe('detachableFeetPlacements', () => {
  it('puts four L feet at the corners of a bin that needs no mid-span support', () => {
    const feet = plan({ widthUnits: 3, depthUnits: 2 });
    expect(feet).toHaveLength(4);
    expect(feet.every((f) => f.shape === 'L')).toBe(true);
    expect(new Set(feet.map((f) => `${f.x},${f.y}`))).toEqual(
      new Set(['-63,-42', '-63,42', '63,-42', '63,42'])
    );
  });

  it('spans a single-cell axis with a bar rather than crowding four L feet on it', () => {
    const feet = plan({ widthUnits: 1, depthUnits: 4 });
    expect(feet.every((f) => f.shape === 'bar')).toBe(true);
    // Every foot spans X, and sits on the bin's centreline in X because of it.
    expect(feet.every((f) => f.dirX === 0)).toBe(true);
    expect(feet.every((f) => f.x === 0)).toBe(true);
  });

  it('gives a 1x1 two bars, not one', () => {
    const feet = plan({ widthUnits: 1, depthUnits: 1 });
    expect(feet).toHaveLength(2);
    expect(feet.every((f) => f.shape === 'bar' && f.dirX === 0)).toBe(true);
    expect(feet.map((f) => f.y).sort((a, b) => a - b)).toEqual([-21, 21]);
  });

  it('adds a mid-span pair on a long bin, and they are bars', () => {
    const feet = plan({ widthUnits: 6, depthUnits: 3 });
    expect(feet).toHaveLength(6);
    expect(feet.filter((f) => f.shape === 'L')).toHaveLength(4);
    const mids = feet.filter((f) => f.shape === 'bar');
    expect(mids).toHaveLength(2);
    // The mid pair spans X and sits on the two Y edges.
    expect(mids.every((f) => f.dirX === 0 && f.dirY !== 0)).toBe(true);
  });

  it('never leaves a run longer than the limit, across a range of sizes', () => {
    for (const [w, d] of [
      [1, 1],
      [2, 1],
      [3, 2],
      [2, 4],
      [6, 3],
      [6, 6],
      [8, 2],
      [10, 10],
    ] as Array<[number, number]>) {
      const feet = plan({ widthUnits: w, depthUnits: d });
      expect(feet.length).toBeGreaterThan(0);
      expect(worstSpan(feet, 'x')).toBeLessThanOrEqual(MAX_FOOT_SPAN_MM + 1e-6);
      expect(worstSpan(feet, 'y')).toBeLessThanOrEqual(MAX_FOOT_SPAN_MM + 1e-6);
    }
  });

  it('skips the foot that would land under the middle of the floor', () => {
    // Both axes need a span filler, so the filler/filler pair exists and must
    // be dropped: 3 x 3 stations is 9, minus the one with no wall above it.
    const feet = plan({ widthUnits: 6, depthUnits: 6 });
    expect(feet).toHaveLength(8);
    expect(feet.some((f) => f.dirX === 0 && f.dirY === 0)).toBe(false);
  });

  it('anchors to whole cells, so a fractional edge does not carry a foot', () => {
    const halfWidthMm = (2.5 * 42) / 2;
    const atEnd = plan({ widthUnits: 2.5, depthUnits: 2, fractionalEdgeX: 'end' });
    // The +X feet sit on whole cell 1, a half unit inboard of the outline.
    expect(Math.max(...atEnd.map((f) => f.x))).toBeCloseTo(halfWidthMm - 21, 5);
    expect(Math.min(...atEnd.map((f) => f.x))).toBeCloseTo(-halfWidthMm, 5);

    const atStart = plan({ widthUnits: 2.5, depthUnits: 2, fractionalEdgeX: 'start' });
    expect(Math.min(...atStart.map((f) => f.x))).toBeCloseTo(-halfWidthMm + 21, 5);
    expect(Math.max(...atStart.map((f) => f.x))).toBeCloseTo(halfWidthMm, 5);
  });

  it('has no feet to place when an axis has no whole cell', () => {
    expect(plan({ widthUnits: 0.5, depthUnits: 2 })).toEqual([]);
  });

  it('follows a non-square pitch on each axis independently', () => {
    const feet = plan({ widthUnits: 2, depthUnits: 2, pitchX: 42, pitchY: 30 });
    expect(Math.max(...feet.map((f) => f.x))).toBeCloseTo(42, 5);
    expect(Math.max(...feet.map((f) => f.y))).toBeCloseTo(30, 5);
  });
});

describe('footPinPositions', () => {
  const inCell = (p: { x: number; y: number }, f: FootPlacement): boolean =>
    Math.abs(p.x - f.x) <= f.cellW && Math.abs(p.y - f.y) <= f.cellD;

  it('puts three pins on an L, all inboard of its corner', () => {
    const foot = plan({ widthUnits: 3, depthUnits: 2 }).find((f) => f.shape === 'L');
    if (!foot) throw new Error('expected an L foot');
    const pins = footPinPositions(foot, ARM, PIN_MM);
    expect(pins).toHaveLength(3);
    for (const p of pins) {
      expect(Math.abs(p.x)).toBeLessThan(Math.abs(foot.x));
      expect(Math.abs(p.y)).toBeLessThan(Math.abs(foot.y));
      expect(inCell(p, foot)).toBe(true);
    }
  });

  it('puts two pins along a bar, both inside the arm it sits in', () => {
    const foot = plan({ widthUnits: 1, depthUnits: 1 })[0];
    const pins = footPinPositions(foot, ARM, PIN_MM);
    expect(pins).toHaveLength(2);
    // Spread along the span, and at ONE depth: a second row would land past the
    // foot's inner face, leaving pins in mid air.
    expect(new Set(pins.map((p) => p.x.toFixed(4))).size).toBe(2);
    expect(new Set(pins.map((p) => p.y.toFixed(4))).size).toBe(1);
    for (const p of pins) {
      expect(inCell(p, foot)).toBe(true);
      // Inside the arm's depth, measured from the edge it hugs.
      expect(Math.abs(p.y - foot.y)).toBeLessThanOrEqual(ARM);
    }
  });

  it('keeps every pin inside the bin footprint on a fractional bin', () => {
    const feet = plan({ widthUnits: 2.5, depthUnits: 2 });
    const halfW = (2.5 * 42) / 2;
    const halfD = (2 * 42) / 2;
    for (const foot of feet) {
      for (const p of footPinPositions(foot, ARM, PIN_MM)) {
        expect(Math.abs(p.x)).toBeLessThan(halfW);
        expect(Math.abs(p.y)).toBeLessThan(halfD);
      }
    }
  });
});

/**
 * Where the bin SITS decides where its feet can go, per axis. Anchoring to the
 * bin's own whole cells is right only when the bin is on-grid: half-bin mode
 * places it half a unit off, and then every cell of it straddles two pockets.
 */
describe('half-offset placement', () => {
  it('shifts the anchors half a unit inboard so each foot lands in one pocket', () => {
    const halfWidthMm = (3 * 42) / 2;
    const feet = plan({ widthUnits: 3, depthUnits: 3, latticeX: 'half' });
    // On-grid the outer feet sit at the bin's edge; here they sit 0.5u inboard,
    // which is the only X where a full-size foot fits inside a single pocket.
    expect(Math.min(...feet.map((f) => f.x))).toBeCloseTo(-halfWidthMm + 21, 5);
    expect(Math.max(...feet.map((f) => f.x))).toBeCloseTo(halfWidthMm - 21, 5);
  });

  it('is per axis, because half-bin mode offsets the axes independently', () => {
    const feet = plan({ widthUnits: 3, depthUnits: 3, latticeX: 'half', latticeY: 'grid' });
    expect(Math.min(...feet.map((f) => f.x))).toBeCloseTo(-63 + 21, 5);
    expect(Math.min(...feet.map((f) => f.y))).toBeCloseTo(-63, 5);
  });

  it('reports no placement for a 1-wide bin that is half-offset', () => {
    // It spans 0.5u..1.5u of the plate, so there is no whole pocket under it at
    // all. Better to say so than to place a foot that perches on a ridge.
    expect(plan({ widthUnits: 1, depthUnits: 4, latticeX: 'half' })).toEqual([]);
  });

  it('ignores the lattice on a fractional axis, which already carries a half cell', () => {
    const asGrid = plan({ widthUnits: 2.5, depthUnits: 2, latticeX: 'grid' });
    const asHalf = plan({ widthUnits: 2.5, depthUnits: 2, latticeX: 'half' });
    expect(asHalf).toEqual(asGrid);
  });
});
