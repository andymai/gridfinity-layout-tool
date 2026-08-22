import { describe, it, expect } from 'vitest';
import { mm } from '@/core/types';
import type { ScrewHoleParams } from '@/core/types/baseplate';
import {
  SCREW_ANCHORS,
  SCREW_MARGIN_MIN_WALL_MM,
  discFitsRoundedRect,
  effectiveMarginBands,
  minBandForHead,
  planPieceScrews,
  resolveScrewHeadDiameter,
  screwHeadRecessDepth,
  screwPadThicknessMm,
  screwSnapPreference,
  type ScrewAnchor,
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

describe('screwSnapPreference', () => {
  /** The anchor a half-turn maps each anchor onto. */
  const HALF_TURN: Record<ScrewAnchor, ScrewAnchor> = {
    bl: 'tr',
    tr: 'bl',
    br: 'tl',
    tl: 'br',
    b: 't',
    t: 'b',
    l: 'r',
    r: 'l',
  };

  it('gives every anchor the exact opposite lean to its half-turn partner', () => {
    // This is the whole property: a tie resolved by lean then resolves to the
    // mirrored point for the partner, so the set closes under the rotation.
    for (const anchor of SCREW_ANCHORS) {
      const [x, y] = screwSnapPreference(anchor);
      const [px, py] = screwSnapPreference(HALF_TURN[anchor]);
      // Summed rather than negated: -0 is not Object.is-equal to 0, which is
      // what a deep-equal against [-x, -y] would trip over on a zero component.
      expect(px + x).toBe(0);
      expect(py + y).toBe(0);
    }
  });

  it('leans an edge midpoint along the axis it does not name', () => {
    // 'b' is fixed in y and free in x, so the lean has to act on x or it can
    // never break the tie it exists for.
    expect(screwSnapPreference('b')).toEqual([-1, 0]);
    expect(screwSnapPreference('t')).toEqual([1, 0]);
    expect(screwSnapPreference('l')).toEqual([0, 1]);
    expect(screwSnapPreference('r')).toEqual([0, -1]);
  });

  it('leans a corner outboard along its own diagonal', () => {
    expect(screwSnapPreference('bl')).toEqual([-1, -1]);
    expect(screwSnapPreference('tr')).toEqual([1, 1]);
  });

  it('never returns a negative zero, which would not compare equal to its mirror', () => {
    for (const anchor of SCREW_ANCHORS) {
      for (const component of screwSnapPreference(anchor)) {
        expect(Object.is(component, -0)).toBe(false);
      }
    }
  });
});

describe('SCREW_ANCHORS', () => {
  it('fills half-turn pairs, so an even count always closes under the rotation', () => {
    const HALF_TURN: Record<ScrewAnchor, ScrewAnchor> = {
      bl: 'tr',
      tr: 'bl',
      br: 'tl',
      tl: 'br',
      b: 't',
      t: 'b',
      l: 'r',
      r: 'l',
    };
    for (let count = 2; count <= SCREW_ANCHORS.length; count += 2) {
      const filled = new Set<ScrewAnchor>(SCREW_ANCHORS.slice(0, count));
      for (const anchor of filled) expect(filled.has(HALF_TURN[anchor])).toBe(true);
    }
  });
});

describe('planPieceScrews', () => {
  it('sites four corner screws in the margin when the bands are wide enough', () => {
    const slots = planPieceScrews(
      COUNTERSINK,
      piece({ bands: { left: 12, right: 12, front: 12, back: 12 } })
    );
    expect(slots).toHaveLength(4);
    expect(slots.every((s) => s.site === 'margin')).toBe(true);
    expect(slots.map((s) => s.anchor)).toEqual(['bl', 'tr', 'br', 'tl']);
  });

  it('falls back to the floor when no band can host the head', () => {
    const slots = planPieceScrews(COUNTERSINK, piece());
    expect(slots).toHaveLength(4);
    expect(slots.every((s) => s.site === 'floor')).toBe(true);
  });

  it('targets the piece corners for floor slots, so the snap is unambiguous', () => {
    const slots = planPieceScrews(COUNTERSINK, piece());
    const bl = slots.find((s) => s.anchor === 'bl');
    expect(bl?.target).toEqual([-42, -42]);
  });

  it('treats a band one hair under the threshold as unusable', () => {
    const justUnder = minBandForHead(8) - 0.01;
    const slots = planPieceScrews(
      COUNTERSINK,
      piece({ bands: { left: justUnder, right: 0, front: justUnder, back: 0 } })
    );
    expect(slots.every((s) => s.site === 'floor')).toBe(true);
  });

  it('mixes sites when only some sides carry a usable band', () => {
    const slots = planPieceScrews(COUNTERSINK, piece({ bands: { left: 12 } }));
    const bySite = slots.map((s) => `${s.anchor}:${s.site}`);
    expect(bySite).toContain('bl:margin');
    expect(bySite).toContain('tl:margin');
    expect(bySite).toContain('br:floor');
    expect(bySite).toContain('tr:floor');
  });

  it('rides the wider of the two bands adjacent to a corner', () => {
    const slots = planPieceScrews(
      COUNTERSINK,
      piece({ bands: { left: 11, right: 0, front: 20, back: 0 } })
    );
    const bl = slots.find((s) => s.anchor === 'bl');
    expect(bl?.site).toBe('margin');
    expect(bl?.target[1]).toBeCloseTo(-(84 / 2 - 20 / 2), 6);
  });

  it('never emits two slots on the same anchor', () => {
    // Regression: cycling the corner list for counts above four put two
    // coincident holes on the same spot.
    const slots = planPieceScrews({ ...COUNTERSINK, screwsPerPiece: 8 }, piece());
    const anchors = slots.map((s) => s.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it('extends to edge midpoints for counts above four, a half-turn pair at a time', () => {
    // b before t before r/l, not the compass order: six screws then close under
    // the 180° rotation instead of taking one anchor whose partner never fills.
    const slots = planPieceScrews({ ...COUNTERSINK, screwsPerPiece: 6 }, piece());
    expect(slots.map((s) => s.anchor)).toEqual(['bl', 'tr', 'br', 'tl', 'b', 't']);
  });

  it('caps a count beyond the anchor list rather than stacking holes', () => {
    const slots = planPieceScrews({ ...COUNTERSINK, screwsPerPiece: 99 }, piece());
    expect(slots).toHaveLength(SCREW_ANCHORS.length);
    const anchors = slots.map((s) => s.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it('shifts to the next anchor when one is blocked, keeping the count', () => {
    // A connector owns the bottom-left corner. The screw moves on rather than
    // being lost, so the piece still gets its four fasteners.
    const slots = planPieceScrews(
      COUNTERSINK,
      piece({
        bands: { left: 12, right: 12, front: 12, back: 12 },
        isBlocked: (x, y) => x < 0 && y < 0,
      })
    );
    expect(slots).toHaveLength(4);
    expect(slots.map((s) => s.anchor)).not.toContain('bl');
  });

  it('rejects a margin position that corner rounding has cut away', () => {
    // A pill-radius corner removes the material the corner screw wanted, so it
    // falls back to the floor rather than being placed in air.
    const slots = planPieceScrews(
      COUNTERSINK,
      piece({
        bands: { left: 12, right: 12, front: 12, back: 12 },
        cornerRadii: { tl: 40, tr: 40, bl: 40, br: 40 },
      })
    );
    expect(slots.every((s) => s.site === 'floor')).toBe(true);
  });

  it('keeps every margin hole inside the piece footprint', () => {
    const slots = planPieceScrews(
      COUNTERSINK,
      piece({ bands: { left: 14, right: 14, front: 14, back: 14 } })
    );
    for (const s of slots) {
      if (s.site !== 'margin') continue;
      expect(Math.abs(s.target[0])).toBeLessThan(42);
      expect(Math.abs(s.target[1])).toBeLessThan(42);
    }
  });

  it('places nothing when zero screws are requested', () => {
    const slots = planPieceScrews({ ...COUNTERSINK, screwsPerPiece: 0 }, piece());
    expect(slots).toEqual([]);
  });
});

describe('custom perimeter', () => {
  const bands = { left: 12, right: 12, front: 12, back: 12 };

  it('re-sites a screw the perimeter excludes, rather than dropping it', () => {
    // An outline is resolved-param data known as early as padding, so it may
    // decide the site. A shaped plate keeps its four fasteners and buys a pad.
    const shaped = piece({ bands, isInsidePerimeter: (x, y) => !(x < 0 && y < 0) });
    const slots = planPieceScrews(COUNTERSINK, shaped);
    expect(slots).toHaveLength(4);
    expect(slots.find((s) => s.anchor === 'bl')?.site).toBe('floor');
  });

  it('leaves a plain rectangle untouched when no perimeter is supplied', () => {
    const slots = planPieceScrews(COUNTERSINK, piece({ bands }));
    expect(slots.every((s) => s.site === 'margin')).toBe(true);
  });
});

describe('disabled screws', () => {
  const off: ScrewHoleParams = { ...COUNTERSINK, enabled: false };

  it('plans nothing, so a caller cannot forget to check the flag', () => {
    expect(planPieceScrews(off, piece())).toEqual([]);
  });
});

describe('site stability invariant', () => {
  const bands = { left: 12, right: 12, front: 12, back: 12 };

  it('drops a blocked margin screw rather than re-siting it to the floor', () => {
    // Blocking may only prune. Re-siting to the floor would make the plate
    // 3.1mm taller because a connector nudged one hole.
    const slots = planPieceScrews(COUNTERSINK, piece({ bands, isBlocked: () => true }));
    expect(slots).toEqual([]);
  });

  it('never emits a floor slot on a plate that provisioned no pad', () => {
    // Only the left band is usable, so bl/tl/l are margin and every other
    // anchor would be floor. With no pad provisioned those must be dropped
    // rather than cut into a slab that was never made taller, which is why the
    // piece ends up with three screws instead of its requested four.
    const slots = planPieceScrews(
      COUNTERSINK,
      piece({ bands: { left: 12 }, floorPadProvisioned: false })
    );
    expect(slots.map((s) => s.anchor)).toEqual(['bl', 'tl', 'l']);
    expect(slots.every((s) => s.site === 'margin')).toBe(true);
  });
});
