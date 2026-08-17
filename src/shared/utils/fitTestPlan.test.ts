import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout } from '@/shared/types/bin';
import {
  FIT_TEST_MIN_THICKNESS_MM,
  canBuildFitTest,
  clampFitTestThicknessMm,
  cutoutDisplacementMm3,
  deepestCutoutDepthMm,
  defaultFitTestThicknessMm,
  fitTestCutoutSpans,
  fitTestCutouts,
  fitTestFootprintMm,
  estimateFitTestVolumeMm3,
  fitTestStampLines,
  fitTestThicknessRangeMm,
  nudgeSeamsClearOfCutouts,
  planFitTestSplit,
  planFitTestStampArea,
} from './fitTestPlan';

const cutout = (over: Partial<Cutout>): Cutout => ({
  id: 'c1',
  shape: 'circle',
  x: 10,
  y: 10,
  width: 12,
  depth: 12,
  cutDepth: 8,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...over,
});

function board(over: Partial<BinParams> = {}, cutouts: Cutout[] = [cutout({})]): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 4,
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutouts,
    cutoutConfig: { topOffset: 0 },
    ...over,
  };
}

describe('canBuildFitTest', () => {
  it('needs a solid bin with at least one cutout', () => {
    expect(canBuildFitTest(board())).toBe(true);
    expect(canBuildFitTest(board({}, []))).toBe(false);
  });

  it('refuses a hollow bin even when cutouts are stored on it', () => {
    // `style` and `base.solid` are kept in lockstep by the constraint engine,
    // but only `base.solid` decides whether the generator fills the cavity —
    // so a payload carrying cutouts without it has nothing to slice.
    const hollow = board({ base: { ...DEFAULT_BIN_PARAMS.base, solid: false } });
    expect(canBuildFitTest(hollow)).toBe(false);
  });

  it('ignores hidden cutouts, which the generator does not cut', () => {
    expect(canBuildFitTest(board({}, [cutout({ hidden: true })]))).toBe(false);
  });
});

describe('fitTestCutouts', () => {
  it('expands an array master into its instances', () => {
    const master = cutout({
      array: {
        mode: 'grid',
        cols: 3,
        rows: 2,
        pitchX: 15,
        pitchY: 15,
        count: 1,
        radius: 10,
        startAngle: 0,
        rotateToCenter: false,
      },
    });
    expect(fitTestCutouts(board({}, [master]))).toHaveLength(6);
  });
});

describe('thickness', () => {
  it('defaults into the 3-5mm band', () => {
    expect(defaultFitTestThicknessMm(board({}, [cutout({ cutDepth: 2 })]))).toBe(3);
    expect(defaultFitTestThicknessMm(board({}, [cutout({ cutDepth: 4 })]))).toBe(4);
    expect(defaultFitTestThicknessMm(board({}, [cutout({ cutDepth: 30 })]))).toBe(5);
  });

  it('caps the range at the deepest cut plus a floor under it', () => {
    const params = board({}, [cutout({ cutDepth: 12 })]);
    expect(deepestCutoutDepthMm(params)).toBe(12);
    expect(fitTestThicknessRangeMm(params)).toEqual({
      min: FIT_TEST_MIN_THICKNESS_MM,
      max: 12 + params.wallThickness,
    });
  });

  it('clamps an out-of-range value and falls back to the default on a non-number', () => {
    const params = board({}, [cutout({ cutDepth: 8 })]);
    expect(clampFitTestThicknessMm(params, 100)).toBe(8 + params.wallThickness);
    expect(clampFitTestThicknessMm(params, 0)).toBe(FIT_TEST_MIN_THICKNESS_MM);
    expect(clampFitTestThicknessMm(params, NaN)).toBe(defaultFitTestThicknessMm(params));
  });
});

