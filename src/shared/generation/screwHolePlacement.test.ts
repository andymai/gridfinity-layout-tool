import { describe, it, expect } from 'vitest';
import { mm } from '@/core/types';
import type { ScrewHoleParams } from '@/core/types/baseplate';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { HOLE_OFFSET } from './generatorConstants';
import {
  pieceScrewsNeedPad,
  planBaseplateScrewHoles,
  resolveScrewHoles,
  screwAwareHoleRadius,
  screwFloorCandidates,
  screwInsetCellFilter,
  screwPlacementFor,
  type ScrewFloorCandidate,
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

  it('carries the centre of the cell each position sits in', () => {
    const found = screwFloorCandidates(2, 1, 4, { ...cellOpts });
    expect(found.every(([x, , cx]) => Math.abs(x - cx) === HOLE_OFFSET)).toBe(true);
    expect(new Set(found.map(([, , cx, cy]) => `${cx},${cy}`))).toEqual(new Set(['-21,0', '21,0']));
  });
});

describe('screwInsetCellFilter', () => {
  const cellOpts = { gridUnitMm: 42, fractionalEdgeX: 'end', fractionalEdgeY: 'end' } as const;
  const pitch = { x: 42, y: 42 };

  it('is absent without an inset', () => {
    expect(screwInsetCellFilter(0, 5, 5, pitch)).toBeUndefined();
  });

  it('keeps only the cells clear of the outer rings', () => {
    const filter = screwInsetCellFilter(1, 5, 5, pitch);
    const centres = new Set(
      screwFloorCandidates(5, 5, 4, { ...cellOpts }, filter).map(([, , cx, cy]) => `${cx},${cy}`)
    );
    expect(centres.size).toBe(9);
    expect([...centres].every((c) => c.split(',').every((v) => Math.abs(Number(v)) <= 42))).toBe(
      true
    );
    expect(
      screwFloorCandidates(5, 5, 4, { ...cellOpts }, screwInsetCellFilter(2, 5, 5, pitch))
    ).toHaveLength(4);
  });

  it('measures the inset in grid units, so a half cell at the edge counts toward it', () => {
    // 2.5 wide: a half cell at the end, then two full cells. One unit of inset
    // removes the half cell and the full cell at the start.
    const filter = screwInsetCellFilter(1, 2.5, 3, pitch);
    expect(screwFloorCandidates(2.5, 3, 4, { ...cellOpts }, filter)).toHaveLength(0);
  });
});

