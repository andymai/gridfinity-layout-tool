import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import {
  effectiveOpenSides,
  normalizeOpenSides,
  openSideBlocker,
  openSideChannels,
  openSidePolygonExits,
  openSideWallExits,
} from './cutoutOpenSides';

const INNER = 81.1;

function rect(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'r1',
    shape: 'rectangle',
    x: 10,
    y: 20,
    width: 30,
    depth: 12,
    cutDepth: 8,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    openSides: [{ side: 'right' }],
    ...overrides,
  };
}

function solid(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    ...overrides,
  };
}

const REPEAT = {
  mode: 'grid' as const,
  cols: 1,
  rows: 3,
  pitchX: 12,
  pitchY: 15,
  count: 1,
  radius: 20,
  startAngle: 0,
  rotateToCenter: false,
};

describe('openSideBlocker', () => {
  it('passes any profile shape at any rotation on a solid host', () => {
    expect(openSideBlocker(rect(), solid())).toBeNull();
    expect(openSideBlocker(rect({ rotation: 37 }), solid())).toBeNull();
    expect(openSideBlocker(rect({ shape: 'circle' }), solid())).toBeNull();
    expect(openSideBlocker(rect({ shape: 'slot' }), solid())).toBeNull();
    expect(
      openSideBlocker(rect({ groupId: 'g' }), solid({ cutouts: [rect({ groupId: 'g' })] }))
    ).toBeNull();
  });

  it('refuses text and mesh, a repeated group, and a leaned pocket, in that order', () => {
    expect(openSideBlocker(rect({ shape: 'text' }), solid())).toBe('shape');
    expect(openSideBlocker(rect({ shape: 'mesh' }), solid())).toBe('shape');
    const repeated = rect({ groupId: 'g', array: REPEAT });
    expect(openSideBlocker(repeated, solid({ cutouts: [repeated] }))).toBe('grouped');
    expect(openSideBlocker(rect({ leanDeg: 10 }), solid())).toBe('lean');
    expect(openSideBlocker(rect({ leanDeg: 10 }), DEFAULT_BIN_PARAMS)).toBe('lean');
  });

  it('lets a one-copy repeat through and refuses a real repeat', () => {
    const one = rect({ groupId: 'g', array: { ...REPEAT, rows: 1 } });
    expect(openSideBlocker(one, solid({ cutouts: [one] }))).toBeNull();
    const three = rect({ groupId: 'g', array: REPEAT });
    expect(openSideBlocker(three, solid({ cutouts: [three] }))).toBe('grouped');
  });

  it('refuses a cavity host and a tapered wall', () => {
    expect(openSideBlocker(rect(), DEFAULT_BIN_PARAMS)).toBe('host');
    const tapered = solid({
      overhang: {
        enabled: true,
        left: 3,
        right: 3,
        front: 3,
        back: 3,
        taper: {
          enabled: true,
          profile: 'chamfer',
          bandHeight: 5,
          left: 3,
          right: 3,
          front: 3,
          back: 3,
        },
      },
    });
    expect(openSideBlocker(rect(), tapered)).toBe('taper');
  });
});

describe('normalizeOpenSides', () => {
  it('lifts bare wall names into specs and keeps one per side in canonical order', () => {
    expect(normalizeOpenSides(['right', 'front', 'right', 'up'])).toEqual([
      { side: 'front' },
      { side: 'right' },
    ]);
    expect(normalizeOpenSides([])).toBeUndefined();
    expect(normalizeOpenSides('right')).toBeUndefined();
  });

  it('keeps a valid width and a true tunnel, and drops anything else', () => {
    expect(
      normalizeOpenSides([
        { side: 'right', widthMm: 8, tunnel: true },
        { side: 'left', widthMm: 0.2, tunnel: false },
        { side: 'back', widthMm: 'wide' },
      ])
    ).toEqual([{ side: 'back' }, { side: 'left' }, { side: 'right', widthMm: 8, tunnel: true }]);
  });
});

describe('effectiveOpenSides', () => {
  it('is empty for a hidden or gated cutout and the stored set otherwise', () => {
    expect(effectiveOpenSides(rect({ hidden: true }), solid())).toEqual([]);
    expect(effectiveOpenSides(rect({ leanDeg: 5 }), solid())).toEqual([]);
    expect(
      effectiveOpenSides(rect({ openSides: [{ side: 'back' }, { side: 'left' }] }), solid())
    ).toEqual([{ side: 'back' }, { side: 'left' }]);
  });
});

