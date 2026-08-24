import { describe, it, expect } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import type { LidCutoutWindow } from '@/shared/utils/lidCutoutPlan';
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
    expect(isCutoutOffBoard(createCutout(), { width: BIN_W, depth: BIN_D })).toBe(false);
  });

  it('treats a flush edge as in-bounds (within tolerance)', () => {
    const flush = createCutout({ x: 0, y: 0, width: BIN_W, depth: BIN_D });
    expect(isCutoutOffBoard(flush, { width: BIN_W, depth: BIN_D })).toBe(false);
  });

  it('flags overhang past the right/top edge', () => {
    expect(
      isCutoutOffBoard(createCutout({ x: 90, width: 20 }), { width: BIN_W, depth: BIN_D })
    ).toBe(true);
    expect(
      isCutoutOffBoard(createCutout({ y: 70, depth: 20 }), { width: BIN_W, depth: BIN_D })
    ).toBe(true);
  });

  it('flags a negative position past the origin', () => {
    expect(isCutoutOffBoard(createCutout({ x: -5 }), { width: BIN_W, depth: BIN_D })).toBe(true);
  });

  it('accounts for rotation widening the footprint', () => {
    const corner20 = createCutout({ x: 80, y: 30, width: 20, depth: 20, rotation: 0 });
    expect(isCutoutOffBoard(corner20, { width: BIN_W, depth: BIN_D })).toBe(false);
    expect(isCutoutOffBoard({ ...corner20, rotation: 45 }, { width: BIN_W, depth: BIN_D })).toBe(
      true
    );
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
    expect(isCutoutOffBoard(path, { width: BIN_W, depth: BIN_D })).toBe(true);
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
    expect(isCutoutOffBoard(bar, { width: BIN_W, depth: BIN_D })).toBe(false);
    expect(isCutoutOffBoard({ ...bar, rotation: 90 }, { width: BIN_W, depth: BIN_D })).toBe(true);
  });

  it('flags a cutout over an unfilled mask cell even when inside the rectangle', () => {
    // 2×2 L-shaped mask: every cell filled except the top-right.
    const mask: CellMask = { cols: 2, rows: 2, cells: [1, 1, 1, 0] };
    const cellSize = { cellMmX: 50, cellMmY: 50 };
    const overNotch = createCutout({ x: 60, y: 60, width: 30, depth: 30 });
    // Inside the bounding rectangle (no mask) → not off-board…
    expect(isCutoutOffBoard(overNotch, { width: 100, depth: 100 })).toBe(false);
    // …but it covers the unfilled cell, so the masked check flags it.
    expect(
      isCutoutOffBoard(overNotch, { width: 100, depth: 100, mask: mask, cellSize: cellSize })
    ).toBe(true);
  });

  // Issue: "1 cutout(s) outside the board" on a concave cutout that is
  // entirely on the board — its bounding box, not the cutout, spanned the notch.
  it('does not flag a concave path nested inside the notch of an L-shaped board', () => {
    const mask: CellMask = { cols: 2, rows: 2, cells: [1, 1, 1, 0] };
    const cellSize = { cellMmX: 50, cellMmY: 50 };
    // L-shaped path hugging the three filled cells; its box is the full 100×100.
    const lShape = createCutout({
      shape: 'path',
      x: 2,
      y: 2,
      width: 96,
      depth: 96,
      path: [
        corner(2, 2),
        corner(98, 2),
        corner(98, 48),
        corner(48, 48),
        corner(48, 98),
        corner(2, 98),
      ],
    });
    expect(
      isCutoutOffBoard(lShape, { width: 100, depth: 100, mask: mask, cellSize: cellSize })
    ).toBe(false);
    expect(
      getOffBoardCutoutIds([lShape], { width: 100, depth: 100, mask: mask, cellSize: cellSize })
        .size
    ).toBe(0);
    expect(
      clampOffBoardCutouts([lShape], { width: 100, depth: 100, mask: mask, cellSize: cellSize })
        .size
    ).toBe(0);
  });

  it('still flags a concave path whose arm crosses into the notch', () => {
    const mask: CellMask = { cols: 2, rows: 2, cells: [1, 1, 1, 0] };
    const cellSize = { cellMmX: 50, cellMmY: 50 };
    const reachesIn = createCutout({
      shape: 'path',
      x: 2,
      y: 2,
      width: 96,
      depth: 96,
      path: [
        corner(2, 2),
        corner(98, 2),
        corner(98, 70),
        corner(70, 70),
        corner(70, 98),
        corner(2, 98),
      ],
    });
    expect(
      isCutoutOffBoard(reachesIn, { width: 100, depth: 100, mask: mask, cellSize: cellSize })
    ).toBe(true);
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
    expect(isCutoutOffBoard({ ...arr, array: undefined }, { width: BIN_W, depth: BIN_D })).toBe(
      false
    );
    expect(isCutoutOffBoard(arr, { width: BIN_W, depth: BIN_D })).toBe(true);
  });
});

