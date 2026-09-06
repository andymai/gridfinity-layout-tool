import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, LabelTabConfig } from '@/features/bin-designer/types';
import {
  clickRailZBandAboveFloor,
  labelTabFootprints,
  labelTabInteriorDims,
  railFoulingLabelFootprints,
  railSegmentsClearOfBlocks,
} from './labelTabPlan';

function withLabel(label: Partial<LabelTabConfig>, over: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 3,
    height: 6,
    ...over,
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, depth: 12, width: 100, ...label },
  };
}

describe('labelTabInteriorDims', () => {
  it('subtracts the socket and the lip taper from a socketed bin', () => {
    const dims = labelTabInteriorDims(withLabel({}));
    // 6 x 7mm = 42 total, less the 5mm socket, less the 0.7mm lip taper.
    expect(dims?.interiorHeight).toBeCloseTo(36.3, 5);
    // 2 x 42 - 0.5 clearance - 2 x wallThickness.
    expect(dims?.innerW).toBeCloseTo(83.5 - 2 * DEFAULT_BIN_PARAMS.wallThickness, 5);
  });

  it('gives a flat base its whole height, since it has no socket', () => {
    const socketed = labelTabInteriorDims(withLabel({}));
    const flat = labelTabInteriorDims(
      withLabel({}, { base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' } })
    );
    expect((flat?.interiorHeight ?? 0) - (socketed?.interiorHeight ?? 0)).toBeCloseTo(5, 5);
  });

  it('keeps the lip taper out of a bin that has no stacking lip', () => {
    const noLip = labelTabInteriorDims(
      withLabel({}, { base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } })
    );
    expect(noLip?.interiorHeight).toBeCloseTo(37, 5);
  });

  it('has no interior to speak of for a base-only tile', () => {
    expect(
      labelTabInteriorDims(withLabel({}, { base: { ...DEFAULT_BIN_PARAMS.base, tile: true } }))
    ).toBeNull();
  });
});

describe('clickRailZBandAboveFloor', () => {
  it('places the band where the mated lid actually puts its rails', () => {
    // Measured on the real assembly for a 2x3x6 bin (interiorHeight 36.3):
    // the lid's rail solid spans [33.95, 37.70] above the cavity floor.
    const band = clickRailZBandAboveFloor(36.3);
    expect(band.lo).toBeCloseTo(33.95, 2);
    // `hi` carries the 0.8mm top chamfer above the rail's own top face.
    expect(band.hi).toBeCloseTo(38.5, 2);
  });
});

describe('labelTabFootprints', () => {
  const dims = { innerW: 81.1, innerD: 123.1, interiorHeight: 36.3 };
  const build = (p: BinParams) =>
    labelTabFootprints(p, dims.innerW, dims.innerD, dims.interiorHeight, p.wallThickness);

  it('returns nothing when label tabs are off', () => {
    expect(
      build({ ...withLabel({}), label: { ...DEFAULT_BIN_PARAMS.label, enabled: false } })
    ).toEqual([]);
  });

  // Anchored ON the outer wall, as opposed to hanging from an interior row
  // divider. Both are built and both are returned; these cases are about the
  // outer ones, so they select by position rather than by anchor name.
  const atBackWall = (f: { yMax: number }): boolean => f.yMax > dims.innerD / 2 - 1e-6;
  const atFrontWall = (f: { yMin: number }): boolean => f.yMin < -dims.innerD / 2 + 1e-6;

  it('anchors a back tab to the back wall and extends it forward', () => {
    const outer = build(withLabel({ edges: 'back' })).filter(atBackWall);
    expect(outer.length).toBeGreaterThan(0);
    for (const fp of outer) {
      expect(fp.anchor).toBe('back');
      expect(fp.yMax).toBeCloseTo(dims.innerD / 2, 3);
      expect(fp.yMax - fp.yMin).toBeCloseTo(12, 3);
    }
  });

  it('anchors a front tab to the front wall instead', () => {
    const outer = build(withLabel({ edges: 'front' })).filter(atFrontWall);
    expect(outer.length).toBeGreaterThan(0);
    for (const fp of outer) {
      expect(fp.anchor).toBe('front');
      expect(fp.yMin).toBeCloseTo(-dims.innerD / 2, 3);
    }
  });

  it('reports both outer walls when tabs sit on both edges', () => {
    const anchors = new Set(
      build(withLabel({ edges: 'both' }))
        .filter((f) => atBackWall(f) || atFrontWall(f))
        .map((f) => f.anchor)
    );
    expect(anchors).toEqual(new Set(['back', 'front']));
  });

  it('narrows the X span with the width percentage rather than assuming full width', () => {
    const full = build(withLabel({ width: 100 }));
    const half = build(withLabel({ width: 50 }));
    const span = (fs: readonly { xMin: number; xMax: number }[]) =>
      fs.reduce((acc, f) => acc + (f.xMax - f.xMin), 0);
    expect(span(half)).toBeCloseTo(span(full) / 2, 1);
  });
});

describe('alignment and spanning tabs', () => {
  const dims = { innerW: 123.1, innerD: 81.1, interiorHeight: 36.3 };
  const build = (p: BinParams) =>
    labelTabFootprints(p, dims.innerW, dims.innerD, dims.interiorHeight, p.wallThickness);

  it('pushes a narrowed tab to each edge it is aligned to', () => {
    // Alignment moves the whole tab in both modes, so the three
    // settings have to land it in three different places.
    const at = (alignment: 'left' | 'center' | 'right') =>
      build(withLabel({ width: 40, alignment })).map((f) => (f.xMin + f.xMax) / 2);

    const left = at('left');
    const centre = at('center');
    const right = at('right');
    expect(left.length).toBeGreaterThan(0);
    for (let i = 0; i < left.length; i++) {
      expect(left[i]).toBeLessThan(centre[i]);
      expect(right[i]).toBeGreaterThan(centre[i]);
    }
  });

  it('spans wall to wall in full-width row mode', () => {
    // `label.span` plans one shelf per row instead of one per compartment, and
    // its footprint is what a back rail has to clear.
    const fps = build(withLabel({ span: true, rowTexts: ['row'] }));
    expect(fps.length).toBeGreaterThan(0);
    for (const fp of fps) {
      expect(fp.xMin).toBeCloseTo(-dims.innerW / 2, 3);
      expect(fp.xMax).toBeCloseTo(dims.innerW / 2, 3);
    }
  });

  it('narrows a spanning tab with the width percentage too', () => {
    const full = build(withLabel({ span: true, rowTexts: ['row'] }));
    const half = build(withLabel({ span: true, rowTexts: ['row'], width: 50 }));
    expect(half[0].xMax - half[0].xMin).toBeCloseTo((full[0].xMax - full[0].xMin) / 2, 3);
  });
});

describe('railFoulingLabelFootprints', () => {
  it('reports the back wall for a default back-anchored tab', () => {
    const anchors = railFoulingLabelFootprints(withLabel({ edges: 'back' })).map((f) => f.anchor);
    expect(anchors.length).toBeGreaterThan(0);
    expect(new Set(anchors)).toEqual(new Set(['back']));
  });

  it('reports the FRONT wall for front-anchored tabs', () => {
    // The older code hardcoded 'back' here, so a front tab disabled a rail
    // that was never in its way and kept the one that was.
    const anchors = railFoulingLabelFootprints(withLabel({ edges: 'front' })).map((f) => f.anchor);
    expect(anchors.length).toBeGreaterThan(0);
    expect(new Set(anchors)).toEqual(new Set(['front']));
  });

  it('reports nothing once the shelf is dropped clear of the rail band', () => {
    //'s tuck-under pocket: the shelf sits low enough that a rail passes
    // above it, so that wall keeps its rail.
    const band = clickRailZBandAboveFloor(36.3);
    const tucked = railFoulingLabelFootprints(withLabel({ height: band.lo - 1, depth: 8 }));
    expect(tucked).toEqual([]);
  });

  it('reports nothing once a wall collar lifts the rail clear of the shelf', () => {
    // `extraWallHeightMm` raises the outer box and the lip with it,
    // leaving the interior plane (and so the shelf) where it was. The lid then
    // seats that much higher, so a tab it used to foul it now clears. Reading
    // the band off `interiorHeight` alone blocks the wall for a conflict that
    // does not exist: lost retention plus a warning about nothing.
    const plain = railFoulingLabelFootprints(withLabel({ edges: 'back' }));
    expect(plain.length).toBeGreaterThan(0);

    const collared = railFoulingLabelFootprints(
      withLabel({ edges: 'back' }, { extraWallHeightMm: 12 })
    );
    expect(collared).toEqual([]);
  });

  it('still fouls when the collar is too small to clear the shelf', () => {
    const barely = railFoulingLabelFootprints(
      withLabel({ edges: 'back' }, { extraWallHeightMm: 0.5 })
    );
    expect(barely.length).toBeGreaterThan(0);
  });

  it('reports nothing when label tabs are disabled', () => {
    expect(
      railFoulingLabelFootprints({
        ...withLabel({}),
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: false },
      })
    ).toEqual([]);
  });

  it('keeps the tab hanging from an interior row divider (#3477)', () => {
    // It cannot reach the rail on the wall it FACES, a row away, which is why
    // it was filtered out. But it spans its compartment wall to wall in X, so
    // it runs straight into the left and right rails — 1.25mm deep on a 2x2.
    // The cross-axis test in `railSegmentsClearOfLabelTabs` is what decides
    // which walls a footprint really takes, so it has to see this one.
    const params = withLabel(
      { edges: 'back' },
      { compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] } }
    );
    const dims = labelTabInteriorDims(params);
    if (!dims) throw new Error('expected interior dims');
    const interior = railFoulingLabelFootprints(params).filter(
      (f) => f.yMax < dims.innerD / 2 - 1e-6
    );
    expect(interior.length).toBeGreaterThan(0);
    // And each one reaches a side wall, which is where the rail it fouls runs.
    expect(
      interior.every((f) => f.xMin <= -dims.innerW / 2 + 1e-6 || f.xMax >= dims.innerW / 2 - 1e-6)
    ).toBe(true);
  });
});

