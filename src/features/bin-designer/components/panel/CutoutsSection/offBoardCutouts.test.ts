import { describe, it, expect } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import {
  isCutoutOffBoard,
  getOffBoardCutoutIds,
  clampCutoutToBoard,
  clampOffBoardCutouts,
} from './offBoardCutouts';

const createCutout = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'test',
  shape: 'rectangle',
  x: 10,
  y: 10,
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

const BIN_W = 100;
const BIN_D = 80;

describe('isCutoutOffBoard', () => {
  it('returns false for a cutout fully inside the board', () => {
    expect(isCutoutOffBoard(createCutout(), BIN_W, BIN_D)).toBe(false);
  });

  it('treats a flush edge as in-bounds (within tolerance)', () => {
    const flush = createCutout({ x: 0, y: 0, width: BIN_W, depth: BIN_D });
    expect(isCutoutOffBoard(flush, BIN_W, BIN_D)).toBe(false);
  });

  it('flags overhang past the right/top edge', () => {
    expect(isCutoutOffBoard(createCutout({ x: 90, width: 20 }), BIN_W, BIN_D)).toBe(true);
    expect(isCutoutOffBoard(createCutout({ y: 70, depth: 20 }), BIN_W, BIN_D)).toBe(true);
  });

  it('flags a negative position past the origin', () => {
    expect(isCutoutOffBoard(createCutout({ x: -5 }), BIN_W, BIN_D)).toBe(true);
  });

  it('accounts for rotation widening the footprint', () => {
    const corner20 = createCutout({ x: 80, y: 30, width: 20, depth: 20, rotation: 0 });
    expect(isCutoutOffBoard(corner20, BIN_W, BIN_D)).toBe(false);
    expect(isCutoutOffBoard({ ...corner20, rotation: 45 }, BIN_W, BIN_D)).toBe(true);
  });

  it('uses actual path vertices, not stale width/depth metadata', () => {
    // In-bounds width/depth, but vertices reach past the right edge — a
    // rectangle-only check would miss this; path bounds catch it.
    const path = createCutout({
      shape: 'path',
      x: 10,
      y: 10,
      width: 20,
      depth: 20,
      path: [corner(90, 10), corner(110, 10), corner(110, 30), corner(90, 30)],
    });
    expect(isCutoutOffBoard(path, BIN_W, BIN_D)).toBe(true);
  });

  it('accounts for rotation when measuring a path footprint', () => {
    // A thin horizontal bar near the top edge: its unrotated bounds fit, but
    // rotating it 90° stands it on end and pushes it past the bottom/top.
    const bar = createCutout({
      shape: 'path',
      x: 10,
      y: 75,
      width: 50,
      depth: 4,
      path: [corner(10, 75), corner(60, 75), corner(60, 79), corner(10, 79)],
    });
    expect(isCutoutOffBoard(bar, BIN_W, BIN_D)).toBe(false);
    expect(isCutoutOffBoard({ ...bar, rotation: 90 }, BIN_W, BIN_D)).toBe(true);
  });

  it('flags a cutout over an unfilled mask cell even when inside the rectangle', () => {
    // 2×2 L-shaped mask: every cell filled except the top-right.
    const mask: CellMask = { cols: 2, rows: 2, cells: [1, 1, 1, 0] };
    const cellSize = { cellMmX: 50, cellMmY: 50 };
    const overNotch = createCutout({ x: 60, y: 60, width: 30, depth: 30 });
    // Inside the bounding rectangle (no mask) → not off-board…
    expect(isCutoutOffBoard(overNotch, 100, 100)).toBe(false);
    // …but it covers the unfilled cell, so the masked check flags it.
    expect(isCutoutOffBoard(overNotch, 100, 100, mask, cellSize)).toBe(true);
  });

  it('flags an array whose outer instance spills past the edge', () => {
    // Master fits at 70..90, but a 2-wide grid puts a second instance at 110..130.
    const arr = createCutout({
      x: 70,
      y: 10,
      width: 20,
      depth: 20,
      array: gridArray(2, 1, 40, 40),
    });
    expect(isCutoutOffBoard({ ...arr, array: undefined }, BIN_W, BIN_D)).toBe(false);
    expect(isCutoutOffBoard(arr, BIN_W, BIN_D)).toBe(true);
  });
});

describe('getOffBoardCutoutIds', () => {
  it('collects only the stranded cutouts', () => {
    const inside = createCutout({ id: 'in', x: 10, y: 10 });
    const stray = createCutout({ id: 'out', x: 95, y: 10 });
    const ids = getOffBoardCutoutIds([inside, stray], BIN_W, BIN_D);
    expect([...ids]).toEqual(['out']);
  });
});