describe('fitTestCutoutSpans', () => {
  it('places a cutout in the bin-centred frame', () => {
    // 2x2 bin: outer 83.5, interior 81.1, so the interior origin is at -40.55.
    const params = board({}, [cutout({ shape: 'rectangle', x: 0, y: 0, width: 10, depth: 10 })]);
    const { x } = fitTestCutoutSpans(params);
    expect(x[0].min).toBeCloseTo(-40.55, 2);
    expect(x[0].max).toBeCloseTo(-30.55, 2);
  });

  it('grows the footprint by clearance and chamfer, which widen the opening', () => {
    // A circle takes both; a rectangle takes only the chamfer (see the
    // stale-clearance regression below).
    const plain = fitTestCutoutSpans(board({}, [cutout({ shape: 'circle', width: 10 })])).x[0];
    const grown = fitTestCutoutSpans(
      board({}, [cutout({ shape: 'circle', width: 10, clearance: 0.5, chamferWidth: 1 })])
    ).x[0];
    expect(grown.max - grown.min).toBeCloseTo(plain.max - plain.min + 3, 5);
  });

  it('takes a rotated cutout by its axis-aligned bounds', () => {
    const square = board({}, [cutout({ shape: 'rectangle', width: 10, depth: 40, rotation: 90 })]);
    const { x } = fitTestCutoutSpans(square);
    // Rotated a quarter turn, the 40mm depth becomes the X extent.
    expect(x[0].max - x[0].min).toBeCloseTo(40, 5);
  });
});

describe('nudgeSeamsClearOfCutouts', () => {
  const spans = [{ min: -10, max: 10 }];

  it('leaves a seam that already misses every cutout', () => {
    expect(nudgeSeamsClearOfCutouts([30], spans, 50)).toEqual({ planes: [30], blocked: 0 });
  });

  it('moves a seam out to the nearer edge of the run it crosses', () => {
    // Margin is added around the span, so the plane lands clear of it.
    const plan = nudgeSeamsClearOfCutouts([8], spans, 50);
    expect(plan.blocked).toBe(0);
    expect(plan.planes[0]).toBeGreaterThan(10);
  });

  it('reports a seam it cannot move far enough, instead of shipping it quietly', () => {
    const plan = nudgeSeamsClearOfCutouts([0], spans, 1);
    expect(plan.blocked).toBe(1);
    expect(plan.planes).toEqual([0]);
  });

  it('drops a duplicate when two seams are nudged into the same gap', () => {
    const plan = nudgeSeamsClearOfCutouts([-1, 1], spans, 50);
    expect(new Set(plan.planes).size).toBe(plan.planes.length);
  });

  it('is a no-op with no cutouts to miss', () => {
    expect(nudgeSeamsClearOfCutouts([5], [], 50)).toEqual({ planes: [5], blocked: 0 });
  });
});

/** Stand-in for `getSplitPlanePositionsMm`: one central cut when oversize. */
const splitPlanesStub = (size: number, max: number, _pitch: number): number[] =>
  size <= max ? [] : [0];

describe('planFitTestSplit', () => {
  const splitPlanes = splitPlanesStub;

  it('leaves a card that fits the bed whole', () => {
    const plan = planFitTestSplit(board(), { width: 256, depth: 256 }, splitPlanes);
    expect(plan.pieceCount).toBe(1);
    expect(plan.blockedSeams).toBe(0);
  });

  it('leaves the card whole when no bed is known', () => {
    expect(planFitTestSplit(board({ width: 12 }), undefined, splitPlanes).pieceCount).toBe(1);
  });

  it('splits an oversize card', () => {
    const plan = planFitTestSplit(board({ width: 10 }), { width: 200, depth: 200 }, splitPlanes);
    expect(plan.pieceCount).toBeGreaterThan(1);
  });
});

describe('planFitTestStampArea', () => {
  it('finds a clear strip on a sparse board', () => {
    const area = planFitTestStampArea(board({}, [cutout({ cutDepth: 20 })]), 4, 8);
    expect(area).not.toBeNull();
  });

  it('ignores cutouts shallower than the card, whose underside is still solid', () => {
    // A 2mm pocket in a 4mm card leaves material below it, so a stamp there is
    // unharmed and the whole underside is available.
    const shallow = board({}, [
      cutout({ shape: 'rectangle', x: 0, y: 0, width: 81, depth: 81, cutDepth: 2 }),
    ]);
    expect(planFitTestStampArea(shallow, 4, 8)).not.toBeNull();
  });

  it('refuses when every strip is broken by a through cut', () => {
    const dense = board({}, [
      cutout({ shape: 'rectangle', x: 0, y: 0, width: 81, depth: 81, cutDepth: 20 }),
    ]);
    expect(planFitTestStampArea(dense, 4, 8)).toBeNull();
  });
});

