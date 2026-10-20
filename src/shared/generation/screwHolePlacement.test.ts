import { describe, it, expect } from 'vitest';
import { mm } from '@/core/types';
import type { ScrewHoleParams } from '@/core/types/baseplate';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { HOLE_OFFSET } from './generatorConstants';
import {
  pieceScrewsNeedFloor,
  planBaseplateScrewHoles,
  resolveScrewHoles,
  screwAwareHoleRadius,
  screwFloorCandidates,
  screwPlacementFor,
} from './screwHolePlacement';
import { planPieceScrews } from './screwHolePlan';

const COUNTERSINK: ScrewHoleParams = {
  enabled: true,
  diameter: mm(3.4),
  headStyle: 'countersink',
};

const COUNTERBORE: ScrewHoleParams = { ...COUNTERSINK, headStyle: 'counterbore' };

describe('screwFloorCandidates', () => {
  const cellOpts = { gridUnitMm: 42, fractionalEdgeX: 'end', fractionalEdgeY: 'end' } as const;

  it('offers the four magnet positions of a full cell', () => {
    const found = screwFloorCandidates(1, 1, 4, { ...cellOpts });
    expect(found).toHaveLength(4);
    const keys = new Set(found.map(([x, y]) => `${x},${y}`));
    expect(keys).toEqual(
      new Set([
        `${-HOLE_OFFSET},${-HOLE_OFFSET}`,
        `${HOLE_OFFSET},${-HOLE_OFFSET}`,
        `${HOLE_OFFSET},${HOLE_OFFSET}`,
        `${-HOLE_OFFSET},${HOLE_OFFSET}`,
      ])
    );
  });

  it('scales with the grid', () => {
    expect(screwFloorCandidates(2, 3, 4, { ...cellOpts })).toHaveLength(24);
  });

  it('offers the half cell the pads it can hold (#3778)', () => {
    // A 1.5x1 grid is one full cell (4 corners) plus a 21×42 half cell, which
    // holds two pads at the standard ±13 spacing on its long axis.
    expect(screwFloorCandidates(1.5, 1, 4, { ...cellOpts })).toHaveLength(6);
  });

  it('skips a half cell too small for a pad, snapping a corner inward instead', () => {
    // At pitch 25 the half cell is 12.5mm — under the taper it cannot hold a
    // ø8 head, so only the full cell contributes.
    const opts = { ...cellOpts, gridUnitMm: 25 };
    expect(screwFloorCandidates(1.5, 1, 4, opts)).toHaveLength(
      screwFloorCandidates(1, 1, 4, opts).length
    );
  });

  it('honours a cell filter', () => {
    const found = screwFloorCandidates(2, 1, 4, { ...cellOpts }, (cell) => cell.centerX < 0);
    expect(found).toHaveLength(4);
    expect(found.every(([x]) => x < 0)).toBe(true);
  });
});

describe('resolveScrewHoles', () => {
  const candidates: Array<readonly [number, number]> = [
    [-13, -13],
    [13, -13],
    [13, 13],
    [-13, 13],
  ];

  it('passes a margin slot through at its exact centre', () => {
    const holes = resolveScrewHoles(
      [{ anchor: 'bl', site: 'margin', target: [-40, -40] }],
      candidates
    );
    expect(holes).toEqual([{ x: -40, y: -40, site: 'margin' }]);
  });

  it('snaps a floor slot to the nearest magnet position', () => {
    const holes = resolveScrewHoles(
      [{ anchor: 'bl', site: 'floor', target: [-42, -42] }],
      candidates
    );
    expect(holes).toEqual([{ x: -13, y: -13, site: 'floor' }]);
  });

  it('snaps each corner to its own magnet', () => {
    const holes = resolveScrewHoles(
      [
        { anchor: 'bl', site: 'floor', target: [-42, -42] },
        { anchor: 'br', site: 'floor', target: [42, -42] },
        { anchor: 'tr', site: 'floor', target: [42, 42] },
        { anchor: 'tl', site: 'floor', target: [-42, 42] },
      ],
      candidates
    );
    expect(holes.map((h) => `${h.x},${h.y}`)).toEqual(['-13,-13', '13,-13', '13,13', '-13,13']);
  });

  it('never stacks two holes on one magnet position', () => {
    // On a piece offering a single candidate, every anchor would otherwise snap
    // to the same point and cut coincident holes there.
    const holes = resolveScrewHoles(
      [
        { anchor: 'bl', site: 'floor', target: [-42, -42] },
        { anchor: 'br', site: 'floor', target: [42, -42] },
      ],
      [[0, 0]]
    );
    expect(holes).toHaveLength(1);
    expect(holes[0]).toEqual({ x: 0, y: 0, site: 'floor' });
  });

  it('drops floor slots once candidates run out, keeping margin slots', () => {
    const holes = resolveScrewHoles(
      [
        { anchor: 'bl', site: 'floor', target: [-42, -42] },
        { anchor: 'br', site: 'margin', target: [40, -40] },
      ],
      []
    );
    expect(holes).toEqual([{ x: 40, y: -40, site: 'margin' }]);
  });

  it('returns nothing for an empty plan', () => {
    expect(resolveScrewHoles([], candidates)).toEqual([]);
  });

  it('passes a junction slot through at the junction, with its head seat', () => {
    const holes = resolveScrewHoles(
      [{ anchor: 'bl', site: 'junction', target: [-21, -21], seatBelowTopMm: 1.25 }],
      candidates
    );
    expect(holes).toEqual([{ x: -21, y: -21, site: 'junction', seatBelowTopMm: 1.25 }]);
  });
});

