/**
 * Plan-level tests for the sliding lid.
 *
 * These assert the RELATIONSHIPS the joint depends on — that the plate is
 * narrower than its channel by the clearance on every face, that the retainer's
 * underside is parallel to the plate's chamfer and one clearance above it, that
 * nothing overhangs — none of which needs a kernel. The kernel tests
 * (`__kernel-tests__/slideLidSeating.ts`) then check that the built solids
 * actually assemble; asserting the arithmetic against a second copy of itself
 * would not be verification (CLAUDE.md gotcha #14).
 */

import { describe, expect, it } from 'vitest';
import {
  resolveSlideLidPlan,
  slidePlateTopBelowWallTopMm,
  slideSagSafeThicknessMm,
  slideTravelsAlongX,
  slideWallThicknessMm,
  SLIDE_BEARING_MM,
  SLIDE_ROOF_TIP_MM,
  SLIDE_SAG_SPAN_MM,
  SLIDE_WEDGE_MM,
  type SlideLidBar,
  type SlideLidPlanInput,
} from './slideLidPlan';
import {
  DEFAULT_LID_SLIDE_CONFIG,
  isDefaultLidSlide,
  LID_SLIDE_PLATE_MIN_MM,
  resolveLidSlide,
} from '@/features/bin-designer/types/lid';
import type { LidRailSide } from '@/features/bin-designer/types/lid';

/** A 3x2x6 standard bin at stock pitch: big enough for every case below. */
function input(over: Partial<SlideLidPlanInput> = {}): SlideLidPlanInput {
  return {
    slide: DEFAULT_LID_SLIDE_CONFIG,
    plateThicknessMm: LID_SLIDE_PLATE_MIN_MM,
    innerW: 3 * 42 - 0.5 - 2 * 1.2,
    innerD: 2 * 42 - 0.5 - 2 * 1.2,
    wallThickness: 1.2,
    entryWallThicknessMm: 1.2,
    cavityDepthMm: 6 * 7 - 5 - 1.2,
    hasLip: true,
    isPolygon: false,
    isSolid: false,
    isSlotted: false,
    isTile: false,
    ...over,
  };
}

/**
 * The default entry side is FRONT, so the plate travels along Y and spans X.
 * Named here rather than inlined: getting these the wrong way round is the one
 * mistake this whole canonical-frame design exists to make impossible, and a
 * test that quietly swapped them would assert nothing.
 */
const SPAN_INNER = 3 * 42 - 0.5 - 2 * 1.2;
const TRAVEL_INNER = 2 * 42 - 0.5 - 2 * 1.2;

function geometryOf(over: Partial<SlideLidPlanInput> = {}) {
  const { geometry, rejection } = resolveSlideLidPlan(input(over));
  expect(rejection).toBeNull();
  if (!geometry) throw new Error('expected geometry');
  return geometry;
}

/** Highest Z the section reaches at a given Y, or null when it spans no material. */
function sectionTopAt(bar: SlideLidBar, y: number): number | null {
  // Every section here is a convex quad with two vertical-ish sides, so the
  // top boundary is the upper envelope of its edges at this Y.
  let top: number | null = null;
  const pts = bar.section;
  for (let i = 0; i < pts.length; i++) {
    const [y0, z0] = pts[i];
    const [y1, z1] = pts[(i + 1) % pts.length];
    if (y0 === y1) continue;
    const t = (y - y0) / (y1 - y0);
    if (t < -1e-9 || t > 1 + 1e-9) continue;
    const z = z0 + t * (z1 - z0);
    if (top === null || z > top) top = z;
  }
  return top;
}

function sectionBottomAt(bar: SlideLidBar, y: number): number | null {
  let bottom: number | null = null;
  const pts = bar.section;
  for (let i = 0; i < pts.length; i++) {
    const [y0, z0] = pts[i];
    const [y1, z1] = pts[(i + 1) % pts.length];
    if (y0 === y1) continue;
    const t = (y - y0) / (y1 - y0);
    if (t < -1e-9 || t > 1 + 1e-9) continue;
    const z = z0 + t * (z1 - z0);
    if (bottom === null || z < bottom) bottom = z;
  }
  return bottom;
}