describe('openSideChannels', () => {
  it('runs from the shape centre at its full extent across the exit', () => {
    const [ch] = openSideChannels(solid({ cutouts: [rect()] }));
    expect(ch).toMatchObject({ ownerId: 'r1', side: 'right', tunnel: false, cutDepth: 8 });
    expect(ch.lo).toBeCloseTo(20, 5);
    expect(ch.hi).toBeCloseTo(32, 5);
    expect(ch.start).toBeCloseTo(25, 5);
    expect(ch.edge).toBeCloseTo(40, 5);
  });

  it('measures a turned slot at its true width, not its bounding rectangle', () => {
    const [ch] = openSideChannels(
      solid({ cutouts: [rect({ shape: 'slot', rotation: 90, openSides: [{ side: 'front' }] })] })
    );
    // A 30×12 stadium turned a quarter spans 12 along X.
    expect(ch.hi - ch.lo).toBeCloseTo(12, 5);
    expect(ch.edge).toBeCloseTo(26 - 15, 5);
  });

  it('narrows to an explicit width centred on the shape, never wider than the shape', () => {
    const [ch] = openSideChannels(
      solid({ cutouts: [rect({ openSides: [{ side: 'right', widthMm: 4, tunnel: true }] })] })
    );
    expect(ch.lo).toBeCloseTo(24, 5);
    expect(ch.hi).toBeCloseTo(28, 5);
    expect(ch.tunnel).toBe(true);
    const [wide] = openSideChannels(
      solid({ cutouts: [rect({ openSides: [{ side: 'right', widthMm: 40 }] })] })
    );
    expect(wide.hi - wide.lo).toBeCloseTo(12, 5);
  });

  it('carries the entry chamfer, never negative', () => {
    const [ch] = openSideChannels(solid({ cutouts: [rect({ chamferWidth: 1.5 })] }));
    expect(ch.chamferMm).toBe(1.5);
    const [none] = openSideChannels(solid({ cutouts: [rect({ chamferWidth: -2 })] }));
    expect(none.chamferMm).toBe(0);
  });

  it('plans one channel per repeat copy', () => {
    const chs = openSideChannels(solid({ cutouts: [rect({ array: REPEAT })] }));
    expect(chs.map((c) => (c.lo + c.hi) / 2)).toEqual([
      expect.closeTo(26, 5),
      expect.closeTo(41, 5),
      expect.closeTo(56, 5),
    ]);
  });

  it('measures a group by its combined extent and opens it once per side', () => {
    const a = rect({ id: 'a', groupId: 'g', groupOp: 'union', openSides: [{ side: 'right' }] });
    const b = rect({
      id: 'b',
      groupId: 'g',
      groupOp: 'union',
      x: 30,
      y: 26,
      width: 20,
      depth: 20,
      cutDepth: 12,
      openSides: [{ side: 'right' }, { side: 'back' }],
    });
    const chs = openSideChannels(solid({ cutouts: [a, b] }));
    expect(chs.map((c) => c.side)).toEqual(['back', 'right']);
    const right = chs.find((c) => c.side === 'right');
    expect(right?.lo).toBeCloseTo(20, 5);
    expect(right?.hi).toBeCloseTo(46, 5);
    expect(right?.cutDepth).toBe(12);
    expect(right?.ownerId).toBe('a');
  });

  it('takes the common interval and the shallowest depth for an intersect group', () => {
    const a = rect({ id: 'a', groupId: 'g', groupOp: 'intersect', openSides: [{ side: 'right' }] });
    const b = rect({
      id: 'b',
      groupId: 'g',
      groupOp: 'intersect',
      x: 20,
      y: 26,
      width: 30,
      depth: 12,
      cutDepth: 4,
    });
    const [ch] = openSideChannels(solid({ cutouts: [a, b] }));
    expect(ch.lo).toBeCloseTo(26, 5);
    expect(ch.hi).toBeCloseTo(32, 5);
    expect(ch.cutDepth).toBe(4);
  });

  it('plans nothing for a group whose op visibly empties it', () => {
    const base = rect({
      id: 'a',
      groupId: 'g',
      groupOp: 'subtract',
      openSides: [{ side: 'right' }],
    });
    const cutter = rect({
      id: 'b',
      groupId: 'g',
      groupOp: 'subtract',
      x: 5,
      y: 15,
      width: 40,
      depth: 22,
      zIndex: 1,
    });
    expect(openSideChannels(solid({ cutouts: [base, cutter] }))).toEqual([]);
    const twin = rect({
      id: 'c',
      groupId: 'x',
      groupOp: 'exclude',
      openSides: [{ side: 'right' }],
    });
    const twin2 = rect({ id: 'd', groupId: 'x', groupOp: 'exclude' });
    expect(openSideChannels(solid({ cutouts: [twin, twin2] }))).toEqual([]);
  });

  it('measures a group only by the members the worker extrudes', () => {
    const a = rect({ id: 'a', groupId: 'g', groupOp: 'union', openSides: [{ side: 'right' }] });
    const caption = rect({
      id: 't',
      groupId: 'g',
      groupOp: 'union',
      shape: 'text',
      x: 0,
      y: 0,
      width: 60,
      depth: 60,
      cutDepth: 30,
    });
    const [ch] = openSideChannels(solid({ cutouts: [a, caption] }));
    expect(ch.cutDepth).toBe(8);
    expect(ch.lo).toBeCloseTo(20, 5);
    expect(ch.hi).toBeCloseTo(32, 5);
  });

  it('drops channels for owners the worker reports as empty', () => {
    expect(openSideChannels(solid({ cutouts: [rect()] }), new Set(['r1']))).toEqual([]);
  });
});

