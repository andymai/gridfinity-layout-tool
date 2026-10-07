import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import { DEFAULT_KNIFE_SPEC } from '@/shared/types/bin';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { getSplitPlanePositionsMm } from '@/shared/utils/splitPositions';
import { FIT_TEST_SEAM_MARGIN_MM, fitTestFootprintBox, planFitTestSplit } from './fitTestPlan';
import {
  FIT_TEST_OUTLINE_HEIGHT_MM,
  FIT_TEST_OUTLINE_WALL_MM,
  clampFitTestOutlineHeightMm,
  clampFitTestOutlineWallMm,
  estimateFitTestOutlineVolumeMm3,
  fitTestOutlineBoxes,
  fitTestOutlineSource,
  planFitTestOutlineSplit,
  resolveFitTestOutlineSize,
} from './fitTestOutlinePlan';

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

describe('outline size', () => {
  it('opens on three layers of three extrusions', () => {
    expect(resolveFitTestOutlineSize()).toEqual({ heightMm: 0.6, wallMm: 1.2 });
  });

  it('goes down to a single layer and no lower', () => {
    expect(clampFitTestOutlineHeightMm(0.2)).toBe(0.2);
    expect(clampFitTestOutlineHeightMm(0.05)).toBe(FIT_TEST_OUTLINE_HEIGHT_MM.min);
    expect(clampFitTestOutlineHeightMm(9)).toBe(FIT_TEST_OUTLINE_HEIGHT_MM.max);
  });

  it('keeps the ring between two extrusions and a near-card', () => {
    expect(clampFitTestOutlineWallMm(0.4)).toBe(FIT_TEST_OUTLINE_WALL_MM.min);
    expect(clampFitTestOutlineWallMm(10)).toBe(FIT_TEST_OUTLINE_WALL_MM.max);
  });

  it('falls back to the default for a missing or non-finite value', () => {
    expect(resolveFitTestOutlineSize({ heightMm: NaN, wallMm: 1.6 })).toEqual({
      heightMm: FIT_TEST_OUTLINE_HEIGHT_MM.default,
      wallMm: 1.6,
    });
  });
});

describe('fitTestOutlineSource', () => {
  it('takes off the entry chamfer, which flares the rim past the wall a part clears', () => {
    const [traced] = fitTestOutlineSource(board({}, [cutout({ chamferWidth: 0.8 })])).cutouts;
    expect(traced.chamferWidth).toBeUndefined();
  });

  it('keeps everything that sizes or places the pocket', () => {
    const original = cutout({
      shape: 'path',
      clearance: 0.3,
      rotation: 30,
      groupId: 'g1',
      groupOp: 'subtract',
      path: [{ x: 0, y: 0, handleIn: null, handleOut: null, symmetric: false }],
    });
    const [traced] = fitTestOutlineSource(board({}, [original])).cutouts;
    expect(traced).toMatchObject({
      clearance: 0.3,
      rotation: 30,
      groupId: 'g1',
      groupOp: 'subtract',
      path: original.path,
    });
  });

  it('drops every engraving and label socket, which would trace outlines of their own', () => {
    const labelled = cutout({
      label: 'M3',
      engraveLabel: true,
      labelMode: 'socket',
      array: {
        mode: 'grid',
        cols: 2,
        rows: 1,
        pitchX: 15,
        pitchY: 15,
        count: 1,
        radius: 10,
        startAngle: 0,
        rotateToCenter: false,
        labels: ['A', 'B'],
      },
    });
    const text = cutout({ id: 't1', shape: 'text', label: 'TOOLS' });
    const traced = fitTestOutlineSource(board({}, [labelled, text])).cutouts;

    expect(traced).toHaveLength(1);
    expect(traced[0]).toMatchObject({ label: '', engraveLabel: false });
    expect(traced[0].labelMode).toBeUndefined();
    expect(traced[0].array?.labels).toBeUndefined();
    expect(traced[0].array?.cols).toBe(2);
  });
});