describe('resolveSlideLidPlan', () => {
  describe('style and shape gates', () => {
    it.each([
      ['no-cavity', { isSolid: true }],
      ['no-walls', { isTile: true }],
      ['slot-conflict', { isSlotted: true }],
      ['unsupported-shape', { isPolygon: true }],
    ] as const)('refuses with %s', (expected, over) => {
      expect(resolveSlideLidPlan(input(over)).rejection).toBe(expected);
      expect(resolveSlideLidPlan(input(over)).geometry).toBeNull();
    });

    it('refuses a plate too thin to carry the wedge', () => {
      // 0.8mm is the CAPPING lid's baseline. `resolveLidPlateThickness` floors a
      // sliding one at LID_SLIDE_PLATE_MIN_MM precisely so this is unreachable
      // through the UI — but a crafted payload is not the UI.
      expect(resolveSlideLidPlan(input({ plateThicknessMm: 0.8 })).rejection).toBe(
        'plate-too-thin'
      );
    });

    it('refuses a bin too shallow to hold the channel', () => {
      expect(resolveSlideLidPlan(input({ cavityDepthMm: 3 })).rejection).toBe('bin-too-shallow');
    });

    it('refuses a bin too narrow for a usable plate', () => {
      // Narrow ACROSS the travel axis: with a front entry that is innerW.
      expect(resolveSlideLidPlan(input({ innerW: 8 })).rejection).toBe('bin-too-narrow');
    });

    it('refuses a bin too short for the plate to travel in', () => {
      // And short ALONG it, which is innerD for the same entry. The two
      // rejections are distinct because the fixes are: a narrow bin needs a
      // wider one, a short one needs the entry moved to the other wall.
      expect(resolveSlideLidPlan(input({ innerD: 8 })).rejection).toBe('bin-too-short');
    });
  });

  describe('the joint', () => {
    it('holds the plate one clearance clear of each channel wall', () => {
      const g = geometryOf();
      const halfSpan = SPAN_INNER / 2;
      expect(g.plate.spanMm / 2).toBeCloseTo(halfSpan - g.clearanceMm, 9);
    });

    it('leaves the plate resting ON the shelf, not floating above it', () => {
      // Clearance is a SIDE gap; gravity settles the plate onto its bearing, so
      // the shelf's top face IS the plate's underside. A gap here would be a
      // plate that drops when loaded and then binds.
      const g = geometryOf();
      const shelf = g.bars.find((b) => b.kind === 'shelf' && b.wall === 'yMin');
      expect(shelf).toBeDefined();
      if (!shelf) return;
      const wallY = -SPAN_INNER / 2;
      expect(sectionTopAt(shelf, wallY + 0.5)).toBeCloseTo(-g.plate.thicknessMm, 9);
    });

    it('gives each shelf the full bearing overlap past the clearance', () => {
      const g = geometryOf();
      const plateEdge = g.plate.spanMm / 2;
      const shelf = g.bars.find((b) => b.kind === 'shelf' && b.wall === 'yMax');
      expect(shelf).toBeDefined();
      if (!shelf) return;
      // The shelf's inboard tip, and how far it reaches past the plate's edge.
      const tip = Math.min(...shelf.section.map(([y]) => y));
      expect(plateEdge - tip).toBeCloseTo(SLIDE_BEARING_MM, 9);
    });

    it('holds the retainer exactly one clearance above the plate chamfer', () => {
      // THE relationship that makes the joint work: two parallel 45° planes a
      // clearance apart. Sampled across the whole engagement rather than at one
      // point, since a plane that is right at one Y and wrong at another is
      // exactly the failure a single probe misses.
      const g = geometryOf();
      const retainer = g.bars.find((b) => b.kind === 'retainer' && b.wall === 'yMin');
      expect(retainer).toBeDefined();
      if (!retainer) return;
      const wallY = -SPAN_INNER / 2;
      const plateEdgeY = -g.plate.spanMm / 2;
      for (let u = g.clearanceMm; u <= g.clearanceMm + g.plate.wedgeMm; u += 0.05) {
        const y = wallY + u;
        // The plate's chamfered top at this Y, rising 45° inboard from its edge.
        const plateTop = -g.plate.wedgeMm + (y - plateEdgeY);
        const roofBottom = sectionBottomAt(retainer, y);
        expect(roofBottom).not.toBeNull();
        if (roofBottom === null) continue;
        expect(roofBottom - plateTop).toBeCloseTo(g.clearanceMm, 6);
      }
    });

    it('never overhangs: every downward-facing face is at most 45°', () => {
      // The whole reason this is a half-dovetail and not the square rebate the
      // reference design uses. A face steeper than 45° from vertical needs
      // support inside a cavity nobody can reach.
      const g = geometryOf();
      for (const bar of g.bars) {
        const pts = bar.section;
        for (let i = 0; i < pts.length; i++) {
          const [y0, z0] = pts[i];
          const [y1, z1] = pts[(i + 1) % pts.length];
          const dy = Math.abs(y1 - y0);
          const dz = Math.abs(z1 - z0);
          if (dy < 1e-9) continue;
          expect(dz / dy).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
    });

    it('keeps the retainer tip a real wall rather than a knife edge', () => {
      const g = geometryOf();
      const retainer = g.bars.find((b) => b.kind === 'retainer' && b.wall === 'yMax');
      expect(retainer).toBeDefined();
      if (!retainer) return;
      const tipY = Math.min(...retainer.section.map(([y]) => Math.abs(y)));
      const zs = retainer.section.filter(([y]) => Math.abs(Math.abs(y) - tipY) < 1e-9);
      expect(Math.abs(zs[0][1] - zs[1][1])).toBeCloseTo(SLIDE_ROOF_TIP_MM, 9);
    });

    it('sizes the wedge from the plate, keeping a real outer edge', () => {
      // A thick plate gets the nominal wedge; a thin one gets whatever it can
      // spare, and the outer edge never goes below the floor.
      expect(geometryOf({ plateThicknessMm: 3 }).plate.wedgeMm).toBeCloseTo(SLIDE_WEDGE_MM, 9);
      const thin = geometryOf({ plateThicknessMm: 1.3 });
      expect(thin.plate.wedgeMm).toBeLessThan(SLIDE_WEDGE_MM);
      expect(thin.plate.thicknessMm - thin.plate.wedgeMm).toBeGreaterThanOrEqual(0.6 - 1e-9);
    });
  });

  describe('placement', () => {
    it('parks a rim channel with its retainer top at the wall top', () => {
      const g = geometryOf({
        hasLip: false,
        slide: { ...DEFAULT_LID_SLIDE_CONFIG, placement: 'flush' },
      });
      expect(g.plateTopBelowWallTopMm).toBeCloseTo(g.clearanceMm + SLIDE_ROOF_TIP_MM, 9);
    });

    it('drops a recessed channel clear of the lip’s angled support', () => {
      // The support reaches LIP_TAPER_WIDTH (2.6mm) below the lip's own base
      // plane, which is the wall top. A retainer
      // fused inside that band would back-fill the taper a foot has to seat in,
      // and no mesh check would show it (CLAUDE.md gotcha #10).
      const recessed = slidePlateTopBelowWallTopMm('recessed', 0.25, true);
      const flush = slidePlateTopBelowWallTopMm('flush', 0.25, true);
      expect(recessed - flush).toBeCloseTo(2.6, 9);
    });

    it('collapses the two placements on a lipless bin', () => {
      // Correct rather than an error: with no lip there is nothing above the rim
      // to get out of the way of, so `recessed` has nowhere lower to go.
      expect(slidePlateTopBelowWallTopMm('recessed', 0.25, false)).toBeCloseTo(
        slidePlateTopBelowWallTopMm('flush', 0.25, false),
        9
      );
    });
  });

  describe('entry side', () => {
    it.each([
      ['right', true, 0],
      ['left', true, 180],
      ['back', false, 90],
      ['front', false, -90],
    ] as const)('maps %s onto the canonical +X entry', (side, travelsX, rotationDeg) => {
      expect(slideTravelsAlongX(side)).toBe(travelsX);
      const g = geometryOf({ slide: { ...DEFAULT_LID_SLIDE_CONFIG, entrySide: side } });
      expect(g.rotationDeg).toBe(rotationDeg);
    });

    it('swaps which axis is span and which is travel', () => {
      const along = geometryOf({ slide: { ...DEFAULT_LID_SLIDE_CONFIG, entrySide: 'right' } });
      const across = geometryOf({ slide: { ...DEFAULT_LID_SLIDE_CONFIG, entrySide: 'back' } });
      // The 3x2 bin is wider than it is deep, so entering from a short (left /
      // right) wall gives the NARROWER plate: it then spans the depth.
      expect(along.plate.spanMm).toBeLessThan(across.plate.spanMm);
    });

    it('reaches the entry wall’s outer face so a closed lid fills its notch', () => {
      const g = geometryOf();
      expect(g.plate.trailingX).toBeCloseTo(TRAVEL_INNER / 2 + input().entryWallThicknessMm, 9);
    });
  });

  describe('detent', () => {
    it('puts a bump on each shelf and a pocket over it in the plate', () => {
      // The pair is the feature. A bump alone is never climbed: a shut plate
      // covers the channel, so its only free boundary is the leading edge, and
      // that edge moves AWAY from anything behind it as the lid opens.
      const g = geometryOf();
      expect(g.detents).toHaveLength(2);
      expect(g.plate.detentPockets).toHaveLength(2);
      for (const d of g.detents) {
        // Under the plate when shut, which is what lets the pocket meet it.
        expect(d.peakX).toBeGreaterThan(g.plate.leadingX);
        expect(d.peakX).toBeLessThan(g.plate.trailingX);
        expect(d.baseZ).toBeCloseTo(-g.plate.thicknessMm, 9);
      }
      // And each pocket is over its own bump, with slack on every face.
      for (const [i, p] of g.plate.detentPockets.entries()) {
        const d = g.detents[i];
        expect(p.centerX).toBeCloseTo(d.peakX, 9);
        expect(p.lengthMm / 2).toBeGreaterThan(d.runMm);
        expect(p.depthMm).toBeGreaterThan(d.riseMm);
        expect(p.yMin).toBeLessThan(d.yMin);
        expect(p.yMax).toBeGreaterThan(d.yMax);
      }
    });

    it('leaves plate on both sides of each pocket', () => {
      // A pocket that reached the leading edge would be a notch, and the plate
      // would slide straight out of it.
      const g = geometryOf();
      for (const p of g.plate.detentPockets) {
        expect(p.centerX - p.lengthMm / 2).toBeGreaterThan(g.plate.leadingX);
        expect(p.centerX + p.lengthMm / 2).toBeLessThan(g.plate.trailingX);
      }
    });

    it('drops both halves when the design turns it off', () => {
      const g = geometryOf({ slide: { ...DEFAULT_LID_SLIDE_CONFIG, detent: false } });
      expect(g.detents).toEqual([]);
      expect(g.plate.detentPockets).toEqual([]);
    });

    it('stays under the vertical clearance so the ride-over costs no flex', () => {
      // The plate floats within the slop it already has for the last few
      // millimetres of closing. A taller bump would jam it against the retainer
      // for that whole stretch instead of clicking at the end.
      const g = geometryOf();
      expect(g.detents[0].riseMm).toBeLessThan(g.clearanceMm);
      expect(g.detents[0].riseMm).toBeGreaterThan(0.05);
    });

    it('seats the plate against the far wall, detent or not', () => {
      // The hard stop is the wall; the detent defines where it CLICKS, not
      // where it stops, so turning it off must not move the closed position.
      const on = geometryOf();
      const off = geometryOf({ slide: { ...DEFAULT_LID_SLIDE_CONFIG, detent: false } });
      expect(on.plate.leadingX).toBeCloseTo(off.plate.leadingX, 9);
      expect(on.plate.leadingX).toBeCloseTo(-TRAVEL_INNER / 2 + on.clearanceMm, 9);
    });
  });

  describe('travel envelope', () => {
    it('spans the whole cavity, not a band at the walls', () => {
      // The distinction from a click lid's perimeter ring: a plate sweeps the
      // opening, so a divider in the middle of the grid stops it as dead as one
      // against a wall.
      const g = geometryOf();
      expect(g.travelEnvelope.xMax - g.travelEnvelope.xMin).toBeCloseTo(TRAVEL_INNER, 9);
      expect(g.travelEnvelope.yMax - g.travelEnvelope.yMin).toBeCloseTo(SPAN_INNER, 9);
    });

    it('stops at the retainer’s top plane, never in the lip’s band', () => {
      const g = geometryOf();
      expect(g.travelEnvelope.zMax).toBeCloseTo(g.clearanceMm + SLIDE_ROOF_TIP_MM, 9);
      // Which, measured from the wall top, is still below it on a recessed
      // channel — so the cutter cannot reach the lip at all.
      expect(g.plateTopBelowWallTopMm - g.travelEnvelope.zMax).toBeGreaterThan(0);
    });

    it('reaches below the plate by more than the plate itself', () => {
      const g = geometryOf();
      expect(g.travelEnvelope.zMin).toBeLessThan(-g.plate.thicknessMm);
    });
  });

  describe('entry notch', () => {
    it('is wider than the plate by the clearance on each side', () => {
      const g = geometryOf();
      expect(g.entryNotch.yMax - g.entryNotch.yMin).toBeCloseTo(
        g.plate.spanMm + 2 * g.clearanceMm,
        9
      );
    });

    it('cuts clear through the rim AND the lip above it', () => {
      // Anything left above the window bridges the whole opening with nothing
      // under it. Stopping just past the wall top is the version that looks
      // right and is not: it leaves exactly the lip band spanning, which is the
      // worst overhang on the part.
      //
      // `zMax` is measured from the PLATE's top plane, so the lip's top face
      // sits `plateTopBelowWallTopMm + LIP_HEIGHT` above it.
      const g = geometryOf();
      const lipTopAbovePlate = g.plateTopBelowWallTopMm + 4.4;
      expect(g.entryNotch.zMax).toBeGreaterThan(lipTopAbovePlate);
    });

    it('stops just past the wall top on a lipless bin', () => {
      // There is no lip to clear, so cutting higher would only remove wall the
      // plate never passes through.
      const g = geometryOf({
        hasLip: false,
        slide: { ...DEFAULT_LID_SLIDE_CONFIG, placement: 'flush' },
      });
      expect(g.entryNotch.zMax).toBeCloseTo(g.plateTopBelowWallTopMm + 1, 9);
    });
  });

  describe('sag reporting', () => {
    it('leaves a short span alone', () => {
      expect(slideSagSafeThicknessMm(SLIDE_SAG_SPAN_MM / 2)).toBeCloseTo(LID_SLIDE_PLATE_MIN_MM, 9);
    });

    it('asks for more plate as the span grows', () => {
      const wide = slideSagSafeThicknessMm(SLIDE_SAG_SPAN_MM * 2);
      expect(wide).toBeGreaterThan(LID_SLIDE_PLATE_MIN_MM);
      // Whole layers at the common layer height, since layer adhesion is what
      // is being traded.
      expect(Math.round(wide * 5)).toBeCloseTo(wide * 5, 6);
    });
  });
});

describe('the stored config stays absent until it says something', () => {
  // `communityParamsFingerprint` hashes the whole params object and keys both
  // the duplicate guard and the moderation tombstone (CLAUDE.md gotcha #13a), so
  // a field that were always present would re-hash every design already
  // published and stop old takedowns matching a re-publish. The example-design
  // fingerprint drift test is what catches a regression here in practice; this
  // states the rule directly.
  it('reads back as the factory config when absent', () => {
    expect(resolveLidSlide({})).toEqual(DEFAULT_LID_SLIDE_CONFIG);
    expect(resolveLidSlide({ slide: undefined })).toEqual(DEFAULT_LID_SLIDE_CONFIG);
  });

  it('recognises a factory-valued object so migration can drop it', () => {
    expect(isDefaultLidSlide(DEFAULT_LID_SLIDE_CONFIG)).toBe(true);
    expect(isDefaultLidSlide({ ...DEFAULT_LID_SLIDE_CONFIG, detent: false })).toBe(false);
    expect(isDefaultLidSlide({ ...DEFAULT_LID_SLIDE_CONFIG, entrySide: 'back' })).toBe(false);
  });

  it('keeps a config the user did change', () => {
    const custom = { ...DEFAULT_LID_SLIDE_CONFIG, placement: 'flush' as const };
    expect(resolveLidSlide({ slide: custom })).toBe(custom);
  });
});

describe('slideWallThicknessMm', () => {
  const dims = {
    outerW: 100,
    outerD: 60,
    innerW: 90,
    innerD: 50,
    innerOffsetX: 0,
    innerOffsetY: 0,
    wallHeight: 40,
    hasLip: true,
    isSolid: false,
    isSlotted: false,
    isTile: false,
  };

  it('reports the nominal wall on a symmetric bin', () => {
    for (const side of ['front', 'back', 'left', 'right'] as LidRailSide[]) {
      expect(slideWallThicknessMm(side, dims)).toBeCloseTo(5, 9);
    }
  });

  it('reports each side separately once overhang shifts the cavity', () => {
    // Asymmetric overhang moves the cavity off the bin's origin, so the two
    // walls on one axis are no longer the same thickness — and the plate has to
    // reach the face it actually finishes at.
    const shifted = { ...dims, innerOffsetX: 3 };
    expect(slideWallThicknessMm('right', shifted)).toBeCloseTo(2, 9);
    expect(slideWallThicknessMm('left', shifted)).toBeCloseTo(8, 9);
  });
});