describe('clampCutoutToBoard', () => {
  it('pulls a right/top overhang back to the edge', () => {
    const stray = createCutout({ x: 95, y: 75, width: 20, depth: 20 });
    expect(clampCutoutToBoard(stray, BIN_W, BIN_D)).toEqual({ x: 80, y: 60 });
  });

  it('pulls a negative position back to the origin', () => {
    const stray = createCutout({ x: -5, y: -8, width: 20, depth: 20 });
    expect(clampCutoutToBoard(stray, BIN_W, BIN_D)).toEqual({ x: 0, y: 0 });
  });

  it('pins the min edge to the origin when the cutout is larger than the board', () => {
    const huge = createCutout({ x: 30, y: 20, width: 200, depth: 150 });
    expect(clampCutoutToBoard(huge, BIN_W, BIN_D)).toEqual({ x: 0, y: 0 });
  });

  it('returns null when the cutout is already inside', () => {
    expect(clampCutoutToBoard(createCutout(), BIN_W, BIN_D)).toBeNull();
  });

  it('produces an in-bounds result', () => {
    const stray = createCutout({ x: 95, y: 75, width: 20, depth: 20 });
    const moved = { ...stray, ...clampCutoutToBoard(stray, BIN_W, BIN_D) };
    expect(isCutoutOffBoard(moved, BIN_W, BIN_D)).toBe(false);
  });

  it('translates path vertices in lockstep with x/y', () => {
    const path = createCutout({
      shape: 'path',
      x: 10,
      y: 10,
      width: 20,
      depth: 20,
      path: [corner(90, 10), corner(110, 10), corner(110, 30), corner(90, 30)],
    });
    const moved = clampCutoutToBoard(path, BIN_W, BIN_D);
    // Path bounds span 90..110 → shift -10 on x; y already fits.
    expect(moved).not.toBeNull();
    expect(moved?.x).toBe(0);
    expect(moved?.path?.map((p) => p.x)).toEqual([80, 100, 100, 80]);
    const after = { ...path, ...moved };
    expect(isCutoutOffBoard(after, BIN_W, BIN_D)).toBe(false);
  });

  it('translates the master so every array instance fits', () => {
    const arr = createCutout({
      x: 70,
      y: 10,
      width: 20,
      depth: 20,
      array: gridArray(2, 1, 40, 40),
    });
    // Union spans 70..130 → shift -30 so instances land at 40..60 and 80..100.
    expect(clampCutoutToBoard(arr, BIN_W, BIN_D)).toEqual({ x: 40, y: 10 });
    const moved = { ...arr, ...clampCutoutToBoard(arr, BIN_W, BIN_D) };
    expect(isCutoutOffBoard(moved, BIN_W, BIN_D)).toBe(false);
  });
});

describe('clampOffBoardCutouts', () => {
  it('returns updates only for off-board cutouts', () => {
    const inside = createCutout({ id: 'in', x: 10, y: 10 });
    const stray = createCutout({ id: 'out', x: 95, y: 75 });
    const updates = clampOffBoardCutouts([inside, stray], BIN_W, BIN_D);
    expect([...updates.keys()]).toEqual(['out']);
    expect(updates.get('out')).toEqual({ x: 80, y: 60 });
  });

  it('returns an empty map when everything fits', () => {
    expect(clampOffBoardCutouts([createCutout()], BIN_W, BIN_D).size).toBe(0);
  });

  it('relocates a mask-only violation into the nearest filled region', () => {
    // Inside the bounding rectangle but over an unfilled cell — the clamp now
    // searches for a valid cell-aligned placement and moves it there.
    const mask: CellMask = { cols: 2, rows: 2, cells: [1, 1, 1, 0] };
    const cellSize = { cellMmX: 50, cellMmY: 50 };
    const overNotch = createCutout({ id: 'notch', x: 60, y: 60, width: 30, depth: 30 });
    expect(getOffBoardCutoutIds([overNotch], 100, 100, mask, cellSize).has('notch')).toBe(true);
    const updates = clampOffBoardCutouts([overNotch], 100, 100, mask, cellSize);
    expect(updates.size).toBe(1);
    const moved = { ...overNotch, ...updates.get('notch') };
    expect(isCutoutOffBoard(moved, 100, 100, mask, cellSize)).toBe(false);
  });

  it('leaves a cutout flagged when no valid mask placement exists', () => {
    // 90×90 spans the whole 2×2 grid wherever placed, so it always hits the
    // empty cell — no translation can fit it; the clamp emits nothing.
    const mask: CellMask = { cols: 2, rows: 2, cells: [1, 1, 1, 0] };
    const cellSize = { cellMmX: 50, cellMmY: 50 };
    const tooBig = createCutout({ id: 'big', x: 5, y: 5, width: 90, depth: 90 });
    expect(getOffBoardCutoutIds([tooBig], 100, 100, mask, cellSize).has('big')).toBe(true);
    expect(clampOffBoardCutouts([tooBig], 100, 100, mask, cellSize).size).toBe(0);
  });
});