describe('socket-mode tab width (#3402)', () => {
  const dims = { innerW: 123.1, innerD: 81.1, interiorHeight: 36.3 };
  const socketParams = (width: number): BinParams => ({
    ...withLabel({ width }),
    width: 3,
    depth: 2,
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, depth: 12, width, mode: 'socket' },
  });
  const spans = (p: BinParams) =>
    labelTabFootprints(p, dims.innerW, dims.innerD, dims.interiorHeight, p.wallThickness).map(
      (f) => f.xMax - f.xMin
    );

  it('narrows the shelf instead of forcing the full compartment', () => {
    // The older builder ignored the percentage here outright, so a user
    // fitting a centred 1u plate still got a shelf across the whole bin.
    const full = spans(socketParams(100));
    const half = spans(socketParams(50));
    expect(full.length).toBeGreaterThan(0);
    expect(half.length).toBe(full.length);
    for (let i = 0; i < full.length; i++) {
      expect(half[i]).toBeCloseTo(full[i] / 2, 3);
    }
  });

  it('centres a narrowed socket tab when alignment asks for it', () => {
    const p = {
      ...socketParams(50),
      label: { ...socketParams(50).label, alignment: 'center' as const },
    };
    const fps = labelTabFootprints(
      p,
      dims.innerW,
      dims.innerD,
      dims.interiorHeight,
      p.wallThickness
    );
    expect(fps.length).toBeGreaterThan(0);
    for (const fp of fps) {
      expect((fp.xMin + fp.xMax) / 2).toBeCloseTo(0, 3);
    }
  });
});

