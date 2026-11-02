import { describe, it, expect } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { maxEntryChamfer } from '@/features/bin-designer/types';
import {
  FINGER_LENGTH_MM,
  FINGER_WIDTH_MM,
  fingerAccessBlockedReason,
  planFingerAccess,
  switchFingerShape,
} from './fingerAccessPlan';

const BOARD = { width: 120, depth: 120 };
const MAX_CUT = 30;

function pocket(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'p',
    shape: 'rectangle',
    x: 20,
    y: 40,
    width: 60,
    depth: 24,
    cutDepth: 10,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

function centre(c: Pick<Cutout, 'x' | 'y' | 'width' | 'depth'>): { x: number; y: number } {
  return { x: c.x + c.width / 2, y: c.y + c.depth / 2 };
}

function corner(x: number, y: number): PathPoint {
  return { x, y, handleIn: null, handleOut: null, symmetric: false };
}

describe('fingerAccessBlockedReason', () => {
  it('allows a plain pocket', () => {
    expect(fingerAccessBlockedReason(pocket())).toBeNull();
  });

  it.each([
    ['text', { shape: 'text' as const }],
    ['a knife slot', { shape: 'knifeSlot' as const }],
    ['a finger cut itself', { shape: 'slot' as const, finger: { bottom: 'curved' as const } }],
  ])('refuses %s outright', (_name, overrides) => {
    expect(fingerAccessBlockedReason(pocket(overrides))).toBe('shape');
  });

  it('refuses a repeat, which would need one cut per copy', () => {
    const array = {
      mode: 'grid' as const,
      cols: 2,
      rows: 1,
      pitchX: 70,
      pitchY: 0,
      count: 2,
      radius: 0,
      startAngle: 0,
      rotateToCenter: false,
    };
    expect(fingerAccessBlockedReason(pocket({ array }))).toBe('repeat');
  });
});

describe('planFingerAccess', () => {
  it('straddles the middle of the long side facing the front', () => {
    const plan = planFingerAccess(pocket(), BOARD, MAX_CUT);
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan).toMatchObject({
      shape: 'slot',
      width: FINGER_WIDTH_MM,
      depth: FINGER_LENGTH_MM,
      rotation: 0,
      finger: { bottom: 'curved' },
      entryProfile: 'round',
      chamferWidth: Math.min(1, maxEntryChamfer(9)),
    });
    expect(centre(plan)).toEqual({ x: 50, y: 40 });
  });

  it('stops a millimetre short of the pocket floor, within the bin', () => {
    expect(planFingerAccess(pocket({ cutDepth: 10 }), BOARD, MAX_CUT)?.cutDepth).toBe(9);
    expect(planFingerAccess(pocket({ cutDepth: 2 }), BOARD, MAX_CUT)?.cutDepth).toBe(2);
    expect(planFingerAccess(pocket({ cutDepth: 40 }), BOARD, MAX_CUT)?.cutDepth).toBe(MAX_CUT - 1);
  });

  it('turns to the back when the front side would leave the board', () => {
    const nearFront = pocket({ y: 2 });
    const plan = planFingerAccess(nearFront, BOARD, MAX_CUT);
    expect(plan && centre(plan)).toEqual({ x: 50, y: 26 });
  });

  // An 18 mm pocket would have the 20 mm inner half notch its back wall.
  it('stops short of the far side of a narrow pocket', () => {
    const plan = planFingerAccess(pocket({ depth: 18 }), BOARD, MAX_CUT);
    expect(plan).toMatchObject({ y: 20, depth: 20 + 17 });
  });

  it('runs across a tall pocket from its side', () => {
    const plan = planFingerAccess(pocket({ x: 40, y: 20, width: 24, depth: 60 }), BOARD, MAX_CUT);
    expect(plan).toMatchObject({ width: FINGER_LENGTH_MM, depth: FINGER_WIDTH_MM });
    expect(plan && centre(plan)).toEqual({ x: 40, y: 50 });
  });

  it('turns with a rotated pocket, landing on its long edge', () => {
    const turned = pocket({ x: 30, y: 50, rotation: 90 });
    const plan = planFingerAccess(turned, BOARD, MAX_CUT);
    expect(plan?.rotation).toBe(90);
    if (!plan) return;
    const at = centre(plan);
    const mid = centre(turned);
    expect(Math.abs(at.x - mid.x)).toBeCloseTo(12, 6);
    expect(at.y).toBeCloseTo(mid.y, 6);
  });

  it("reaches a path's cleared outline, not its box", () => {
    const path = pocket({
      shape: 'path',
      clearance: 1,
      path: [corner(20, 40), corner(80, 40), corner(80, 64), corner(20, 64)],
    });
    const plan = planFingerAccess(path, BOARD, MAX_CUT);
    expect(plan && centre(plan).y).toBeCloseTo(39, 6);
  });

  it('plans nothing for a cutout that cannot take one', () => {
    expect(planFingerAccess(pocket({ shape: 'text' }), BOARD, MAX_CUT)).toBeNull();
  });
});

describe('switchFingerShape', () => {
  const slot = pocket({ shape: 'slot', x: 40, y: 20, width: 20, depth: 40 });

  it('turns a slot into a round as wide as its narrow side, about the same centre', () => {
    const round = { ...slot, ...switchFingerShape(slot) };
    expect(round).toMatchObject({ shape: 'circle', width: 20, depth: 20 });
    expect(centre(round)).toEqual(centre(slot));
  });

  it('turns a round back into a slot twice as long', () => {
    const round = { ...slot, ...switchFingerShape(slot) };
    const back = { ...round, ...switchFingerShape(round) };
    expect(back).toMatchObject({ shape: 'slot', width: 20, depth: 40 });
    expect(centre(back)).toEqual(centre(slot));
  });
});