describe('planFitTestOutlineSplit', () => {
  const splitPlanes = getSplitPlanePositionsMm;

  it('leaves the outline whole when no bed is known', () => {
    expect(planFitTestOutlineSplit(board({ width: 12 }), undefined, splitPlanes, 1.2)).toEqual({
      planesX: [],
      planesY: [],
      pieceCount: 1,
      blockedSeams: 0,
    });
  });

  it('keeps whole an outline that fits a bed its card overflows', () => {
    // An 8x1 rail is 335mm long, but its two pockets sit within 40mm.
    const rail = board({ width: 8, depth: 1 }, [
      cutout({ id: 'a', x: 10, y: 5 }),
      cutout({ id: 'b', x: 30, y: 5 }),
    ]);
    const bed = { width: 256, depth: 256 };
    expect(planFitTestSplit(rail, bed, splitPlanes).pieceCount).toBeGreaterThan(1);
    expect(planFitTestOutlineSplit(rail, bed, splitPlanes, 1.2).pieceCount).toBe(1);
  });

  it('splits an outline wider than the bed and counts only pieces with a ring in them', () => {
    // Pockets at both ends of a 6x1 rail and nothing in the middle.
    const rail = board({ width: 6, depth: 1 }, [
      cutout({ id: 'a', x: 5, y: 5 }),
      cutout({ id: 'b', x: 230, y: 5 }),
    ]);
    const bed = { width: 100, depth: 100 };
    const card = planFitTestSplit(rail, bed, splitPlanes);
    const outline = planFitTestOutlineSplit(rail, bed, splitPlanes, 1.2);
    expect(card.pieceCount).toBeGreaterThan(2);
    expect(outline.planesX).toEqual(card.planesX);
    expect(outline.pieceCount).toBe(2);
  });

  it('moves a seam clear of the ring, not just the hole', () => {
    // A 4x1 rail splits at its centre. The left pocket ends 2.5mm short of the
    // seam: outside the card's 2mm margin, inside it once a 1.2mm ring is added.
    const params = board({ width: 4, depth: 1 });
    const innerW = 4 * params.gridUnitMm - GRIDFINITY.TOLERANCE - 2 * params.wallThickness;
    const rail: BinParams = {
      ...params,
      cutouts: [
        cutout({ id: 'a', x: innerW / 2 - 32.5, y: 5, width: 30, depth: 10 }),
        cutout({ id: 'b', x: innerW - 15, y: 5, width: 10, depth: 10 }),
      ],
    };
    const bed = { width: 100, depth: 100 };
    expect(planFitTestSplit(rail, bed, splitPlanes).planesX).toEqual([0]);
    const outline = planFitTestOutlineSplit(rail, bed, splitPlanes, 1.2);
    expect(outline.planesX).toHaveLength(1);
    expect(outline.planesX[0]).toBeCloseTo(-2.5 + 1.2 + 2, 6);
    expect(outline.blockedSeams).toBe(0);
  });
});

describe('outline reach through a breached wall', () => {
  const splitPlanes = getSplitPlanePositionsMm;
  const bed = { width: 100, depth: 100 };
  const rail = (pocket: Cutout): BinParams => board({ width: 6, depth: 1 }, [pocket]);

  it('runs an open side out to the board edge', () => {
    const closed = rail(cutout({ id: 'a', x: 5, y: 5, width: 20, depth: 20 }));
    const open = rail(
      cutout({ id: 'a', x: 5, y: 5, width: 20, depth: 20, openSides: [{ side: 'right' }] })
    );
    const boardRight = fitTestFootprintBox(open).maxX;

    expect(Math.max(...fitTestOutlineBoxes(closed, 1.2).map((b) => b.maxX))).toBeLessThan(0);
    expect(Math.max(...fitTestOutlineBoxes(open, 1.2).map((b) => b.maxX))).toBeCloseTo(
      boardRight,
      9
    );
    // The pocket alone fits the bed; the channel to the far wall does not.
    expect(planFitTestOutlineSplit(closed, bed, splitPlanes, 1.2).pieceCount).toBe(1);
    expect(planFitTestOutlineSplit(open, bed, splitPlanes, 1.2).pieceCount).toBeGreaterThan(1);
  });

  it('runs a knife slot exit out to the board edge', () => {
    const slot = cutout({
      id: 'k',
      shape: 'knifeSlot',
      x: 5,
      y: 10,
      width: 30,
      depth: 3,
      knife: { ...DEFAULT_KNIFE_SPEC, openEnd: 'end' },
    });
    const boxes = fitTestOutlineBoxes(rail(slot), 1.2);
    expect(Math.max(...boxes.map((b) => b.maxX))).toBeCloseTo(
      fitTestFootprintBox(rail(slot)).maxX,
      9
    );
    expect(planFitTestOutlineSplit(rail(slot), bed, splitPlanes, 1.2).pieceCount).toBeGreaterThan(
      1
    );
  });

  it('never reaches past the board', () => {
    const open = rail(
      cutout({ id: 'a', x: 5, y: 5, width: 20, depth: 20, openSides: [{ side: 'left' }] })
    );
    const box = fitTestFootprintBox(open);
    for (const b of fitTestOutlineBoxes(open, 2.4)) {
      expect(b.minX).toBeGreaterThanOrEqual(box.minX);
      expect(b.maxX).toBeLessThanOrEqual(box.maxX);
      expect(b.minY).toBeGreaterThanOrEqual(box.minY);
      expect(b.maxY).toBeLessThanOrEqual(box.maxY);
    }
  });
});

