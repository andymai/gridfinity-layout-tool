import { describe, it, expect } from 'vitest';
import { mm } from '@/core/types';
import type { ScrewHoleParams } from '@/core/types/baseplate';
import {
  SCREW_MARGIN_MIN_WALL_MM,
  minBandForHead,
  planNeedsFloorPad,
  planPieceScrews,
  platePadThicknessMm,
  resolveScrewHeadDiameter,
  screwHeadRecessDepth,
  screwPadThicknessMm,
  type ScrewPieceInput,
} from './screwHolePlan';

const COUNTERSINK: ScrewHoleParams = {
  enabled: true,
  diameter: mm(3.4),
  headStyle: 'countersink',
};

const COUNTERBORE: ScrewHoleParams = {
  enabled: true,
  diameter: mm(3.4),
  headStyle: 'counterbore',
};

/** A 2x2 piece (84mm square) with no margin on any side. */
function pieceWithBands(bands: Partial<ScrewPieceInput['bands']> = {}): ScrewPieceInput {
  return {
    widthMm: 84,
    depthMm: 84,
    bands: { left: 0, right: 0, front: 0, back: 0, ...bands },
  };
}

describe('screwHeadRecessDepth', () => {
  it('derives the 90-degree countersink depth from the radial widening', () => {
    // ø8.0 over a ø3.4 shaft widens 2.3mm per side; at a 45° wall the cone is
    // exactly as deep as it is wide. This is the number that rules out a 0.8mm
    // floor as a countersink host.
    expect(screwHeadRecessDepth(COUNTERSINK)).toBeCloseTo(2.3, 6);
  });

  it('scales the cone with an explicit head diameter', () => {
    expect(screwHeadRecessDepth({ ...COUNTERSINK, headDiameter: mm(11.4) })).toBeCloseTo(4, 6);
  });

  it('never returns a negative depth when the head is narrower than the shaft', () => {
    expect(screwHeadRecessDepth({ ...COUNTERSINK, headDiameter: mm(2) })).toBe(0);
  });

  it('uses the counterbore depth verbatim', () => {
    expect(screwHeadRecessDepth(COUNTERBORE)).toBe(3);
    expect(screwHeadRecessDepth({ ...COUNTERBORE, counterboreDepth: mm(4.5) })).toBe(4.5);
  });
});

describe('resolveScrewHeadDiameter', () => {
  it('defaults per style', () => {
    expect(resolveScrewHeadDiameter('countersink')).toBe(8);
    expect(resolveScrewHeadDiameter('counterbore')).toBe(5.5);
  });

  it('honours an override', () => {
    expect(resolveScrewHeadDiameter('countersink', 6)).toBe(6);
  });
});

describe('screwPadThicknessMm', () => {
  it('charges a floorless plate the full recess plus its retaining minimum', () => {
    // 2.3mm cone + 0.8mm retain = 3.1mm of slab that did not exist before.
    expect(screwPadThicknessMm(COUNTERSINK, 0)).toBeCloseTo(3.1, 6);
  });

  it('charges only the shortfall when a solid floor already exists', () => {
    expect(screwPadThicknessMm(COUNTERSINK, 0.8)).toBeCloseTo(2.3, 6);
  });

  it('charges nothing when the existing floor already clears the requirement', () => {
    expect(screwPadThicknessMm(COUNTERSINK, 5)).toBe(0);
  });

  it('charges nothing when a magnet pocket can host the head', () => {
    // The screw is concentric with the magnet, so the ø6.5 x 2mm pocket IS the
    // recess: screw first, magnet dropped in over it.
    const pocket = { diameterMm: 6.5, depthMm: 2 };
    const shallowHead: ScrewHoleParams = { ...COUNTERSINK, headDiameter: mm(5.4) };
    expect(screwPadThicknessMm(shallowHead, 2.5, pocket)).toBe(0);
  });

  it('still charges when the head is wider than the magnet pocket', () => {
    // A ø8 countersink does not fit a ø6.5 pocket, so the magnet floor does not
    // rescue it and the plate pays the shortfall over its 2.5mm floor.
    const pocket = { diameterMm: 6.5, depthMm: 2 };
    expect(screwPadThicknessMm(COUNTERSINK, 2.5, pocket)).toBeCloseTo(0.6, 6);
  });

  it('still charges when the head is deeper than the magnet pocket', () => {
    // ø5.5 fits the pocket's width but a 3mm counterbore is deeper than its 2mm.
    const pocket = { diameterMm: 6.5, depthMm: 2 };
    expect(screwPadThicknessMm(COUNTERBORE, 2.5, pocket)).toBeCloseTo(1.3, 6);
  });
});