describe('planBaseplateScrewHoles through screwPlacementFor', () => {
  const M3_FLAT: ScrewHoleParams = { ...COUNTERSINK, headDiameter: mm(6) };

  const plate = (overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams => ({
    width: 5,
    depth: 5,
    gridUnitMm: 42,
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    screwHoles: M3_FLAT,
    ...overrides,
  });

  const holesOf = (params: ResolvedBaseplateParams) => {
    const screws = params.screwHoles ?? M3_FLAT;
    return planBaseplateScrewHoles(screws, params, screwPlacementFor(screws, params));
  };

  it('screws a stock 5x5 down at the crossing one cell in from each corner', () => {
    const holes = holesOf(plate());
    expect(holes.map((h) => `${h.site}:${h.x},${h.y}`)).toEqual([
      'junction:-63,-63',
      'junction:63,63',
      'junction:63,-63',
      'junction:-63,63',
    ]);
  });

  it('sends an M4 flat head to the floor, where the stock post cannot hold it', () => {
    const holes = holesOf(plate({ screwHoles: COUNTERSINK }));
    expect(holes.every((h) => h.site === 'floor')).toBe(true);
  });

  it('sites screws from the plate WITHOUT its pad, so the pad cannot decide its own need', () => {
    // A 3.1mm pad would let an M4 head seat in the post. Honouring that would
    // make the junction site a consequence of the pad it was meant to avoid.
    const holes = holesOf(plate({ screwHoles: COUNTERSINK, screwPadThicknessMm: 3.1 }));
    expect(holes.every((h) => h.site === 'floor')).toBe(true);
  });

  it('gives a 1xN piece floor screws: it has no crossing', () => {
    expect(holesOf(plate({ width: 1 })).every((h) => h.site === 'floor')).toBe(true);
  });
});

describe('pieceScrewsNeedFloor', () => {
  const base: ResolvedBaseplateParams = {
    width: 5,
    depth: 5,
    gridUnitMm: 42,
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
  };
  const M3_FLAT: ScrewHoleParams = { ...COUNTERSINK, headDiameter: mm(6) };

  it('is false when every screw finds a junction', () => {
    expect(pieceScrewsNeedFloor({ ...base, screwHoles: M3_FLAT })).toBe(false);
  });

  it('is false when every screw rides the margin', () => {
    const padded = { paddingLeft: 14, paddingRight: 14, paddingFront: 14, paddingBack: 14 };
    expect(pieceScrewsNeedFloor({ ...base, ...padded, screwHoles: COUNTERSINK })).toBe(false);
  });

  it('is true for a piece with neither', () => {
    expect(pieceScrewsNeedFloor({ ...base, width: 1, screwHoles: M3_FLAT })).toBe(true);
  });

  it('is true when the head is too wide for the posts', () => {
    expect(pieceScrewsNeedFloor({ ...base, screwHoles: COUNTERSINK })).toBe(true);
  });

  it('is false with screws off', () => {
    expect(pieceScrewsNeedFloor({ ...base, screwHoles: { ...M3_FLAT, enabled: false } })).toBe(
      false
    );
  });
});

describe('resolveScrewHoles half-turn symmetry (#3698)', () => {
  const NO_BANDS = { left: 0, right: 0, front: 0, back: 0 } as const;
  const CELL_OPTS = { gridUnitMm: 42, fractionalEdgeX: 'end', fractionalEdgeY: 'end' } as const;

  /**
   * The composition `planBaseplateScrewHoles` performs, minus the resolved-param
   * plumbing: an unpadded piece, so every anchor is floor-sited and every screw
   * goes through the snap this fix governs.
   */
  function holesFor(gridW: number, gridD: number, screwsPerPiece: number) {
    const params: ScrewHoleParams = { ...COUNTERSINK, screwsPerPiece };
    return resolveScrewHoles(
      planPieceScrews(params, {
        widthMm: gridW * 42,
        depthMm: gridD * 42,
        bands: NO_BANDS,
        floorPadProvisioned: true,
      }),
      screwFloorCandidates(gridW, gridD, screwAwareHoleRadius(6.5 / 2, params), { ...CELL_OPTS })
    );
  }

  /** Every hole's half-turn image is also a hole. */
  function isHalfTurnInvariant(holes: ReadonlyArray<{ x: number; y: number }>): boolean {
    const key = (x: number, y: number) => `${x.toFixed(4)},${y.toFixed(4)}`;
    const present = new Set(holes.map((h) => key(h.x, h.y)));
    return holes.every((h) => present.has(key(-h.x, -h.y)));
  }

  it('places the eight screws of an even-celled piece symmetrically', () => {
    // The reported case: a 12x12 plate split into four 6x6 pieces, eight screws
    // each. Every edge midpoint falls on a grid line, so all four are exact ties.
    const holes = holesFor(6, 6, 8);
    expect(holes).toHaveLength(8);
    expect(isHalfTurnInvariant(holes)).toBe(true);
  });

  it('leans the front and back edge screws to opposite sides of the centreline', () => {
    // The defect itself: both used to take the same cell, putting every edge
    // screw 8mm toward the same corner and leaving the set with no symmetry.
    const holes = holesFor(6, 6, 8);
    const halfD = (6 * 42) / 2;
    // The edge midpoints are the only screws near the vertical centreline; the
    // corners on the same rows sit a whole cell out.
    const nearCentre = holes.filter((h) => Math.abs(h.x) < 21);
    const front = nearCentre.find((h) => h.y < 0);
    const back = nearCentre.find((h) => h.y > 0);
    expect(front?.y).toBeCloseTo(-halfD + (21 - HOLE_OFFSET), 6);
    expect(front?.x).toBeCloseTo(-(21 - HOLE_OFFSET), 6);
    expect(back?.x).toBeCloseTo(21 - HOLE_OFFSET, 6);
  });

  it('holds on an odd-celled piece, where the tie is between cell centres', () => {
    const holes = holesFor(5, 5, 8);
    expect(holes).toHaveLength(8);
    expect(isHalfTurnInvariant(holes)).toBe(true);
  });

  it('holds on a non-square piece', () => {
    const holes = holesFor(6, 4, 8);
    expect(holes).toHaveLength(8);
    expect(isHalfTurnInvariant(holes)).toBe(true);
  });

  it('closes under the rotation at four and six screws', () => {
    // Counts that fill whole half-turn pairs. Six is why the edge anchors are
    // ordered b/t before r/l: the compass order would take b and r, whose
    // partners are never filled.
    expect(isHalfTurnInvariant(holesFor(6, 6, 4))).toBe(true);
    expect(isHalfTurnInvariant(holesFor(6, 6, 6))).toBe(true);
  });

  it('still resolves nearest first, so a lean never beats a closer candidate', () => {
    // Candidate order puts the tie-preferred but distant point first.
    const holes = resolveScrewHoles(
      [{ anchor: 'b', site: 'floor', target: [0, -42] }],
      [
        [-40, -13],
        [-13, -29],
      ]
    );
    expect(holes).toEqual([{ x: -13, y: -29, site: 'floor' }]);
  });
});

describe('screwAwareHoleRadius', () => {
  it('widens to the head when the countersink is wider than the magnet', () => {
    // The lightweight cutter sizes its kept pad from this radius; passing the
    // bare magnet radius would let the ø8 cone breach the pad into the cutout.
    expect(screwAwareHoleRadius(6.5 / 2, COUNTERSINK)).toBe(4);
  });

  it('keeps the magnet radius when the head is narrower', () => {
    expect(screwAwareHoleRadius(6.5 / 2, COUNTERBORE)).toBe(6.5 / 2);
  });

  it('ignores screws that are absent or disabled', () => {
    expect(screwAwareHoleRadius(3.25, undefined)).toBe(3.25);
    expect(screwAwareHoleRadius(3.25, { ...COUNTERSINK, enabled: false })).toBe(3.25);
  });
});
