import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
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
    // A 20×20 square at the corner fits axis-aligned, but rotating 45° grows the
    // AABB to ~28.3mm, pushing it past the right edge.
    const corner = createCutout({ x: 80, y: 30, width: 20, depth: 20, rotation: 0 });
    expect(isCutoutOffBoard(corner, BIN_W, BIN_D)).toBe(false);
    expect(isCutoutOffBoard({ ...corner, rotation: 45 }, BIN_W, BIN_D)).toBe(true);
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

  it('produces an in-bounds result', () => {
    const stray = createCutout({ x: 95, y: 75, width: 20, depth: 20 });
    const moved = { ...stray, ...clampCutoutToBoard(stray, BIN_W, BIN_D) };
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
});