describe('getOffBoardCutoutIds', () => {
  it('collects only the stranded cutouts', () => {
    const inside = createCutout({ id: 'in', x: 10, y: 10 });
    const stray = createCutout({ id: 'out', x: 95, y: 10 });
    const ids = getOffBoardCutoutIds([inside, stray], { width: BIN_W, depth: BIN_D });
    expect([...ids]).toEqual(['out']);
  });
});

describe('clampCutoutToBoard', () => {
  it('pulls a right/top overhang back to the edge', () => {
    const stray = createCutout({ x: 95, y: 75, width: 20, depth: 20 });
    expect(clampCutoutToBoard(stray, { width: BIN_W, depth: BIN_D })).toEqual({ x: 80, y: 60 });
  });

  it('pulls a negative position back to the origin', () => {
    const stray = createCutout({ x: -5, y: -8, width: 20, depth: 20 });
    expect(clampCutoutToBoard(stray, { width: BIN_W, depth: BIN_D })).toEqual({ x: 0, y: 0 });
  });

  it('shrinks an oversized cutout to the board and anchors it at the origin', () => {
    const huge = createCutout({ x: 30, y: 20, width: 200, depth: 150 });
    const patch = clampCutoutToBoard(huge, { width: BIN_W, depth: BIN_D });
    expect(patch).toEqual({ x: 0, y: 0, width: BIN_W, depth: BIN_D });
    expect(isCutoutOffBoard({ ...huge, ...patch }, { width: BIN_W, depth: BIN_D })).toBe(false);
  });

  it('clamps only the oversized axis', () => {
    const wide = createCutout({ x: 27.5, y: 93.5, width: 500, depth: 39.5 });
    const board = { width: 165.1, depth: 165.1 };
    const fixed = { ...wide, ...clampCutoutToBoard(wide, board) };
    expect(fixed.width).toBe(165.1);
    expect(fixed.depth).toBe(39.5);
    expect(isCutoutOffBoard(fixed, board)).toBe(false);
    expect(clampCutoutToBoard(fixed, board)).toBeNull();
  });

  it('shrinks a rotated oversized cutout so its rotated footprint fits', () => {
    const rotated = createCutout({ x: 10, y: 10, width: 300, depth: 40, rotation: 45 });
    const board = { width: BIN_W, depth: BIN_D };
    const fixed = { ...rotated, ...clampCutoutToBoard(rotated, board) };
    expect(isCutoutOffBoard(fixed, board)).toBe(false);
    expect(fixed.width / fixed.depth).toBeCloseTo(300 / 40);
  });

  it('maps the clamp to the crossed axes at 90° rotation', () => {
    const bar = createCutout({ x: 10, y: 10, width: 200, depth: 10, rotation: 90 });
    const board = { width: BIN_W, depth: BIN_D };
    const fixed = { ...bar, ...clampCutoutToBoard(bar, board) };
    expect(fixed.width).toBe(80);
    expect(fixed.depth).toBe(10);
    expect(isCutoutOffBoard(fixed, board)).toBe(false);
  });

  it('shrinks an array master so every instance fits', () => {
    const arr = createCutout({
      x: 0,
      y: 10,
      width: 200,
      depth: 20,
      array: gridArray(2, 1, 40, 40),
    });
    const board = { width: BIN_W, depth: BIN_D };
    const fixed = { ...arr, ...clampCutoutToBoard(arr, board) };
    expect(fixed.width).toBe(60);
    expect(fixed.depth).toBe(20);
    expect(isCutoutOffBoard(fixed, board)).toBe(false);
  });

  it('leaves an oversized path translation-only and flagged', () => {
    const path = createCutout({
      shape: 'path',
      x: 0,
      y: 10,
      width: 300,
      depth: 20,
      path: [corner(0, 10), corner(300, 10), corner(300, 30), corner(0, 30)],
    });
    expect(clampCutoutToBoard(path, { width: BIN_W, depth: BIN_D })).toBeNull();
    expect(clampOffBoardCutouts([path], { width: BIN_W, depth: BIN_D }).size).toBe(0);
    expect(isCutoutOffBoard(path, { width: BIN_W, depth: BIN_D })).toBe(true);
  });

  it('withholds a translation that cannot clear the flag', () => {
    const path = createCutout({
      id: 'stuck',
      shape: 'path',
      x: 30,
      y: 10,
      width: 300,
      depth: 20,
      path: [corner(30, 10), corner(330, 10), corner(330, 30), corner(30, 30)],
    });
    expect(clampOffBoardCutouts([path], { width: BIN_W, depth: BIN_D }).size).toBe(0);
  });

  it('translates but never resizes a mesh cutout', () => {
    const mesh = createCutout({ shape: 'mesh', x: 30, y: 10, width: 200, depth: 20 });
    expect(clampCutoutToBoard(mesh, { width: BIN_W, depth: BIN_D })).toEqual({ x: 0, y: 10 });
  });

  it('returns null when the cutout is already inside', () => {
    expect(clampCutoutToBoard(createCutout(), { width: BIN_W, depth: BIN_D })).toBeNull();
  });

  it('produces an in-bounds result', () => {
    const stray = createCutout({ x: 95, y: 75, width: 20, depth: 20 });
    const moved = { ...stray, ...clampCutoutToBoard(stray, { width: BIN_W, depth: BIN_D }) };
    expect(isCutoutOffBoard(moved, { width: BIN_W, depth: BIN_D })).toBe(false);
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
    const moved = clampCutoutToBoard(path, { width: BIN_W, depth: BIN_D });
    // Path bounds span 90..110 → shift -10 on x; y already fits.
    expect(moved).not.toBeNull();
    expect(moved?.x).toBe(0);
    expect(moved?.path?.map((p) => p.x)).toEqual([80, 100, 100, 80]);
    const after = { ...path, ...moved };
    expect(isCutoutOffBoard(after, { width: BIN_W, depth: BIN_D })).toBe(false);
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
    expect(clampCutoutToBoard(arr, { width: BIN_W, depth: BIN_D })).toEqual({ x: 40, y: 10 });
    const moved = { ...arr, ...clampCutoutToBoard(arr, { width: BIN_W, depth: BIN_D }) };
    expect(isCutoutOffBoard(moved, { width: BIN_W, depth: BIN_D })).toBe(false);
  });
});

