import { describe, it, expect } from 'vitest';
import { mm } from '@/core/types';
import type { ScrewHoleParams } from '@/core/types/baseplate';
import {
  SCREW_ANCHORS,
  SCREW_MARGIN_MIN_WALL_MM,
  discFitsRoundedRect,
  effectiveMarginBands,
  minBandForHead,
  pieceNeedsFloorPad,
  planPieceScrews,
  plateNeedsFloorPad,
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

/** A 2x2 piece (84mm square), bandless unless overridden. */
function piece(
  overrides: Omit<Partial<ScrewPieceInput>, 'bands'> & {
    bands?: Partial<ScrewPieceInput['bands']>;
  } = {}
): ScrewPieceInput {
  const { bands, ...rest } = overrides;
  return {
    widthMm: 84,
    depthMm: 84,
    bands: { left: 0, right: 0, front: 0, back: 0, ...bands },
    ...rest,
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
    expect(screwPadThicknessMm({ ...COUNTERSINK, headDiameter: mm(5.4) }, 2.5, pocket)).toBe(0);
  });

  it('still charges when the head is wider than the magnet pocket', () => {
    const pocket = { diameterMm: 6.5, depthMm: 2 };
    expect(screwPadThicknessMm(COUNTERSINK, 2.5, pocket)).toBeCloseTo(0.6, 6);
  });

  it('still charges when the head is deeper than the magnet pocket', () => {
    const pocket = { diameterMm: 6.5, depthMm: 2 };
    expect(screwPadThicknessMm(COUNTERBORE, 2.5, pocket)).toBeCloseTo(1.3, 6);
  });
});

describe('effectiveMarginBands', () => {
  const padded = {
    paddingLeft: 12,
    paddingRight: 12,
    paddingFront: 12,
    paddingBack: 12,
  };

  it('passes padding through as bands', () => {
    expect(effectiveMarginBands(padded)).toEqual({ left: 12, right: 12, front: 12, back: 12 });
  });

  it('reads every band as zero under over-tile', () => {
    // Padding survives in resolved params under over-tile, but the material is
    // functional grid rather than the solid ring a screw needs.
    expect(effectiveMarginBands({ ...padded, overTile: true })).toEqual({
      left: 0,
      right: 0,
      front: 0,
      back: 0,
    });
  });
});

describe('discFitsRoundedRect', () => {
  it('accepts a disc well inside a square profile', () => {
    expect(discFitsRoundedRect(0, 0, 42, 42, 0, 4)).toBe(true);
  });

  it('rejects a disc crossing a straight edge', () => {
    expect(discFitsRoundedRect(40, 0, 42, 42, 0, 4)).toBe(false);
  });

  it('rejects a disc that a large corner radius has cut away', () => {
    // The point sits inside the bounding box but outside the corner arc.
    expect(discFitsRoundedRect(38, 38, 42, 42, 20, 4)).toBe(false);
  });

  it('accepts the same point once the radius is small', () => {
    expect(discFitsRoundedRect(38, 38, 42, 42, 2, 2)).toBe(true);
  });

  it('rejects everything when the piece is smaller than the head', () => {
    expect(discFitsRoundedRect(0, 0, 3, 3, 0, 4)).toBe(false);
  });
});

describe('minBandForHead', () => {
  it('adds a printable wall either side of the head', () => {
    expect(minBandForHead(8)).toBe(8 + 2 * SCREW_MARGIN_MIN_WALL_MM);
  });
});

