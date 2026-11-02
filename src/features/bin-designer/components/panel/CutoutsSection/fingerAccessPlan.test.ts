import { describe, it, expect } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { maxEntryChamfer } from '@/features/bin-designer/types';
import type { MeshAsset } from '@/shared/generation/meshAsset';
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

  // An 18 mm pocket would have the 20 mm inner half notch its back wall. It
  // stops 1 mm short, plus the 1 mm its entry edge flares at the top.
  it('stops short of the far side of a narrow pocket', () => {
    const plan = planFingerAccess(pocket({ depth: 18 }), BOARD, MAX_CUT);
    expect(plan).toMatchObject({ y: 20, depth: 20 + 16 });
  });

  // A tapered pocket closes in behind the cut's corners before its middle.
  // Every point of the inner end keeps the 1 mm entry flare and the 1 mm
  // margin square to the wall, less a little for the lines it is sampled on.
  it('keeps every part of its inner end off a tapering far wall', () => {
    const apex = { x: 60, y: 61 };
    const walls = [
      [{ x: 80, y: 40 }, apex],
      [apex, { x: 40, y: 40 }],
    ] as const;
    const triangle = pocket({
      shape: 'path',
      x: 40,
      y: 40,
      width: 40,
      depth: 21,
      path: [corner(40, 40), corner(80, 40), corner(apex.x, apex.y)],
    });
    const plan = planFingerAccess(triangle, BOARD, MAX_CUT);
    expect(plan).not.toBeNull();
    if (!plan) return;
    const r = plan.width / 2;
    const end = { x: plan.x + r, y: plan.y + plan.depth - r };
    for (let i = 0; i <= 36; i++) {
      const a = (Math.PI * i) / 36;
      const p = { x: end.x + r * Math.cos(a), y: end.y + r * Math.sin(a) };
      for (const [from, to] of walls) {
        const ex = to.x - from.x;
        const ey = to.y - from.y;
        const inside = ((p.y - from.y) * ex - (p.x - from.x) * ey) / Math.hypot(ex, ey);
        expect(inside).toBeGreaterThan(1.9);
      }
    }
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

  // The line through a U's middle meets nothing on its open side, and behind the
  // bridge it ends in there is plastic, not pocket.
  it('stands on the bridge of a U open to the front, within it', () => {
    const u = pocket({
      shape: 'path',
      x: 20,
      y: 20,
      width: 60,
      depth: 60,
      path: [
        corner(20, 20),
        corner(30, 20),
        corner(30, 70),
        corner(70, 70),
        corner(70, 20),
        corner(80, 20),
        corner(80, 80),
        corner(20, 80),
      ],
    });
    expect(planFingerAccess(u, BOARD, MAX_CUT)).toMatchObject({
      x: 40,
      y: 72,
      width: 20,
      depth: 28,
    });
  });

  describe('on a mesh imprint', () => {
    // Its silhouette in the asset's lay-flat frame: a U open toward the front.
    const asset: MeshAsset = {
      name: 'tool',
      data: '',
      triangleCount: 12,
      sizeMm: { x: 60, y: 60, z: 5 },
      outlines: [
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 50 },
          { x: 50, y: 50 },
          { x: 50, y: 0 },
          { x: 60, y: 0 },
          { x: 60, y: 60 },
          { x: 0, y: 60 },
        ],
      ],
    };
    const imprint = pocket({ shape: 'mesh', meshId: 'u', x: 20, y: 20, width: 60, depth: 60 });

    it('reads the silhouette, not the box, and stands on the bridge', () => {
      const plan = planFingerAccess(imprint, { ...BOARD, meshAssets: { u: asset } }, MAX_CUT);
      expect(plan).toMatchObject({ x: 40, y: 72, width: 20, depth: 28 });
    });

    it('plans nothing while the imprint has no silhouette to read', () => {
      expect(planFingerAccess(imprint, BOARD, MAX_CUT)).toBeNull();
    });
  });

  it('turns to a short side when neither long side fits the board', () => {
    const fullDepth = pocket({ x: 60, y: 0, width: 80, depth: 60 });
    const plan = planFingerAccess(fullDepth, { width: 200, depth: 60 }, MAX_CUT);
    expect(plan).toMatchObject({ x: 40, y: 20, width: 40, depth: 20 });
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