describe('railSegmentsClearOfBlocks', () => {
  // Deliberately mixed provenance: a divider notch and a lip gap are the same
  // value here, and the pass must not care which is which.
  const blocks = [
    { side: 'back', lo: -2, hi: 2 },
    { side: 'front', lo: 10, hi: 14 },
  ] as const;

  it('splits a run around a block on its own wall', () => {
    expect(railSegmentsClearOfBlocks([{ lo: -20, hi: 20 }], 'back', blocks)).toEqual([
      { lo: -20, hi: -2 },
      { lo: 2, hi: 20 },
    ]);
  });

  it('ignores blocks belonging to another wall', () => {
    expect(railSegmentsClearOfBlocks([{ lo: -20, hi: 20 }], 'left', blocks)).toEqual([
      { lo: -20, hi: 20 },
    ]);
  });

  it('composes onto stretches the label pass already cut', () => {
    expect(
      railSegmentsClearOfBlocks(
        [
          { lo: -20, hi: -5 },
          { lo: -1, hi: 20 },
        ],
        'back',
        blocks
      )
    ).toEqual([
      { lo: -20, hi: -5 },
      { lo: 2, hi: 20 },
    ]);
  });

  it('leaves nothing when a block swallows the run', () => {
    expect(railSegmentsClearOfBlocks([{ lo: -1, hi: 1 }], 'back', blocks)).toEqual([]);
  });
});