describe('fitTestStampLines', () => {
  it('carries the design name, the clearance and the thickness', () => {
    const lines = fitTestStampLines(board({}, [cutout({ clearance: 0.2 })]), 4.5, {
      designName: 'Socket rail',
    });
    expect(lines).toEqual(['Socket rail', 'fit 0.20 · 4.5mm']);
  });

  it('prints a range when the cutouts disagree', () => {
    const params = board({}, [
      cutout({ id: 'a', clearance: 0.1 }),
      cutout({ id: 'b', clearance: 0.3 }),
    ]);
    expect(fitTestStampLines(params, 4, {})[1]).toBe('fit 0.10-0.30 · 4mm');
  });

  it('adds the piece label only when the card is split', () => {
    expect(fitTestStampLines(board(), 4, {})).toHaveLength(2);
    expect(fitTestStampLines(board(), 4, { pieceLabel: 'A1' })).toHaveLength(3);
  });

  it('falls back to a name when the design is untitled', () => {
    expect(fitTestStampLines(board(), 4, { designName: '   ' })[0]).toBe('Fit test');
  });
});

describe('overhang', () => {
  const overhung = (mm: number): Partial<BinParams> => ({
    overhang: { enabled: true, left: mm, right: mm, front: 0, back: 0 },
  });

  it('widens the footprint by the overhang, which grows the body past the grid', () => {
    const nominal = fitTestFootprintMm(board());
    const grown = fitTestFootprintMm(board(overhung(20)));
    expect(grown.width - nominal.width).toBeCloseTo(40, 5);
    expect(grown.depth).toBeCloseTo(nominal.depth, 5);
  });

  it('splits an overhung card the nominal extent would call bed-sized', () => {
    // 6x2 nominal is 251.5mm and fits a 256 bed; +20mm each side does not.
    const wide = board({ width: 6, ...overhung(20) });
    expect(fitTestFootprintMm(wide).width).toBeGreaterThan(256);
    const plan = planFitTestSplit(wide, { width: 256, depth: 256 }, splitPlanesStub);
    expect(plan.pieceCount).toBeGreaterThan(1);
  });
});

describe('cutoutDisplacementMm3', () => {
  it('prices a rectangle by its full prism', () => {
    const params = board({}, [
      cutout({ shape: 'rectangle', width: 10, depth: 20, cutDepth: 5, cornerRadius: 0 }),
    ]);
    expect(cutoutDisplacementMm3(params)).toBeCloseTo(10 * 20 * 5, 5);
  });

  it('prices a circle by its area, not its bounding box', () => {
    const params = board({}, [cutout({ shape: 'circle', width: 10, depth: 10, cutDepth: 4 })]);
    expect(cutoutDisplacementMm3(params)).toBeCloseTo(Math.PI * 25 * 4, 5);
  });

  it('counts no deeper than the limit it is given', () => {
    const params = board({}, [
      cutout({ shape: 'rectangle', width: 10, depth: 10, cutDepth: 20, cornerRadius: 0 }),
    ]);
    expect(cutoutDisplacementMm3(params, 5)).toBeCloseTo(10 * 10 * 5, 5);
  });
});

