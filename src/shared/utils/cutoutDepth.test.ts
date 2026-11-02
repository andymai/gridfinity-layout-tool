import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { DEFAULT_TRAY_BOTTOM } from '@/shared/types/bin';
import { createInitialContext } from '@/features/generation/worker/generators/pipeline/context';
import {
  cutoutDepthFrame,
  cutoutFloorRange,
  floorUnderCutout,
  isThroughCut,
  resolveCutoutDepth,
  throughBlockedReason,
  withResolvedCutoutDepths,
} from './cutoutDepth';

const SOLID = { ...DEFAULT_BIN_PARAMS.base, solid: true };

function bin(overrides: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, base: SOLID, ...overrides };
}

function pocket(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'p',
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
    ...overrides,
  };
}

// The default bin: 3u (21mm) on a 4.75mm socket, so 16.25mm of fill.
const SOCKETED = cutoutDepthFrame(bin());
const FLAT = cutoutDepthFrame(bin({ base: { ...SOLID, style: 'flat' } }));

describe('cutoutDepthFrame', () => {
  it('counts the socket under a socketed bin toward the floor', () => {
    expect(SOCKETED).toEqual({ fillDepthMm: 16.25, baseMm: 4.75 });
  });

  it('counts nothing under a flat bin', () => {
    expect(FLAT).toEqual({ fillDepthMm: 21, baseMm: 0 });
  });

  it('measures the fill from the lowered fill surface', () => {
    const frame = cutoutDepthFrame(bin({ cutoutConfig: { topOffset: 3 } }));
    expect(frame.fillDepthMm).toBeCloseTo(13.25, 6);
  });

  it.each([
    ['a lightweight base', { lightweight: true }],
    ['a tray bottom', { style: 'lid' as const }],
  ])('counts nothing under %s', (_name, base) => {
    expect(cutoutDepthFrame(bin({ base: { ...SOLID, ...base } })).baseMm).toBe(0);
  });

  it('counts a low-profile socket at its own height', () => {
    expect(cutoutDepthFrame(bin({ base: { ...SOLID, lowProfile: true } })).baseMm).toBe(3.65);
  });

  // The generator builds from its own dimensions, so the two frames have to
  // agree or the editor's floor readout describes a pocket the bin does not have.
  it.each([
    ['socketed', bin()],
    ['flat', bin({ base: { ...SOLID, style: 'flat' } })],
    ['low profile', bin({ base: { ...SOLID, lowProfile: true } })],
    ['lowered fill', bin({ cutoutConfig: { topOffset: 4 } })],
    ['tall', bin({ height: 9 })],
  ])('matches the generator for a %s bin', (_name, params) => {
    const dim = createInitialContext(params).dimensions;
    const frame = cutoutDepthFrame(params);
    expect(frame.fillDepthMm).toBeCloseTo(dim.wallHeight - params.cutoutConfig.topOffset, 6);
    expect(frame.baseMm).toBeCloseTo(dim.baseOffsetZ, 6);
  });
});

describe('cutoutFloorRange', () => {
  it('starts a socketed bin on the socket and never cuts into it', () => {
    expect(cutoutFloorRange(SOCKETED)).toEqual({ min: 4.75, max: 20.5, initial: 4.75 });
  });

  it('keeps a floor on a flat bin rather than opening onto the bed', () => {
    expect(cutoutFloorRange(FLAT)).toEqual({ min: 0.6, max: 20.5, initial: 2 });
  });

  it('never offers a floor a design cannot store', () => {
    expect(cutoutFloorRange({ fillDepthMm: 395, baseMm: 4.75 }).max).toBe(350);
  });
});

