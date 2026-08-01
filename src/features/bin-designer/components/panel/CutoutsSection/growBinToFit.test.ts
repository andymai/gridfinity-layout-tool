import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams, Cutout, PathPoint } from '@/features/bin-designer/types';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import type { CellMask } from '@/shared/utils/cellMask';
import { computeGrowToFit } from './growBinToFit';

/** Default wall thickness (1.2mm) + tolerance ⇒ interior = 42u − 2.9. */
const params = (overrides: Partial<BinParams> = {}): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  width: 3,
  depth: 3,
  cutouts: [],
  ...overrides,
});

const cutout = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'c1',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 20,
  depth: 20,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  locked: false,
  hidden: false,
  ...overrides,
});

const corner = (x: number, y: number): PathPoint => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: true,
});

const gridArray = (cols: number, rows: number, pitchX: number, pitchY: number) =>
  ({
    mode: 'grid',
    cols,
    rows,
    pitchX,
    pitchY,
    count: 1,
    radius: 0,
    startAngle: 0,
    rotateToCenter: false,
  }) as const;

const fullMask = (cols: number, rows: number): CellMask => ({
  cols,
  rows,
  cells: Array.from({ length: cols * rows }, () => 1 as const),
});

describe('computeGrowToFit', () => {
  it('returns null when every cutout already fits', () => {
    const p = params();
    expect(computeGrowToFit(p, [cutout()], false)).toBeNull();
  });

  it('returns null for a cutout flush with the board edge', () => {
    const p = params();
    const { innerW } = cutoutInterior(p);
    expect(computeGrowToFit(p, [cutout({ x: 0, width: innerW })], false)).toBeNull();
  });

  it('grows to the next whole grid unit with half-grid mode off (#3061)', () => {
    // 3u interior is 123.1mm; the reported repro types 156mm.
    const p = params();
    expect(computeGrowToFit(p, [cutout({ width: 156 })], false)).toEqual({ width: 4, depth: 3 });
  });

  it('uses half-unit steps when half-grid mode is on', () => {
    // 130mm needs more than 3u (123.1) but fits 3.5u (144.1).
    const p = params();
    expect(computeGrowToFit(p, [cutout({ width: 130 })], true)).toEqual({ width: 3.5, depth: 3 });
    expect(computeGrowToFit(p, [cutout({ width: 130 })], false)).toEqual({ width: 4, depth: 3 });
  });

  it('keeps an existing fractional dimension when half-grid mode is off', () => {
    const p = params({ width: 2.5 });
    expect(computeGrowToFit(p, [cutout({ width: 130 })], false)).toEqual({ width: 3.5, depth: 3 });
  });

  it('grows each axis independently', () => {
    const p = params();
    expect(computeGrowToFit(p, [cutout({ width: 156, depth: 200 })], false)).toEqual({
      width: 4,
      depth: 5,
    });
  });

  it('sizes for the full cutout footprint, not just its width', () => {
    const p = params();
    // Offset 100 + width 60 = 140mm of board needed on X.
    expect(computeGrowToFit(p, [cutout({ x: 100, width: 60 })], false)).toEqual({
      width: 4,
      depth: 3,
    });
  });

  it('accounts for array instances, not only the master', () => {
    const p = params();
    const master = cutout({ width: 20, array: gridArray(4, 1, 45, 0) });
    // Instances at x = 0, 45, 90, 135 ⇒ far edge 155mm.
    expect(computeGrowToFit(p, [master], false)).toEqual({ width: 4, depth: 3 });
  });

  it('takes the union across every cutout so one click clears the warning', () => {
    const p = params();
    const result = computeGrowToFit(
      p,
      [cutout({ id: 'a', width: 156 }), cutout({ id: 'b', depth: 200 })],
      false
    );
    expect(result).toEqual({ width: 4, depth: 5 });
  });

  it('returns null past MAX_DIMENSION rather than growing partway', () => {
    const p = params();
    expect(computeGrowToFit(p, [cutout({ width: 900 })], false)).toBeNull();
  });

  it('returns null for a custom (partial) footprint', () => {
    const mask = fullMask(3, 3);
    const partial: CellMask = { ...mask, cells: mask.cells.map((_, i) => (i === 0 ? 0 : 1)) };
    const p = params({ cellMask: partial });
    expect(computeGrowToFit(p, [cutout({ width: 156 })], false)).toBeNull();
  });

  it('still grows for a fully-filled mask, which is not a custom shape', () => {
    const p = params({ cellMask: fullMask(6, 6) });
    expect(computeGrowToFit(p, [cutout({ width: 156 })], false)).toEqual({ width: 4, depth: 3 });
  });

  it('returns null when a cutout hangs past the origin edge', () => {
    // Growing only moves the far edges, so this can never clear the warning.
    const p = params();
    const path = [corner(-10, 10), corner(60, 10), corner(60, 60), corner(-10, 60)];
    expect(
      computeGrowToFit(p, [cutout({ shape: 'path', path, width: 70, depth: 50 })], false)
    ).toBe(null);
  });

  it('folds per-side overhang into the interior it measures', () => {
    // Overhang grows the interior floor, so less grid growth is needed.
    const withOverhang = params({
      overhang: { enabled: true, left: 20, right: 20, front: 0, back: 0 },
    });
    const { innerW } = cutoutInterior(withOverhang);
    expect(innerW).toBeGreaterThan(cutoutInterior(params()).innerW);
    expect(computeGrowToFit(withOverhang, [cutout({ width: 156 })], false)).toBeNull();
  });
});