describe('clampOffBoardCutouts', () => {
  it('returns updates only for off-board cutouts', () => {
    const inside = createCutout({ id: 'in', x: 10, y: 10 });
    const stray = createCutout({ id: 'out', x: 95, y: 75 });
    const updates = clampOffBoardCutouts([inside, stray], { width: BIN_W, depth: BIN_D });
    expect([...updates.keys()]).toEqual(['out']);
    expect(updates.get('out')).toEqual({ x: 80, y: 60 });
  });

  it('returns an empty map when everything fits', () => {
    expect(clampOffBoardCutouts([createCutout()], { width: BIN_W, depth: BIN_D }).size).toBe(0);
  });

  it('resolves an oversized cutout in one application', () => {
    const wide = createCutout({ id: 'wide', x: 27.5, y: 93.5, width: 500, depth: 39.5 });
    const board = { width: 165.1, depth: 165.1 };
    const fixed = { ...wide, ...clampOffBoardCutouts([wide], board).get('wide') };
    expect(isCutoutOffBoard(fixed, board)).toBe(false);
    expect(clampOffBoardCutouts([fixed], board).size).toBe(0);
  });

  it('relocates a mask-only violation into the nearest filled region', () => {
    // Inside the bounding rectangle but over an unfilled cell — the clamp now
    // searches for a valid cell-aligned placement and moves it there.
    const mask: CellMask = { cols: 2, rows: 2, cells: [1, 1, 1, 0] };
    const cellSize = { cellMmX: 50, cellMmY: 50 };
    const overNotch = createCutout({ id: 'notch', x: 60, y: 60, width: 30, depth: 30 });
    expect(
      getOffBoardCutoutIds([overNotch], {
        width: 100,
        depth: 100,
        mask: mask,
        cellSize: cellSize,
      }).has('notch')
    ).toBe(true);
    const updates = clampOffBoardCutouts([overNotch], {
      width: 100,
      depth: 100,
      mask: mask,
      cellSize: cellSize,
    });
    expect(updates.size).toBe(1);
    const moved = { ...overNotch, ...updates.get('notch') };
    expect(
      isCutoutOffBoard(moved, { width: 100, depth: 100, mask: mask, cellSize: cellSize })
    ).toBe(false);
  });

  it('leaves a cutout flagged when no valid mask placement exists', () => {
    // 90×90 spans the whole 2×2 grid wherever placed, so it always hits the
    // empty cell — no translation can fit it; the clamp emits nothing.
    const mask: CellMask = { cols: 2, rows: 2, cells: [1, 1, 1, 0] };
    const cellSize = { cellMmX: 50, cellMmY: 50 };
    const tooBig = createCutout({ id: 'big', x: 5, y: 5, width: 90, depth: 90 });
    expect(
      getOffBoardCutoutIds([tooBig], {
        width: 100,
        depth: 100,
        mask: mask,
        cellSize: cellSize,
      }).has('big')
    ).toBe(true);
    expect(
      clampOffBoardCutouts([tooBig], { width: 100, depth: 100, mask: mask, cellSize: cellSize })
        .size
    ).toBe(0);
  });
});

