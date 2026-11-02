import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/shared/types/bin';
import {
  alignedSplitLine,
  deeperDepth,
  drawnSplit,
  depthAt,
  effectiveSplit,
  fromSplitFrame,
  patchSplit,
  shallowerDepth,
  sideBShare,
  splitBlockedReason,
  splitSides,
  toSplitFrame,
} from './cutoutSplit';

const ACROSS = { a: { x: -5, y: -10 }, b: { x: -5, y: 10 } };

function pocket(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'p',
    shape: 'rectangle',
    x: 20,
    y: 30,
    width: 40,
    depth: 20,
    cutDepth: 10,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    split: { ...ACROSS, cutDepth: 4 },
    ...overrides,
  };
}

describe('splitBlockedReason', () => {
  it.each([
    ['text', { shape: 'text' }, 'shape'],
    ['a mesh', { shape: 'mesh' }, 'shape'],
    ['a finger cut', { shape: 'slot', finger: { bottom: 'curved' } }, 'shape'],
    ['a group member', { groupId: 'g' }, 'group'],
    ['a leaning pocket', { leanDeg: 10 }, 'tilt'],
    ['a through cut', { depthMode: 'through' }, 'through'],
  ] as const)('blocks %s', (_name, overrides, reason) => {
    expect(splitBlockedReason(pocket(overrides as Partial<Cutout>))).toBe(reason);
  });

  it('lets every plain pocket shape split', () => {
    for (const shape of ['rectangle', 'circle', 'slot', 'polygon', 'path'] as const) {
      expect(splitBlockedReason(pocket({ shape }))).toBeNull();
    }
  });
});

describe('splitSides', () => {
  it('cuts a rectangle into a left side A and a right side B', () => {
    const sides = splitSides(pocket(), ACROSS);
    if (typeof sides === 'string') throw new Error(sides);
    expect(Math.max(...sides.a.map((p) => p.x))).toBeCloseTo(-5);
    expect(Math.min(...sides.b.map((p) => p.x))).toBeCloseTo(-5);
    expect(sides.ends).toEqual([
      { x: -5, y: -10 },
      { x: -5, y: 10 },
    ]);
  });

  it('refuses a line that misses the pocket', () => {
    expect(splitSides(pocket(), { a: { x: 30, y: -10 }, b: { x: 30, y: 10 } })).toBe('crossings');
  });

  it('refuses a line that leaves a sliver', () => {
    const edge = { a: { x: 19.995, y: -10 }, b: { x: 19.995, y: 10 } };
    expect(splitSides(pocket(), edge)).toBe('small');
  });

  it('refuses a line through a concave outline more than once', () => {
    const corner = (x: number, y: number) => ({
      x,
      y,
      handleIn: null,
      handleOut: null,
      symmetric: false,
    });
    const u = pocket({
      shape: 'path',
      path: [
        corner(20, 30),
        corner(60, 30),
        corner(60, 50),
        corner(50, 50),
        corner(50, 35),
        corner(30, 35),
        corner(30, 50),
        corner(20, 50),
      ],
    });
    const throughArms = { a: { x: -30, y: 5 }, b: { x: 30, y: 5 } };
    expect(splitSides(u, throughArms)).toBe('crossings');
  });
});

describe('effectiveSplit', () => {
  it('cuts the pocket whole when the sides share a depth', () => {
    expect(effectiveSplit(pocket({ cutDepth: 4 }))).toBeNull();
  });

  it('cuts the pocket whole once the line no longer divides it', () => {
    expect(effectiveSplit(pocket({ width: 8, x: 36 }))).toBeNull();
  });

  it('pauses while the pocket cannot be split', () => {
    expect(effectiveSplit(pocket({ leanDeg: 5 }))).toBeNull();
  });

  it('keeps a live split', () => {
    expect(effectiveSplit(pocket())).toEqual({ ...ACROSS, cutDepth: 4 });
  });
});

describe('side depths', () => {
  it('reads the shallower and deeper side', () => {
    expect(shallowerDepth(pocket())).toBe(4);
    expect(deeperDepth(pocket())).toBe(10);
    expect(shallowerDepth(pocket({ split: undefined }))).toBe(10);
  });

  it('reads the depth under a point by its side', () => {
    expect(depthAt(pocket(), { x: -15, y: 0 })).toBe(10);
    expect(depthAt(pocket(), { x: 5, y: 0 })).toBe(4);
  });

  it('measures side B as a share of the outline', () => {
    expect(sideBShare(pocket())).toBeCloseTo(25 / 40);
    expect(sideBShare(pocket({ split: undefined }))).toBe(0);
  });
});