describe('resolveCutoutDepth', () => {
  it('leaves a fixed depth as typed', () => {
    expect(resolveCutoutDepth(pocket({ cutDepth: 7.5 }), SOCKETED)).toBe(7.5);
  });

  it('cuts all the fill for a through cut', () => {
    expect(resolveCutoutDepth(pocket({ depthMode: 'through' }), SOCKETED)).toBe(16.25);
  });

  it('cuts down to the socket by default in floor mode', () => {
    expect(resolveCutoutDepth(pocket({ depthMode: 'floor' }), SOCKETED)).toBe(16.25);
  });

  it('leaves the requested floor above the underside', () => {
    const floored = pocket({ depthMode: 'floor', floorMm: 8 });
    const cut = resolveCutoutDepth(floored, SOCKETED);
    expect(cut).toBe(13);
    expect(floorUnderCutout({ ...floored, cutDepth: cut }, SOCKETED)).toBe(8);
  });

  it('keeps the default floor on a flat bin', () => {
    expect(resolveCutoutDepth(pocket({ depthMode: 'floor' }), FLAT)).toBe(19);
  });

  it('never cuts into the socket, however low the floor is set', () => {
    expect(resolveCutoutDepth(pocket({ depthMode: 'floor', floorMm: 1 }), SOCKETED)).toBe(16.25);
  });

  it('keeps a shallow pocket when the floor is set above the fill', () => {
    expect(resolveCutoutDepth(pocket({ depthMode: 'floor', floorMm: 40 }), SOCKETED)).toBe(0.5);
  });

  // A 20mm-deep pocket leaned 30° about its mouth drops its low floor edge
  // (20/2)·sin 30° = 5mm below the axis end, so an 8mm floor in 21mm of fill
  // leaves (13 - 5) / cos 30° along the axis.
  it('holds the low edge of a leaning pocket to the floor', () => {
    const leaning = pocket({ depth: 20, leanDeg: 30, depthMode: 'floor', floorMm: 8 });
    const cut = resolveCutoutDepth(leaning, FLAT);
    expect(cut).toBeCloseTo(8 / Math.cos(Math.PI / 6), 2);
    expect(floorUnderCutout({ ...leaning, cutDepth: cut }, FLAT)).toBeCloseTo(8, 1);
  });

  it('reads the floor under a leaning pocket from its low edge', () => {
    const leaning = pocket({ depth: 20, leanDeg: -30, cutDepth: 10 });
    expect(floorUnderCutout(leaning, FLAT)).toBeCloseTo(21 - (10 * Math.cos(Math.PI / 6) + 5), 2);
  });

  it.each(['mesh', 'knifeSlot', 'text'] as const)('ignores a mode on a %s cutout', (shape) => {
    expect(resolveCutoutDepth(pocket({ shape, depthMode: 'through' }), SOCKETED)).toBe(5);
    expect(isThroughCut(pocket({ shape, depthMode: 'through' }), bin())).toBe(false);
  });
});

describe('withResolvedCutoutDepths', () => {
  it('returns the same object when every depth already matches', () => {
    const params = bin({ cutouts: [pocket(), pocket({ id: 'q', depthMode: 'through' })] });
    const settled = withResolvedCutoutDepths(params);
    expect(withResolvedCutoutDepths(settled)).toBe(settled);
    expect(withResolvedCutoutDepths(bin({ cutouts: [pocket()] }))).toEqual(
      bin({ cutouts: [pocket()] })
    );
  });

  it('holds a floored pocket to its floor when the bin grows', () => {
    const floored = pocket({ depthMode: 'floor', floorMm: 8 });
    const fixed = pocket({ id: 'q', cutDepth: 6 });
    const short = withResolvedCutoutDepths(bin({ cutouts: [floored, fixed] }));
    const tall = withResolvedCutoutDepths({ ...short, height: 5 });
    expect(short.cutouts.map((c) => c.cutDepth)).toEqual([13, 6]);
    expect(tall.cutouts.map((c) => c.cutDepth)).toEqual([27, 6]);
  });
});

describe('throughBlockedReason', () => {
  const taper = { enabled: true, profile: 'chamfer' as const, bandHeight: 8 };
  const blocked: readonly [string, Partial<Cutout>, Partial<BinParams>, string][] = [
    ['a group member', { groupId: 'g' }, {}, 'group'],
    ['a leaning pocket', { leanDeg: 20 }, {}, 'tilt'],
    [
      'a pocket beside a tapered wall',
      {},
      {
        overhang: {
          left: 6,
          right: 6,
          front: 0,
          back: 0,
          taper: { ...taper, left: 6, right: 6, front: 0, back: 0 },
        },
      },
      'taper',
    ],
    ['a pocket over detachable feet', {}, { base: { ...SOLID, feet: 'detachable' } }, 'feet'],
    [
      'a Nesting body',
      {},
      {
        base: { ...SOLID, style: 'lid', trayBottom: { ...DEFAULT_TRAY_BOTTOM, floorAtBed: true } },
      },
      'nesting',
    ],
  ];

  it('allows a plain pocket', () => {
    expect(throughBlockedReason(pocket(), bin())).toBeNull();
    expect(isThroughCut(pocket({ depthMode: 'through' }), bin())).toBe(true);
  });

  it.each(blocked)('refuses %s, and the generator does not cut it through', (_n, c, p, reason) => {
    expect(throughBlockedReason(pocket(c), bin(p))).toBe(reason);
    expect(isThroughCut(pocket({ ...c, depthMode: 'through' }), bin(p))).toBe(false);
  });

  it('is not a through cut unless the mode says so', () => {
    expect(isThroughCut(pocket(), bin())).toBe(false);
  });
});