describe('minBandForHead', () => {
  it('adds a printable wall either side of the head', () => {
    expect(minBandForHead(8)).toBe(8 + 2 * SCREW_MARGIN_MIN_WALL_MM);
  });
});

describe('planPieceScrews', () => {
  it('sites every screw in the margin when the bands are wide enough', () => {
    const plan = planPieceScrews(
      COUNTERSINK,
      pieceWithBands({ left: 12, right: 12, front: 12, back: 12 })
    );
    expect(plan.placements).toHaveLength(4);
    expect(plan.placements.every((p) => p.site === 'margin')).toBe(true);
    expect(plan.dropped).toEqual([]);
  });

  it('falls back to the floor when no band can host the head', () => {
    const plan = planPieceScrews(COUNTERSINK, pieceWithBands());
    expect(plan.placements).toHaveLength(4);
    expect(plan.placements.every((p) => p.site === 'floor')).toBe(true);
  });

  it('treats a band one hair under the threshold as unusable', () => {
    const justUnder = minBandForHead(8) - 0.01;
    const plan = planPieceScrews(
      COUNTERSINK,
      pieceWithBands({ left: justUnder, front: justUnder })
    );
    expect(plan.placements.every((p) => p.site === 'floor')).toBe(true);
  });

  it('mixes sites when only some sides carry a usable band', () => {
    // Only the left band is wide enough, so the two left corners ride the margin
    // and the two right corners fall back to the floor.
    const plan = planPieceScrews(COUNTERSINK, pieceWithBands({ left: 12 }));
    const bySite = plan.placements.map((p) => `${p.corner}:${p.site}`);
    expect(bySite).toContain('bl:margin');
    expect(bySite).toContain('tl:margin');
    expect(bySite).toContain('br:floor');
    expect(bySite).toContain('tr:floor');
  });

  it('rides the wider of the two bands adjacent to a corner', () => {
    // Front band is wider, so the bottom-left screw should be centred across the
    // FRONT band (its Y pinned to the band centre) rather than the left one.
    const plan = planPieceScrews(COUNTERSINK, pieceWithBands({ left: 11, front: 20 }));
    const bl = plan.placements.find((p) => p.corner === 'bl');
    expect(bl?.site).toBe('margin');
    if (bl?.site !== 'margin') throw new Error('expected a margin placement');
    expect(bl.y).toBeCloseTo(-(84 / 2 - 20 / 2), 6);
  });

  it('keeps every margin hole inside the piece footprint', () => {
    const plan = planPieceScrews(
      COUNTERSINK,
      pieceWithBands({ left: 14, right: 14, front: 14, back: 14 })
    );
    for (const p of plan.placements) {
      if (p.site !== 'margin') continue;
      expect(Math.abs(p.x)).toBeLessThan(84 / 2);
      expect(Math.abs(p.y)).toBeLessThan(84 / 2);
    }
  });

  it('falls back to the floor when the margin position is blocked', () => {
    const plan = planPieceScrews(COUNTERSINK, {
      ...pieceWithBands({ left: 12, right: 12, front: 12, back: 12 }),
      isBlocked: () => true,
    });
    expect(plan.placements.every((p) => p.site === 'floor')).toBe(true);
  });

  it('drops a corner only when both the margin and the floor are unavailable', () => {
    const plan = planPieceScrews(COUNTERSINK, pieceWithBands(), () => true);
    expect(plan.placements).toEqual([]);
    expect(plan.dropped).toHaveLength(4);
  });

  it('cycles the corners when more than four screws are requested', () => {
    const plan = planPieceScrews({ ...COUNTERSINK, screwsPerPiece: 6 }, pieceWithBands());
    expect(plan.placements).toHaveLength(6);
    expect(plan.placements.map((p) => p.corner)).toEqual(['bl', 'br', 'tr', 'tl', 'bl', 'br']);
  });
});

describe('platePadThicknessMm', () => {
  const marginOnly = planPieceScrews(
    COUNTERSINK,
    pieceWithBands({ left: 12, right: 12, front: 12, back: 12 })
  );
  const floorOnly = planPieceScrews(COUNTERSINK, pieceWithBands());

  it('charges nothing when every piece found a margin', () => {
    expect(planNeedsFloorPad([marginOnly, marginOnly])).toBe(false);
    expect(platePadThicknessMm(COUNTERSINK, [marginOnly, marginOnly], 0)).toBe(0);
  });

  it('charges the whole plate when a single piece needs the floor', () => {
    // Pieces of one plate share a slab height, so an interior piece with no
    // margin makes every piece carry the pad or the assembly is stepped.
    expect(planNeedsFloorPad([marginOnly, floorOnly])).toBe(true);
    expect(platePadThicknessMm(COUNTERSINK, [marginOnly, floorOnly], 0)).toBeCloseTo(3.1, 6);
  });
});