describe('split frame', () => {
  it('round-trips a point through a turned pocket', () => {
    const turned = pocket({ rotation: 30 });
    const p = toSplitFrame(turned, 52, 47);
    const back = fromSplitFrame(turned, p);
    expect(back.x).toBeCloseTo(52);
    expect(back.y).toBeCloseTo(47);
  });

  it('places own-frame left on the turned side', () => {
    const quarter = pocket({ rotation: 90 });
    const left = fromSplitFrame(quarter, { x: -10, y: 0 });
    expect(left.x).toBeCloseTo(40);
    expect(left.y).toBeCloseTo(50);
  });
});

describe('alignedSplitLine', () => {
  const old = { a: { x: 0, y: -10 }, b: { x: 0, y: 10 } };

  it('keeps a redrawn line that already agrees', () => {
    const a = { x: 2, y: -8 };
    const b = { x: 2, y: 8 };
    expect(alignedSplitLine(old, a, b)).toEqual({ a, b });
  });

  it('turns a line drawn the other way, so A and B stay put', () => {
    const a = { x: 2, y: 8 };
    const b = { x: 2, y: -8 };
    expect(alignedSplitLine(old, a, b)).toEqual({ a: b, b: a });
  });

  it('takes a first line as drawn', () => {
    const a = { x: 2, y: 8 };
    const b = { x: 2, y: -8 };
    expect(alignedSplitLine(undefined, a, b)).toEqual({ a, b });
  });
});

describe('patchSplit', () => {
  const fixed = { ...ACROSS, cutDepth: 4 };
  const floored = { ...ACROSS, cutDepth: 9, depthMode: 'floor' as const, floorMm: 3 };

  it('reads a typed depth as fixed, dropping a floor mode', () => {
    expect(patchSplit(floored, { cutDepth: 6 })).toEqual({ ...ACROSS, cutDepth: 6 });
  });

  it('switches side B to a floor and back', () => {
    expect(patchSplit(fixed, { depthMode: 'floor', floorMm: 2 })).toEqual({
      ...fixed,
      depthMode: 'floor',
      floorMm: 2,
    });
    expect(patchSplit(floored, { depthMode: undefined })).toEqual({ ...ACROSS, cutDepth: 9 });
  });

  it('moves a held floor without touching the mode', () => {
    expect(patchSplit(floored, { floorMm: 5 })).toEqual({ ...floored, floorMm: 5 });
  });

  it('never stores a through side', () => {
    expect(patchSplit(fixed, { depthMode: 'through' })).toEqual(fixed);
  });
});

describe('drawnSplit', () => {
  const plain = pocket({ split: undefined });

  it('stores where a drawn line meets the outline, side B at half depth', () => {
    expect(drawnSplit(plain, { x: 30, y: 0 }, { x: 30, y: 80 })).toEqual({
      a: { x: -10, y: -10 },
      b: { x: -10, y: 10 },
      cutDepth: 5,
    });
  });

  it('keeps the depths and sides of a split it redraws', () => {
    const split = { ...ACROSS, cutDepth: 3, depthMode: 'floor' as const, floorMm: 2 };
    const redrawn = drawnSplit(pocket({ split }), { x: 45, y: 80 }, { x: 45, y: 0 });
    expect(redrawn).toEqual({ ...split, a: { x: 5, y: -10 }, b: { x: 5, y: 10 } });
  });

  it('says why a line that misses cannot split', () => {
    expect(drawnSplit(plain, { x: 70, y: 0 }, { x: 70, y: 80 })).toBe('crossings');
    expect(drawnSplit(plain, { x: 59.99, y: 0 }, { x: 59.99, y: 80 })).toBe('small');
  });

  it('takes an angled line from the copy it is drawn across, not one its extension meets', () => {
    const repeat = pocket({
      split: undefined,
      array: {
        mode: 'grid',
        cols: 2,
        rows: 1,
        pitchX: 50,
        pitchY: 0,
        count: 0,
        radius: 0,
        startAngle: 0,
        rotateToCenter: false,
      },
    });
    const split = drawnSplit(repeat, { x: 80, y: 38 }, { x: 100, y: 42 });
    if (typeof split === 'string') throw new Error(split);
    // Drawn through the second copy's centre, so its own-frame line meets the origin.
    const { a, b } = split;
    expect((b.x - a.x) * (0 - a.y) - (b.y - a.y) * (0 - a.x)).toBeCloseTo(0, 6);
  });

  it('takes a line across any copy of a repeat', () => {
    const repeat = pocket({
      split: undefined,
      array: {
        mode: 'grid',
        cols: 2,
        rows: 1,
        pitchX: 50,
        pitchY: 0,
        count: 0,
        radius: 0,
        startAngle: 0,
        rotateToCenter: false,
      },
    });
    const second = drawnSplit(repeat, { x: 80, y: 0 }, { x: 80, y: 80 });
    expect(second).toMatchObject({ a: { x: -10, y: -10 }, b: { x: -10, y: 10 } });
  });
});