describe('resolveScrewHoles', () => {
  const candidates: ScrewFloorCandidate[] = [
    [-13, -13, 0, 0],
    [13, -13, 0, 0],
    [13, 13, 0, 0],
    [-13, 13, 0, 0],
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
      [[0, 0, 0, 0]]
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

  it('takes the opposite corner of the same cell for an inner snap (#4764)', () => {
    const holes = resolveScrewHoles(
      [
        { anchor: 'bl', site: 'floor', target: [-42, -42] },
        { anchor: 'tr', site: 'floor', target: [42, 42] },
        { anchor: 'br', site: 'floor', target: [42, -42] },
        { anchor: 'tl', site: 'floor', target: [-42, 42] },
      ],
      candidates,
      'inner'
    );
    expect(holes.map((h) => `${h.x},${h.y}`)).toEqual(['13,13', '-13,-13', '-13,13', '13,-13']);
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

  const seatsOf = (params: ResolvedBaseplateParams): Array<number | undefined> =>
    holesOf(params).map((h) => h.seatBelowTopMm);

  it('seats the heads 0.35mm lower over a pad, where through-cut pockets drop the feet onto the tapers', () => {
    const stock = seatsOf(plate());
    const overPad = seatsOf(plate({ screwPadThicknessMm: 2.1 }));
    expect(overPad).toHaveLength(4);
    overPad.forEach((seat, i) => expect(seat).toBeCloseTo((stock[i] ?? NaN) + 0.35, 3));
  });

  it('keeps the seat over a pad when every pocket has a floor to land on', () => {
    const magnets = { magnetHoles: true };
    expect(seatsOf(plate({ ...magnets, screwPadThicknessMm: 2.1 }))).toEqual(
      seatsOf(plate(magnets))
    );
  });

  describe('edge inset and cell corner (#4764)', () => {
    const at = (params: ResolvedBaseplateParams): string[] =>
      holesOf(params).map((h) => `${h.site}:${h.x},${h.y}`);

    it('moves junction screws off the crossings that touch the outer ring', () => {
      expect(at(plate({ screwHoles: { ...M3_FLAT, edgeInsetCells: 1 } }))).toEqual([
        'junction:-21,-21',
        'junction:21,21',
        'junction:21,-21',
        'junction:-21,21',
      ]);
    });

    it('snaps a floor screw to the outer corner of the first cell inside the inset', () => {
      // Without the inset the screw sits in the outer corner of the corner cell,
      // 8mm from the plate edge, where a drawer lip covers it.
      expect(at(plate({ screwHoles: COUNTERSINK }))[0]).toBe('floor:-97,-97');
      expect(at(plate({ screwHoles: { ...COUNTERSINK, edgeInsetCells: 1 } }))[0]).toBe(
        'floor:-55,-55'
      );
    });

    it('snaps a floor screw to the inner corner of its cell', () => {
      expect(at(plate({ screwHoles: { ...COUNTERSINK, cellCorner: 'inner' } }))[0]).toBe(
        'floor:-71,-71'
      );
      expect(
        at(plate({ screwHoles: { ...COUNTERSINK, edgeInsetCells: 1, cellCorner: 'inner' } }))[0]
      ).toBe('floor:-29,-29');
    });

    it('keeps screws out of the padding, which sits under the lip', () => {
      const padded = { paddingLeft: 14, paddingRight: 14, paddingFront: 14, paddingBack: 14 };
      expect(
        holesOf(plate({ ...padded, screwHoles: COUNTERSINK })).every((h) => h.site === 'margin')
      ).toBe(true);
      const inset = holesOf(
        plate({ ...padded, screwHoles: { ...COUNTERSINK, edgeInsetCells: 1 } })
      );
      expect(inset).toHaveLength(4);
      expect(inset.some((h) => h.site === 'margin')).toBe(false);
    });

    it('gives no screws, and so no pad, to a piece too small for the inset', () => {
      const params = plate({ width: 2, screwHoles: { ...COUNTERSINK, edgeInsetCells: 1 } });
      expect(holesOf(params)).toEqual([]);
      expect(pieceScrewsNeedPad(params)).toBe(false);
    });

    it('needs the pad once the inset sends a margin screw to the floor', () => {
      const padded = { paddingLeft: 14, paddingRight: 14, paddingFront: 14, paddingBack: 14 };
      expect(pieceScrewsNeedPad(plate({ ...padded, screwHoles: COUNTERSINK }))).toBe(false);
      expect(
        pieceScrewsNeedPad(plate({ ...padded, screwHoles: { ...COUNTERSINK, edgeInsetCells: 1 } }))
      ).toBe(true);
    });
  });
});

describe('pieceScrewsNeedPad', () => {
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

  const padded = { paddingLeft: 14, paddingRight: 14, paddingFront: 14, paddingBack: 14 };

  it('is false when every screw finds a junction', () => {
    expect(pieceScrewsNeedPad({ ...base, screwHoles: M3_FLAT })).toBe(false);
  });

  it('is false when every screw rides the margin and the plate retains its recess', () => {
    expect(pieceScrewsNeedPad({ ...base, ...padded, screwHoles: COUNTERSINK })).toBe(false);
  });

  it('is true for a margin screw recessed deeper than the plate can retain', () => {
    // The margin takes a 6mm counterbore by width, but a 4.65mm frame would be
    // cut head-wide right through with no shoulder for the head.
    const deep: ScrewHoleParams = { ...COUNTERBORE, counterboreDepth: mm(6) };
    const params = { ...base, ...padded, screwHoles: deep };
    const holes = planBaseplateScrewHoles(deep, params, screwPlacementFor(deep, params));
    expect(holes.every((h) => h.site === 'margin')).toBe(true);
    expect(pieceScrewsNeedPad(params)).toBe(true);
  });

  it('is false for that margin screw once a solid floor retains it', () => {
    const deep: ScrewHoleParams = { ...COUNTERBORE, counterboreDepth: mm(6) };
    expect(
      pieceScrewsNeedPad({
        ...base,
        ...padded,
        solidFloor: true,
        solidFloorThickness: 3,
        screwHoles: deep,
      })
    ).toBe(false);
  });

  it('is true for a piece with neither', () => {
    expect(pieceScrewsNeedPad({ ...base, width: 1, screwHoles: M3_FLAT })).toBe(true);
  });

  it('is true when the head is too wide for the posts', () => {
    expect(pieceScrewsNeedPad({ ...base, screwHoles: COUNTERSINK })).toBe(true);
  });

  it('is false with screws off', () => {
    expect(pieceScrewsNeedPad({ ...base, screwHoles: { ...M3_FLAT, enabled: false } })).toBe(false);
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
  function holesFor(
    gridW: number,
    gridD: number,
    screwsPerPiece: number,
    placement: Pick<ScrewHoleParams, 'edgeInsetCells' | 'cellCorner'> = {}
  ) {
    const params: ScrewHoleParams = { ...COUNTERSINK, screwsPerPiece, ...placement };
    return resolveScrewHoles(
      planPieceScrews(params, {
        widthMm: gridW * 42,
        depthMm: gridD * 42,
        bands: NO_BANDS,
        floorPadProvisioned: true,
      }),
      screwFloorCandidates(
        gridW,
        gridD,
        screwAwareHoleRadius(6.5 / 2, params),
        { ...CELL_OPTS },
        screwInsetCellFilter(params.edgeInsetCells ?? 0, gridW, gridD, { x: 42, y: 42 })
      ),
      params.cellCorner
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

  it('holds with an edge inset and an inner corner (#4764)', () => {
    for (const placement of [
      { edgeInsetCells: 1 },
      { cellCorner: 'inner' as const },
      { edgeInsetCells: 1, cellCorner: 'inner' as const },
    ]) {
      for (const [w, d] of [
        [6, 6],
        [5, 5],
        [7, 4],
      ]) {
        const holes = holesFor(w, d, 8, placement);
        expect(holes).toHaveLength(8);
        expect(isHalfTurnInvariant(holes)).toBe(true);
      }
    }
  });

  it('still resolves nearest first, so a lean never beats a closer candidate', () => {
    // Candidate order puts the tie-preferred but distant point first.
    const holes = resolveScrewHoles(
      [{ anchor: 'b', site: 'floor', target: [0, -42] }],
      [
        [-40, -13, -21, -21],
        [-13, -29, -21, -21],
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