describe('planPieceScrews', () => {
  it('sites four corner screws in the margin when the bands are wide enough', () => {
    const plan = planPieceScrews(
      COUNTERSINK,
      piece({ bands: { left: 12, right: 12, front: 12, back: 12 } })
    );
    expect(plan.slots).toHaveLength(4);
    expect(plan.slots.every((s) => s.site === 'margin')).toBe(true);
    expect(plan.slots.map((s) => s.anchor)).toEqual(['bl', 'br', 'tr', 'tl']);
  });

  it('falls back to the floor when no band can host the head', () => {
    const plan = planPieceScrews(COUNTERSINK, piece());
    expect(plan.slots).toHaveLength(4);
    expect(plan.slots.every((s) => s.site === 'floor')).toBe(true);
  });

  it('targets the piece corners for floor slots, so the snap is unambiguous', () => {
    const plan = planPieceScrews(COUNTERSINK, piece());
    const bl = plan.slots.find((s) => s.anchor === 'bl');
    expect(bl?.target).toEqual([-42, -42]);
  });

  it('treats a band one hair under the threshold as unusable', () => {
    const justUnder = minBandForHead(8) - 0.01;
    const plan = planPieceScrews(
      COUNTERSINK,
      piece({ bands: { left: justUnder, right: 0, front: justUnder, back: 0 } })
    );
    expect(plan.slots.every((s) => s.site === 'floor')).toBe(true);
  });

  it('mixes sites when only some sides carry a usable band', () => {
    const plan = planPieceScrews(COUNTERSINK, piece({ bands: { left: 12 } }));
    const bySite = plan.slots.map((s) => `${s.anchor}:${s.site}`);
    expect(bySite).toContain('bl:margin');
    expect(bySite).toContain('tl:margin');
    expect(bySite).toContain('br:floor');
    expect(bySite).toContain('tr:floor');
  });

  it('rides the wider of the two bands adjacent to a corner', () => {
    const plan = planPieceScrews(
      COUNTERSINK,
      piece({ bands: { left: 11, right: 0, front: 20, back: 0 } })
    );
    const bl = plan.slots.find((s) => s.anchor === 'bl');
    expect(bl?.site).toBe('margin');
    expect(bl?.target[1]).toBeCloseTo(-(84 / 2 - 20 / 2), 6);
  });

  it('never emits two slots on the same anchor', () => {
    // Regression: cycling the corner list for counts above four put two
    // coincident holes on the same spot.
    const plan = planPieceScrews({ ...COUNTERSINK, screwsPerPiece: 8 }, piece());
    const anchors = plan.slots.map((s) => s.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it('extends to edge midpoints for counts above four', () => {
    const plan = planPieceScrews({ ...COUNTERSINK, screwsPerPiece: 6 }, piece());
    expect(plan.slots.map((s) => s.anchor)).toEqual(['bl', 'br', 'tr', 'tl', 'b', 'r']);
  });

  it('caps a count beyond the anchor list rather than stacking holes', () => {
    const plan = planPieceScrews({ ...COUNTERSINK, screwsPerPiece: 99 }, piece());
    expect(plan.slots).toHaveLength(SCREW_ANCHORS.length);
    const anchors = plan.slots.map((s) => s.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it('shifts to the next anchor when one is blocked, keeping the count', () => {
    // A connector owns the bottom-left corner. The screw moves on rather than
    // being lost, so the piece still gets its four fasteners.
    const plan = planPieceScrews(
      COUNTERSINK,
      piece({
        bands: { left: 12, right: 12, front: 12, back: 12 },
        isBlocked: (x, y) => x < 0 && y < 0,
        isFloorAvailable: (anchor) => anchor !== 'bl',
      })
    );
    expect(plan.slots).toHaveLength(4);
    expect(plan.slots.map((s) => s.anchor)).not.toContain('bl');
    expect(plan.dropped).toContain('bl');
  });

  it('drops an anchor whose floor cannot host a screw', () => {
    // A fractional corner cell carries no magnet positions to snap to.
    const plan = planPieceScrews(
      COUNTERSINK,
      piece({ isFloorAvailable: (anchor) => anchor !== 'bl' })
    );
    expect(plan.dropped).toContain('bl');
    expect(plan.slots.map((s) => s.anchor)).not.toContain('bl');
  });

  it('drops everything when no anchor is legal anywhere', () => {
    const plan = planPieceScrews(COUNTERSINK, piece({ isFloorAvailable: () => false }));
    expect(plan.slots).toEqual([]);
    expect(plan.dropped).toHaveLength(SCREW_ANCHORS.length);
  });

  it('rejects a margin position that corner rounding has cut away', () => {
    // A pill-radius corner removes the material the corner screw wanted, so it
    // falls back to the floor rather than being placed in air.
    const plan = planPieceScrews(
      COUNTERSINK,
      piece({
        bands: { left: 12, right: 12, front: 12, back: 12 },
        cornerRadii: { tl: 40, tr: 40, bl: 40, br: 40 },
      })
    );
    expect(plan.slots.every((s) => s.site === 'floor')).toBe(true);
  });

  it('keeps every margin hole inside the piece footprint', () => {
    const plan = planPieceScrews(
      COUNTERSINK,
      piece({ bands: { left: 14, right: 14, front: 14, back: 14 } })
    );
    for (const s of plan.slots) {
      if (s.site !== 'margin') continue;
      expect(Math.abs(s.target[0])).toBeLessThan(42);
      expect(Math.abs(s.target[1])).toBeLessThan(42);
    }
  });

  it('places nothing when zero screws are requested', () => {
    const plan = planPieceScrews({ ...COUNTERSINK, screwsPerPiece: 0 }, piece());
    expect(plan.slots).toEqual([]);
  });
});

describe('plate-level pad provisioning', () => {
  const marginPiece = piece({ bands: { left: 12, right: 12, front: 12, back: 12 } });
  const floorPiece = piece();

  it('charges nothing when every piece can host its screws in margins', () => {
    expect(plateNeedsFloorPad(COUNTERSINK, [marginPiece, marginPiece])).toBe(false);
    expect(platePadThicknessMm(COUNTERSINK, [marginPiece, marginPiece], 0)).toBe(0);
  });

  it('charges the whole plate when a single piece needs the floor', () => {
    // Pieces of one plate share a slab height, so an interior piece with no
    // margin makes every piece carry the pad or the assembly is stepped.
    expect(plateNeedsFloorPad(COUNTERSINK, [marginPiece, floorPiece])).toBe(true);
    expect(platePadThicknessMm(COUNTERSINK, [marginPiece, floorPiece], 0)).toBeCloseTo(3.1, 6);
  });

  it('keeps the pad even when pruning empties a piece of floor slots', () => {
    // Reading resolved slots here would retract a pad the plate was already
    // built around, leaving other pieces' floor screws cutting into nothing.
    const pruned = piece({ isFloorAvailable: () => false });
    expect(planPieceScrews(COUNTERSINK, pruned).slots).toEqual([]);
    expect(plateNeedsFloorPad(COUNTERSINK, [pruned, floorPiece])).toBe(true);
  });
});

describe('disabled screws', () => {
  const off: ScrewHoleParams = { ...COUNTERSINK, enabled: false };

  it('plans nothing, so a caller cannot forget to check the flag', () => {
    expect(planPieceScrews(off, piece()).slots).toEqual([]);
    expect(planPieceScrews(off, piece()).dropped).toEqual([]);
  });

  it('never charges the plate a pad', () => {
    expect(pieceNeedsFloorPad(off, piece())).toBe(false);
    expect(platePadThicknessMm(off, [piece()], 0)).toBe(0);
  });
});

describe('site stability invariant', () => {
  const bands = { left: 12, right: 12, front: 12, back: 12 };

  it('does not let a collision change whether the plate needs a pad', () => {
    // The height-critical decision must be a pure function of dimensions, or a
    // connector nudging one hole silently makes the plate 3.1mm taller.
    const clear = piece({ bands });
    const obstructed = piece({ bands, isBlocked: () => true });
    expect(pieceNeedsFloorPad(COUNTERSINK, clear)).toBe(false);
    expect(pieceNeedsFloorPad(COUNTERSINK, obstructed)).toBe(false);
  });

  it('drops a blocked margin screw rather than re-siting it to the floor', () => {
    const plan = planPieceScrews(COUNTERSINK, piece({ bands, isBlocked: () => true }));
    expect(plan.slots).toEqual([]);
    expect(plan.dropped.length).toBeGreaterThan(0);
  });

  it('never emits a floor slot on a plate that provisioned no pad', () => {
    // Only the left band is usable, so bl/tl are margin and br/tr would be
    // floor. With four margin-capable anchors unavailable, the floor ones must
    // be dropped, not cut into a slab that was never made taller.
    const input = piece({ bands: { left: 12 } });
    expect(pieceNeedsFloorPad(COUNTERSINK, input)).toBe(true);

    const marginOnly = piece({ bands: { left: 12, right: 12, front: 12, back: 12 } });
    const plan = planPieceScrews(COUNTERSINK, marginOnly);
    expect(plan.slots.every((s) => s.site === 'margin')).toBe(true);
  });
});
