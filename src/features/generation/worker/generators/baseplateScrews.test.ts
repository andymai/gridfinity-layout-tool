// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { mm } from '@/core/types';
import type { ScrewHoleParams } from '@/core/types/baseplate';
import { mesh } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { initTestKernel } from '@/test/initTestKernel';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import { HOLE_OFFSET, SOCKET_HEIGHT } from './generatorTypes';
import {
  buildScrewCutters,
  resolveScrewHoles,
  screwAwareHoleRadius,
  screwFloorCandidates,
} from './baseplateScrews';
import { planPieceScrews } from '@/shared/generation/screwHolePlan';

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

  it('skips fractional cells, which carry no magnets to sit on', () => {
    // A 1.5x1 grid has one full cell and one half cell; only the full one
    // contributes, so a fractional corner snaps inward to a real position.
    expect(screwFloorCandidates(1.5, 1, 4, { ...cellOpts })).toHaveLength(4);
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

describe('buildScrewCutters', () => {
  beforeAll(async () => {
    await initTestKernel();
  });

  const totalHeight = SOCKET_HEIGHT + 3.1;

  /** Tessellate a cutter so its extents can be measured. */
  function bbox(shape: Shape3D) {
    return boundingBox(mesh(shape, { tolerance: 0.01, angularTolerance: 5 }).vertices);
  }

  it('builds nothing for no holes', () => {
    expect(buildScrewCutters([], COUNTERSINK, totalHeight)).toEqual([]);
  });

  it('builds one solid per hole', () => {
    const cutters = buildScrewCutters(
      [
        { x: -13, y: -13, site: 'floor' },
        { x: 13, y: 13, site: 'floor' },
      ],
      COUNTERSINK,
      totalHeight
    );
    try {
      expect(cutters).toHaveLength(2);
      for (const c of cutters) expect(c).toBeDefined();
    } finally {
      for (const c of cutters) c.delete();
    }
  });

  it('reaches the underside from a margin entry', () => {
    // A margin screw enters at the top face and must run clear through, or it
    // fastens nothing.
    const [cutter] = buildScrewCutters([{ x: 0, y: 0, site: 'margin' }], COUNTERSINK, totalHeight);
    try {
      const bb = bbox(cutter);
      expect(bb.minZ).toBeLessThanOrEqual(-totalHeight);
      expect(bb.maxZ).toBeGreaterThan(0);
    } finally {
      cutter.delete();
    }
  });

  it('enters a floor hole at the pocket floor, not the top face', () => {
    // The head recess belongs at the pocket floor; starting it at the top would
    // carve a cone through the middle of the socket a bin seats in.
    const [cutter] = buildScrewCutters([{ x: 0, y: 0, site: 'floor' }], COUNTERSINK, totalHeight);
    try {
      const bb = bbox(cutter);
      expect(bb.maxZ).toBeLessThan(0);
      expect(bb.maxZ).toBeGreaterThan(-SOCKET_HEIGHT);
      expect(bb.minZ).toBeLessThanOrEqual(-totalHeight);
    } finally {
      cutter.delete();
    }
  });

  it('makes the countersink as wide as the head at its entry plane', () => {
    const [cutter] = buildScrewCutters([{ x: 0, y: 0, site: 'floor' }], COUNTERSINK, totalHeight);
    try {
      const bb = bbox(cutter);
      expect(bb.maxX - bb.minX).toBeCloseTo(8, 1);
    } finally {
      cutter.delete();
    }
  });

  it('survives a head no wider than the shaft', () => {
    // Reachable from the UI: the shaft slider tops out at 8mm and the
    // countersink head defaults to 8mm, so the cone collapses to zero depth and
    // a loft between two coincident sections would throw.
    const flat: ScrewHoleParams = { ...COUNTERSINK, diameter: mm(8) };
    const cutters = buildScrewCutters([{ x: 0, y: 0, site: 'floor' }], flat, totalHeight);
    try {
      expect(cutters).toHaveLength(1);
      const bb = bbox(cutters[0]);
      expect(bb.maxX - bb.minX).toBeCloseTo(8, 1);
      expect(bb.minZ).toBeLessThanOrEqual(-totalHeight);
    } finally {
      for (const c of cutters) c.delete();
    }
  });

  it('survives a head narrower than the shaft', () => {
    const inverted: ScrewHoleParams = { ...COUNTERSINK, diameter: mm(6), headDiameter: mm(4) };
    const cutters = buildScrewCutters([{ x: 0, y: 0, site: 'floor' }], inverted, totalHeight);
    try {
      expect(cutters).toHaveLength(1);
      const bb = bbox(cutters[0]);
      expect(bb.maxX - bb.minX).toBeCloseTo(6, 1);
    } finally {
      for (const c of cutters) c.delete();
    }
  });

  it('makes a counterbore a flat pocket of the head diameter', () => {
    const [cutter] = buildScrewCutters([{ x: 0, y: 0, site: 'floor' }], COUNTERBORE, totalHeight);
    try {
      const bb = bbox(cutter);
      expect(bb.maxX - bb.minX).toBeCloseTo(5.5, 1);
    } finally {
      cutter.delete();
    }
  });
});