describe('custom-shape bins', () => {
  // 3x2 units, U shaped: both top quadrants' inner halves missing.
  const U_MASK: CellMask = {
    cols: 6,
    rows: 4,
    cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1],
  };
  function uBin(cutouts: Cutout[]): BinParams {
    return solid({ width: 3, depth: 2, cellMask: U_MASK, cutouts });
  }
  // 3x2 interior at the default wall: 126 - 0.5 - 2.4 by 84 - 0.5 - 2.4.
  const INNER_W = 123.1;

  it('ends a channel at the first wall its ray meets, not the bounding box', () => {
    // A pocket in the top-left arm opening right: the arm's inner wall sits
    // at nominal x = -21 (centred), so the face is a quarter tolerance in.
    const [ch] = openSideChannels(
      uBin([rect({ x: 8, y: 50, width: 22, depth: 20, openSides: [{ side: 'right' }] })])
    );
    expect(ch.faceMm).toBeCloseTo(-21 - 0.25 + INNER_W / 2, 5);
    expect(ch.edgeCrossMm).toBeCloseTo(-21, 5);
  });

  it('uses the bounding box face where the arm reaches it', () => {
    const [ch] = openSideChannels(
      uBin([rect({ x: 8, y: 50, width: 22, depth: 20, openSides: [{ side: 'left' }] })])
    );
    expect(ch.faceMm).toBeCloseTo(-1.2, 5);
    expect(ch.edgeCrossMm).toBeCloseTo(-63, 5);
  });

  it('reports polygon exits on their own edge and none through the rectangular path', () => {
    const params = uBin([
      rect({
        x: 8,
        y: 50,
        width: 22,
        depth: 20,
        openSides: [{ side: 'right' }, { side: 'back', tunnel: true }],
      }),
    ]);
    const exits = openSidePolygonExits(params);
    expect(exits).toHaveLength(1);
    expect(exits[0].side).toBe('right');
    expect(exits[0].edgeCross).toBeCloseTo(-21, 5);
    expect(exits[0].lo).toBeCloseTo(50 - 81.1 / 2, 5);
    expect(exits[0].hi).toBeCloseTo(70 - 81.1 / 2, 5);
    expect(openSideWallExits(params, INNER_W, 81.1)).toEqual([]);
  });
});

describe('openSideWallExits', () => {
  it('reports open-top channels in the centred frame and skips tunnels', () => {
    const exits = openSideWallExits(
      solid({
        cutouts: [rect({ openSides: [{ side: 'right' }, { side: 'front', tunnel: true }] })],
      }),
      INNER,
      INNER
    );
    expect(exits).toHaveLength(1);
    expect(exits[0].side).toBe('right');
    expect(exits[0].centre).toBeCloseTo(26 - INNER / 2, 5);
    expect(exits[0].width).toBeCloseTo(12, 5);
  });

  it('reports nothing on a cavity bin', () => {
    expect(openSideWallExits({ ...DEFAULT_BIN_PARAMS, cutouts: [rect()] }, INNER, INNER)).toEqual(
      []
    );
  });
});