describe('regressions found in review', () => {
  it('does not grow a rectangle by a stale clearance the builder ignores', () => {
    // CLEARANCE_SHAPES excludes 'rectangle', so a cutout switched from circle
    // keeps a clearance the generator never applies. Counting it would reserve
    // seam margin and subtract volume for material that is never removed.
    const plain = board({}, [cutout({ shape: 'rectangle', width: 10, cornerRadius: 0 })]);
    const stale = board({}, [
      cutout({ shape: 'rectangle', width: 10, cornerRadius: 0, clearance: 2 }),
    ]);
    expect(cutoutDisplacementMm3(stale)).toBeCloseTo(cutoutDisplacementMm3(plain), 5);

    const plainSpan = fitTestCutoutSpans(plain).x[0];
    const staleSpan = fitTestCutoutSpans(stale).x[0];
    expect(staleSpan.max - staleSpan.min).toBeCloseTo(plainSpan.max - plainSpan.min, 5);
  });

  it('counts a non-union group by its largest member, not the sum', () => {
    // subtract/intersect/exclude all put material back, so summing the members
    // removes more than the group ever cuts.
    const members = (op: 'union' | 'subtract'): Cutout[] => [
      cutout({
        id: 'a',
        shape: 'rectangle',
        width: 10,
        depth: 10,
        cutDepth: 5,
        cornerRadius: 0,
        groupId: 'g',
        groupOp: op,
      }),
      cutout({
        id: 'b',
        shape: 'rectangle',
        width: 6,
        depth: 6,
        cutDepth: 5,
        cornerRadius: 0,
        groupId: 'g',
        groupOp: op,
      }),
    ];
    expect(cutoutDisplacementMm3(board({}, members('union')))).toBeCloseTo(
      10 * 10 * 5 + 6 * 6 * 5,
      5
    );
    expect(cutoutDisplacementMm3(board({}, members('subtract')))).toBeCloseTo(10 * 10 * 5, 5);
  });

  it('scales the card estimate by a partial mask, as the bin estimate does', () => {
    const full = board({ width: 3, depth: 3 });
    const masked = board({
      width: 3,
      depth: 3,
      cellMask: { cols: 3, rows: 3, cells: [1, 1, 1, 1, 1, 0, 0, 0, 0] },
    });
    const ratio = estimateFitTestVolumeMm3(masked, 4) / estimateFitTestVolumeMm3(full, 4);
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.7);
  });

  it('clamps the fallback default into the design range', () => {
    // A 0.5mm pocket allows at most 1.7mm of card, but the default band starts
    // at 3mm — the worker reaches this path whenever a caller omits a thickness.
    const shallow = board({}, [cutout({ cutDepth: 0.5 })]);
    const { max } = fitTestThicknessRangeMm(shallow);
    expect(clampFitTestThicknessMm(shallow, NaN)).toBeLessThanOrEqual(max);
  });

  it('keeps a nudged seam inside the card', () => {
    // A cutout flush against the edge puts the block's far side past the card,
    // and a plane out there gives the splitter a negative-width piece.
    const plan = nudgeSeamsClearOfCutouts([38], [{ min: 30, max: 41 }], 50, {
      min: -41.75,
      max: 41.75,
    });
    for (const p of plan.planes) {
      expect(p).toBeGreaterThan(-41.75);
      expect(p).toBeLessThan(41.75);
    }
  });

  it('counts a dropped duplicate seam as blocked, not as a clean split', () => {
    // Both planes sit left of centre in one block, so both move to the same
    // edge and one is dropped — the surviving piece is oversize, and silence
    // there would ship a card that does not fit the bed.
    const plan = nudgeSeamsClearOfCutouts([60, 70], [{ min: 0, max: 100 }], 200);
    expect(plan.planes).toHaveLength(1);
    expect(plan.blocked).toBeGreaterThan(0);
  });

  it('keeps the stamp out of a pocket whose floor is thinner than the engraving', () => {
    // A 3.8mm pocket in a 4mm card leaves 0.2mm of floor; a 0.4mm stamp would
    // punch straight through the pocket the user is measuring.
    const board38 = board({}, [
      cutout({ shape: 'rectangle', x: 0, y: 0, width: 81, depth: 81, cutDepth: 3.8 }),
    ]);
    expect(planFitTestStampArea(board38, 4, 8, 0.4)).toBeNull();
    // With no stamp depth declared the old behaviour stands: the floor counts.
    expect(planFitTestStampArea(board38, 4, 8, 0)).not.toBeNull();
  });
});