describe('the lid board', () => {
  const lidWindow = (over: Partial<LidCutoutWindow> = {}): LidCutoutWindow => ({
    spanW: 100,
    spanD: 100,
    offsetX: 0,
    offsetY: 0,
    cornerRadius: 12,
    keepouts: [{ x: 50, y: 50, r: 6 }],
    ...over,
  });

  it('flags a shape over a magnet boss even though it is inside the rectangle', () => {
    // The whole point of the lid branch: this shape passes every rectangle test
    // and the worker still cuts around the boss, leaving an island in the slot.
    const overBoss = createCutout({ id: 'boss', x: 45, y: 45, width: 10, depth: 10 });

    expect(isCutoutOffBoard(overBoss, { width: 100, depth: 100 })).toBe(false);
    expect(isCutoutOffBoard(overBoss, { width: 100, depth: 100, lidWindow: lidWindow() })).toBe(
      true
    );
  });

  it('flags a shape tucked into the rounded corner and clamps it back in', () => {
    const inCorner = createCutout({ id: 'corner', x: 0, y: 0, width: 8, depth: 8 });
    const board = { width: 100, depth: 100, lidWindow: lidWindow() };

    expect(getOffBoardCutoutIds([inCorner], board).has('corner')).toBe(true);

    const moved = clampCutoutToBoard(inCorner, board);
    expect(moved).not.toBeNull();
    expect(isCutoutOffBoard({ ...inCorner, ...moved }, board)).toBe(false);
  });

  it('takes the lid window over the plain extent when both are given', () => {
    // `width`/`depth` are the rectangle fallback. A board carrying a window must
    // not answer from them, or the corners and bosses go unchecked.
    const inCorner = createCutout({ id: 'corner', x: 1, y: 1, width: 6, depth: 6 });

    expect(isCutoutOffBoard(inCorner, { width: 100, depth: 100, lidWindow: lidWindow() })).toBe(
      true
    );
  });

  it('leaves a shape flagged when no placement clears the bosses', () => {
    const board = {
      width: 30,
      depth: 30,
      lidWindow: lidWindow({
        spanW: 30,
        spanD: 30,
        cornerRadius: 0,
        keepouts: [{ x: 15, y: 15, r: 10 }],
      }),
    };
    const tooBig = createCutout({ id: 'big', x: 0, y: 0, width: 30, depth: 30 });

    expect(getOffBoardCutoutIds([tooBig], board).has('big')).toBe(true);
    expect(clampOffBoardCutouts([tooBig], board).size).toBe(0);
  });
});