describe('seams across a breach', () => {
  const splitPlanes = getSplitPlanePositionsMm;
  const bed = { width: 100, depth: 100 };
  // A 4x1 rail splits at its centre on a 100mm bed. Interior x runs from the
  // left wall; the model frame is centred on the rail.
  const fourByOne = (cutouts: Cutout[]): BinParams => board({ width: 4, depth: 1 }, cutouts);
  const innerW = (params: BinParams): number =>
    4 * params.gridUnitMm - GRIDFINITY.TOLERANCE - 2 * params.wallThickness;

  it('reports a seam it cannot move off a channel running to the far wall', () => {
    // The channel runs from the left-end pocket to the right wall, so every
    // plane across the rail cuts its rails and none is within reach of clear.
    const params = fourByOne([
      cutout({
        id: 'a',
        shape: 'rectangle',
        x: 5,
        y: 10,
        width: 20,
        depth: 15,
        openSides: [{ side: 'right' }],
      }),
    ]);
    const plan = planFitTestOutlineSplit(params, bed, splitPlanes, 1.2);
    expect(plan.pieceCount).toBe(2);
    expect(plan.blockedSeams).toBe(1);
    // The card's seam crosses only the notch beside the pocket it measures.
    expect(planFitTestSplit(params, bed, splitPlanes).blockedSeams).toBe(0);
  });

  it('moves a seam to the side of the pocket the channel does not run from', () => {
    // Pocket b spans model x -12..-2 and opens right. Clear of its ring alone
    // the nearer edge is +1.2, which would cut the channel's rails; with the
    // rails counted, only the far side of the pocket is clear.
    const base = fourByOne([]);
    const half = innerW(base) / 2;
    const params = fourByOne([
      cutout({ id: 'a', shape: 'rectangle', x: 2, y: 10, width: 20, depth: 15 }),
      cutout({
        id: 'b',
        shape: 'rectangle',
        x: half - 12,
        y: 10,
        width: 10,
        depth: 15,
        openSides: [{ side: 'right' }],
      }),
    ]);
    const plan = planFitTestOutlineSplit(params, bed, splitPlanes, 1.2);
    expect(plan.blockedSeams).toBe(0);
    expect(plan.planesX).toHaveLength(1);
    expect(plan.planesX[0]).toBeCloseTo(-12 - 1.2 - FIT_TEST_SEAM_MARGIN_MM, 6);
  });
});

describe('estimateFitTestOutlineVolumeMm3', () => {
  it('prices a ring as its opening offset outward by the width', () => {
    const params = board({}, [cutout({ width: 12, depth: 12, clearance: 0.2 })]);
    const perimeter = Math.PI * 12.2;
    const expected = (perimeter * 1.2 + Math.PI * 1.2 * 1.2) * 0.6;
    expect(estimateFitTestOutlineVolumeMm3(params, { heightMm: 0.6, wallMm: 1.2 })).toBeCloseTo(
      expected,
      6
    );
  });

  it('is a sliver of the card it replaces', () => {
    const params = board({}, [cutout({ cutDepth: 4 })]);
    const outline = estimateFitTestOutlineVolumeMm3(params, { heightMm: 0.6, wallMm: 1.2 });
    expect(outline).toBeGreaterThan(0);
    expect(outline).toBeLessThan(100);
  });

  it('prices the rails a breach runs out to the board edge', () => {
    // A 4x1 rail with a 20mm pocket at its left end: open to the right, its
    // ring carries two rails from the pocket's right edge to the board's.
    const pocket = (over: Partial<Cutout>): BinParams =>
      board({ width: 4, depth: 1 }, [
        cutout({ id: 'a', shape: 'rectangle', x: 5, y: 10, width: 20, depth: 15, ...over }),
      ]);
    const size = { heightMm: 0.6, wallMm: 1.2 };
    const open = pocket({ openSides: [{ side: 'right' }] });
    const innerW = 4 * open.gridUnitMm - GRIDFINITY.TOLERANCE - 2 * open.wallThickness;
    const railLength = fitTestFootprintBox(open).maxX - (25 - innerW / 2);

    const added =
      estimateFitTestOutlineVolumeMm3(open, size) -
      estimateFitTestOutlineVolumeMm3(pocket({}), size);
    expect(added).toBeCloseTo(2 * railLength * 1.2 * 0.6, 6);
    expect(added).toBeGreaterThan(200);
  });

  it('prices a knife exit from the end of its slot, not its centre', () => {
    const slot = (openEnd: 'end' | undefined): BinParams =>
      board({ width: 4, depth: 1 }, [
        cutout({
          id: 'k',
          shape: 'knifeSlot',
          x: 5,
          y: 10,
          width: 30,
          depth: 3,
          knife: { ...DEFAULT_KNIFE_SPEC, openEnd },
        }),
      ]);
    const size = { heightMm: 0.6, wallMm: 1.2 };
    const open = slot('end');
    const innerW = 4 * open.gridUnitMm - GRIDFINITY.TOLERANCE - 2 * open.wallThickness;
    const railLength = fitTestFootprintBox(open).maxX - (35 - innerW / 2);

    const added =
      estimateFitTestOutlineVolumeMm3(open, size) -
      estimateFitTestOutlineVolumeMm3(slot(undefined), size);
    expect(added).toBeCloseTo(2 * railLength * 1.2 * 0.6, 6);
  });

  it('prices nothing for a board of text elements only', () => {
    const params = board({}, [cutout({ shape: 'text', label: 'TOOLS' })]);
    expect(estimateFitTestOutlineVolumeMm3(params, { heightMm: 0.6, wallMm: 1.2 })).toBe(0);
  });
});
