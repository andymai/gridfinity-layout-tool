// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { mm } from '@/core/types';
import type { ScrewHoleParams } from '@/core/types/baseplate';
import type { ScrewPiecePlan } from '@/shared/generation/screwHolePlan';
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

const COUNTERSINK: ScrewHoleParams = {
  enabled: true,
  diameter: mm(3.4),
  headStyle: 'countersink',
};

const COUNTERBORE: ScrewHoleParams = { ...COUNTERSINK, headStyle: 'counterbore' };

function plan(
  slots: Array<{
    anchor: 'bl' | 'br' | 'tr' | 'tl';
    site: 'margin' | 'floor';
    target: [number, number];
  }>
): ScrewPiecePlan {
  return { slots, dropped: [] };
}

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
      plan([{ anchor: 'bl', site: 'margin', target: [-40, -40] }]),
      candidates
    );
    expect(holes).toEqual([{ x: -40, y: -40, site: 'margin' }]);
  });

  it('snaps a floor slot to the nearest magnet position', () => {
    const holes = resolveScrewHoles(
      plan([{ anchor: 'bl', site: 'floor', target: [-42, -42] }]),
      candidates
    );
    expect(holes).toEqual([{ x: -13, y: -13, site: 'floor' }]);
  });

  it('snaps each corner to its own magnet', () => {
    const holes = resolveScrewHoles(
      plan([
        { anchor: 'bl', site: 'floor', target: [-42, -42] },
        { anchor: 'br', site: 'floor', target: [42, -42] },
        { anchor: 'tr', site: 'floor', target: [42, 42] },
        { anchor: 'tl', site: 'floor', target: [-42, 42] },
      ]),
      candidates
    );
    expect(holes.map((h) => `${h.x},${h.y}`)).toEqual(['-13,-13', '13,-13', '13,13', '-13,13']);
  });

  it('never stacks two holes on one magnet position', () => {
    // On a piece offering a single candidate, every anchor would otherwise snap
    // to the same point and cut coincident holes there.
    const holes = resolveScrewHoles(
      plan([
        { anchor: 'bl', site: 'floor', target: [-42, -42] },
        { anchor: 'br', site: 'floor', target: [42, -42] },
      ]),
      [[0, 0]]
    );
    expect(holes).toHaveLength(1);
    expect(holes[0]).toEqual({ x: 0, y: 0, site: 'floor' });
  });

  it('drops floor slots once candidates run out, keeping margin slots', () => {
    const holes = resolveScrewHoles(
      plan([
        { anchor: 'bl', site: 'floor', target: [-42, -42] },
        { anchor: 'br', site: 'margin', target: [40, -40] },
      ]),
      []
    );
    expect(holes).toEqual([{ x: 40, y: -40, site: 'margin' }]);
  });

  it('returns nothing for an empty plan', () => {
    expect(resolveScrewHoles(plan([]), candidates)).toEqual([]);
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
