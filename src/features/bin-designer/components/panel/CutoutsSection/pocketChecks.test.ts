import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { cutoutDepthFrame } from '@/shared/utils/cutoutDepth';
import { clearedProfile } from '@/shared/utils/cutoutFit';
import { cutoutOutlineRing } from '@/shared/utils/cutoutOutline';
import { checkPockets, MIN_FLOOR_MM, type PocketIssue } from './pocketChecks';

const FLAT = {
  ...DEFAULT_BIN_PARAMS.base,
  style: 'flat',
  solid: true,
  stackingLip: false,
} as const;
const BOARD = { width: 80, depth: 80 };

function bin(overrides: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, style: 'solid', base: FLAT, wallThickness: 1.2, ...overrides };
}

function pocket(id: string, overrides: Partial<Cutout> = {}): Cutout {
  return {
    id,
    shape: 'rectangle',
    x: 20,
    y: 20,
    width: 20,
    depth: 20,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

const check = (cutouts: Cutout[], params = bin()): PocketIssue[] =>
  checkPockets(cutouts, params, BOARD);

/** Two pockets side by side along X, `gap` mm apart. */
const pair = (gap: number, a: Partial<Cutout> = {}, b: Partial<Cutout> = {}) => [
  pocket('a', a),
  pocket('b', { x: 40 + gap, ...b }),
];

describe('checkPockets between pockets', () => {
  it('passes pockets with enough plastic between them', () => {
    expect(check(pair(2))).toEqual([]);
  });

  it('warns about a thin wall between two pockets', () => {
    expect(check(pair(1))).toEqual([
      { kind: 'thin', ids: ['a', 'b'], instanceIds: ['a', 'b'], mm: expect.closeTo(1, 6) },
    ]);
  });

  // A round grows by its clearance across, half on each side; each cut also
  // flares by its entry edge at the top.
  it('counts clearance and entry edges against the gap', () => {
    const round = { shape: 'circle' as const };
    const [thin] = check(pair(2, { ...round, clearance: 1 }, { ...round, chamferWidth: 0.6 }));
    expect(thin).toMatchObject({ kind: 'thin', mm: expect.closeTo(0.9, 2) });
    const [merged] = check(pair(1.5, { ...round, clearance: 1.6 }, { ...round, clearance: 1.6 }));
    expect(merged).toMatchObject({ kind: 'merge', ids: ['a', 'b'] });
  });

  // A path is offset by its whole clearance on every side.
  it("counts a path's clearance on every side", () => {
    const square = (x: number) => [
      { x, y: 20, handleIn: null, handleOut: null, symmetric: false },
      { x: x + 20, y: 20, handleIn: null, handleOut: null, symmetric: false },
      { x: x + 20, y: 40, handleIn: null, handleOut: null, symmetric: false },
      { x, y: 40, handleIn: null, handleOut: null, symmetric: false },
    ];
    const traced = pocket('a', { shape: 'path', clearance: 0.5, path: square(20) });
    const [thin] = check([traced, pocket('b', { x: 41.5 })]);
    expect(thin).toMatchObject({ kind: 'thin', mm: expect.closeTo(1, 1) });
  });

  // A regular hexagon's clearance scales it, so its tips grow by more than half
  // the clearance, and reading that from the cleared outline is what catches it.
  it('measures a polygon at its cleared size, tips and all', () => {
    const hex = (id: string, x: number) =>
      pocket(id, {
        shape: 'polygon',
        sides: 6,
        x,
        y: 20,
        width: (20 * 2) / Math.sqrt(3),
        depth: 20,
        clearance: 2,
      });
    const maxX = (c: Cutout) => Math.max(...(cutoutOutlineRing(c) ?? []).map(([x]) => x));
    const minX = (c: Cutout) => Math.min(...(cutoutOutlineRing(c) ?? []).map(([x]) => x));
    const a = hex('a', 10);
    const b0 = hex('b', 40);
    const b = { ...b0, x: b0.x + (maxX(a) + 3.3 - minX(b0)) };
    const { w, d } = clearedProfile(a);
    const tip =
      maxX({ ...a, x: a.x - (w - a.width) / 2, y: a.y - (d - a.depth) / 2, width: w, depth: d }) -
      maxX(a);
    const [thin] = check([a, b]);
    expect(tip).toBeGreaterThan(1);
    expect(thin).toMatchObject({ kind: 'thin', mm: expect.closeTo(3.3 - 2 * tip, 3) });
  });

  // The first round's clearance swallows the second whole, though their cut
  // outlines never touch.
  it('reads a cut that swallows another as a merge', () => {
    const small = (id: string, x: number, clearance?: number) =>
      pocket(id, { shape: 'circle', x, y: 9, width: 2, depth: 2, clearance });
    const [merged] = check([small('a', 9, 5), small('b', 11.2)]);
    expect(merged).toMatchObject({ kind: 'merge', ids: ['a', 'b'] });
  });

  // A polygon's entry edge flares by an offset of its outline, so its corners
  // reach out by more than the edge's width.
  it("counts a polygon's flare at its corners", () => {
    const square = (id: string, at: number) =>
      pocket(id, {
        shape: 'polygon',
        sides: 4,
        x: at,
        y: at,
        width: 20,
        depth: 20,
        chamferWidth: 1,
      });
    const issues = check([square('a', 20), square('b', 42.4)]);
    expect(issues).toEqual([expect.objectContaining({ ids: ['a', 'b'] })]);
    expect(issues[0].mm).toBeLessThan(1.2);
  });

  it('leaves pockets that overlap or nest on purpose alone', () => {
    expect(check(pair(-5))).toEqual([]);
    const tray = pocket('tray', { x: 10, y: 10, width: 60, depth: 60, cutDepth: 3 });
    const hole = pocket('hole', { x: 10.5, y: 30, width: 10, depth: 10, cutDepth: 10 });
    expect(check([tray, hole])).toEqual([]);
  });

  it('leaves a finger cut over its pocket alone', () => {
    const finger = pocket('f', {
      shape: 'slot',
      x: 20,
      y: 5,
      width: 20,
      depth: 30,
      finger: { bottom: 'curved' },
    });
    expect(check([pocket('p'), finger])).toEqual([]);
  });

  it('reports a repeat whose copies crowd each other once, on its master', () => {
    const array = {
      mode: 'grid' as const,
      cols: 3,
      rows: 1,
      pitchX: 20.8,
      pitchY: 0,
      count: 3,
      radius: 0,
      startAngle: 0,
      rotateToCenter: false,
    };
    const [crowded, ...rest] = check([pocket('r', { x: 5, array })]);
    expect(rest).toEqual([]);
    expect(crowded).toMatchObject({ kind: 'thin', ids: ['r'], mm: expect.closeTo(0.8, 6) });
    expect(crowded.instanceIds.length).toBeGreaterThan(1);
  });

  it('checks a union group against other pockets, never within itself', () => {
    const members = [
      pocket('m1', { groupId: 'g', groupOp: 'union' }),
      pocket('m2', { groupId: 'g', groupOp: 'union', x: 30 }),
    ];
    expect(check(members)).toEqual([]);
    const near = pocket('n', { x: 51 });
    expect(check([...members, near])).toEqual([
      expect.objectContaining({ kind: 'thin', ids: ['m2', 'n'] }),
    ]);
  });

  // A union is one cavity: overlapping either member is overlapping it.
  it('exempts a pocket that overlaps a union from all of its members', () => {
    const members = [
      pocket('m1', { groupId: 'g', groupOp: 'union' }),
      pocket('m2', { groupId: 'g', groupOp: 'union', x: 30 }),
    ];
    const loose = pocket('n', { x: 5, y: 45, width: 24, depth: 20 });
    expect(check([...members, { ...loose, y: 39 }])).toEqual([]);
  });

  it('skips a subtract group, whose outline is no member of its own', () => {
    const members = [
      pocket('m1', { groupId: 'g', groupOp: 'subtract' }),
      pocket('m2', { groupId: 'g', groupOp: 'subtract', x: 30 }),
    ];
    expect(check([...members, pocket('n', { x: 51 })])).toEqual([]);
  });

  it('ignores hidden cutouts and text', () => {
    expect(check(pair(1, {}, { hidden: true }))).toEqual([]);
    expect(check(pair(1, {}, { shape: 'text', label: 'A' }))).toEqual([]);
  });
});

describe('checkPockets against the wall', () => {
  // The builder clips every pocket tool to the interior box, so clearance that
  // reaches past a straight wall is trimmed and the wall keeps its thickness.
  it('keeps a straight wall whole, however far the clearance reaches', () => {
    expect(check([pocket('a', { shape: 'circle', x: 0.5, clearance: 2 })])).toEqual([]);
  });

  // The lip stands 2.6 mm in from the outer face; through a 1.2 mm wall it
  // overhangs the interior by 1.4 mm.
  it('warns when a pocket opens under the stacking lip', () => {
    const near = [pocket('a', { x: 1 })];
    const withLip = bin({ base: { ...FLAT, stackingLip: true } });
    expect(check(near, withLip)).toEqual([
      { kind: 'lip', ids: ['a'], instanceIds: ['a'], mm: expect.closeTo(0.4, 6) },
    ]);
    expect(check(near)).toEqual([]);
  });

  // An exit cut open to the top takes the lip with it on that wall.
  it('leaves a pocket that opens through the lip alone', () => {
    const withLip = bin({ base: { ...FLAT, stackingLip: true } });
    const exit = (tunnel: boolean) => [
      pocket('a', { x: 1, openSides: [{ side: 'left', tunnel }] }),
    ];
    expect(check(exit(false), withLip)).toEqual([]);
    expect(check(exit(true), withLip)).toEqual([expect.objectContaining({ kind: 'lip' })]);
    const keyhole = [pocket('a', { x: 1, openSides: [{ side: 'left', widthMm: 2 }] })];
    expect(check(keyhole, withLip)).toEqual([expect.objectContaining({ kind: 'lip' })]);
  });

  // The generator builds no exit for a leaning pocket, so its lip is still there.
  it('still warns when the generator will not open the exit', () => {
    const withLip = bin({ base: { ...FLAT, stackingLip: true } });
    const leaning = pocket('a', { x: 1, leanDeg: 10, openSides: [{ side: 'left' }] });
    expect(check([leaning], withLip)).toEqual([expect.objectContaining({ kind: 'lip' })]);
  });

  // Its walls follow the generator's inset perimeter, not the placement grid.
  it("leaves a custom footprint's walls unchecked, but not its pockets", () => {
    const mask = { cols: 4, rows: 4, cells: Array<0 | 1>(16).fill(1) };
    const board = { ...BOARD, mask, cellSize: { cellMmX: 20, cellMmY: 20 } };
    const withLip = bin({ base: { ...FLAT, stackingLip: true } });
    expect(checkPockets([pocket('a', { x: 1 })], withLip, board)).toEqual([]);
    expect(checkPockets(pair(1), withLip, board)).toEqual([
      expect.objectContaining({ kind: 'thin' }),
    ]);
  });

  it('warns about a thin wall only where the wall itself is thin', () => {
    const near = [pocket('a', { x: 0.5 })];
    expect(check(near)).toEqual([]);
    expect(check(near, bin({ wallThickness: 0.4 }))).toEqual([
      expect.objectContaining({ kind: 'wall', mm: expect.closeTo(0.9, 6) }),
    ]);
  });

  // The interior's corners are rounded, so a pocket clear of both edges can
  // still cut into the corner between them.
  it('catches a cut into a rounded corner', () => {
    const [corner] = check([pocket('a', { x: 0.5, y: 0.5, chamferWidth: 0.4 })]);
    expect(corner).toMatchObject({ kind: 'wall', ids: ['a'] });
    expect(corner.mm).toBeLessThan(1.2);
  });

  it('leaves a pocket off the board to the off-board warning', () => {
    expect(check([pocket('a', { shape: 'circle', x: -2, clearance: 2 })])).toEqual([]);
  });
});

describe('checkPockets under the floor', () => {
  const fill = cutoutDepthFrame(bin()).fillDepthMm;

  it('warns about a thin floor and offers to leave the minimum', () => {
    const [thin] = check([pocket('a', { cutDepth: fill - 0.5 })]);
    expect(thin).toMatchObject({ kind: 'floor', ids: ['a'], mm: expect.closeTo(0.5, 6) });
    expect(thin.fix?.cutDepth).toBeCloseTo(fill - MIN_FLOOR_MM, 6);
  });

  it('raises the floor of a pocket that keeps one', () => {
    const floored = pocket('a', { depthMode: 'floor', floorMm: 0.6, cutDepth: fill - 0.6 });
    expect(check([floored])[0]).toMatchObject({ kind: 'floor', fix: { floorMm: MIN_FLOOR_MM } });
  });

  it('passes through cuts, and pockets over a socketed base', () => {
    expect(check([pocket('a', { depthMode: 'through', cutDepth: fill })])).toEqual([]);
    const socketed = bin({ base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false } });
    const deep = cutoutDepthFrame(socketed).fillDepthMm;
    expect(check([pocket('a', { cutDepth: deep })], socketed)).toEqual([]);
  });
});
