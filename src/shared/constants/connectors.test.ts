import { describe, it, expect } from 'vitest';
import {
  TONGUE_CLEARANCE,
  DOVETAIL_KEY_CLEARANCE,
  MIN_CONNECTOR_CLEARANCE,
  CONNECTOR_FIT_OFFSET_MIN,
  CONNECTOR_FIT_OFFSET_MAX,
  TONGUE_PROTRUSION,
  TONGUE_BASE_HALF,
  TONGUE_TIP_HALF,
  PUZZLE_NECK_HALF,
  PUZZLE_HEAD_HALF,
  PUZZLE_NECK_PROTRUSION,
  PUZZLE_PROTRUSION,
  SNAP_CLIP,
  effectiveClearance,
  snapClipLevels,
} from './connectors';
import { NOZZLE_BASELINE } from '@/shared/printSettings/connectorScaling';

describe('effectiveClearance', () => {
  it('returns the base clearance unchanged when the offset is zero', () => {
    expect(effectiveClearance(TONGUE_CLEARANCE, 0)).toBe(TONGUE_CLEARANCE);
    expect(effectiveClearance(DOVETAIL_KEY_CLEARANCE, 0)).toBe(DOVETAIL_KEY_CLEARANCE);
  });

  it('loosens the groove by adding a positive offset', () => {
    expect(effectiveClearance(TONGUE_CLEARANCE, 0.1)).toBeCloseTo(0.25, 10);
  });

  it('tightens the groove by adding a negative offset', () => {
    expect(effectiveClearance(TONGUE_CLEARANCE, -0.05)).toBeCloseTo(0.1, 10);
  });

  it('clamps the effective clearance to the floor instead of going negative', () => {
    // Offset more negative than the base would push clearance below zero.
    expect(effectiveClearance(DOVETAIL_KEY_CLEARANCE, -0.3)).toBe(MIN_CONNECTOR_CLEARANCE);
    expect(effectiveClearance(TONGUE_CLEARANCE, CONNECTOR_FIT_OFFSET_MIN)).toBe(
      MIN_CONNECTOR_CLEARANCE
    );
  });

  it('exposes a symmetric offset range', () => {
    expect(CONNECTOR_FIT_OFFSET_MIN).toBe(-CONNECTOR_FIT_OFFSET_MAX);
    expect(MIN_CONNECTOR_CLEARANCE).toBe(0);
  });

  it('leaves the 0.4mm baseline unchanged but grows clearance on a wider nozzle', () => {
    // Default (no nozzle) and explicit 0.4mm must equal the legacy value.
    expect(effectiveClearance(TONGUE_CLEARANCE, 0, 0.4)).toBe(TONGUE_CLEARANCE);
    // 0.6mm: bead-growth adds 0.5 × 0.2 = 0.1mm on top of the base + offset.
    expect(effectiveClearance(TONGUE_CLEARANCE, 0, 0.6)).toBeCloseTo(TONGUE_CLEARANCE + 0.1, 10);
    expect(effectiveClearance(DOVETAIL_KEY_CLEARANCE, 0, 0.6)).toBeCloseTo(
      DOVETAIL_KEY_CLEARANCE + 0.1,
      10
    );
  });
});

describe('puzzle connector lock geometry (issue #2241)', () => {
  it('flares the head wider than the neck so it cannot retract through the constriction', () => {
    // The lock is the head overhanging the neck: pulling the plates apart drags
    // the wide head against the narrower neck channel in the mating groove.
    expect(PUZZLE_HEAD_HALF).toBeGreaterThan(PUZZLE_NECK_HALF);
  });

  it('provides a real per-side undercut — far more than the legacy slip-fit dovetail', () => {
    // Legacy dovetail tapered 1.0→1.3 (0.3mm/side), swallowed by clearance + squish.
    const undercutPerSide = PUZZLE_HEAD_HALF - PUZZLE_NECK_HALF;
    expect(undercutPerSide).toBeGreaterThanOrEqual(0.8);
    // …and comfortably exceed the slip-fit clearance so the catch survives it.
    expect(undercutPerSide).toBeGreaterThan(TONGUE_CLEARANCE * 3);
  });

  it('keeps the neck a printable ligament (≥2 perimeters at the baseline nozzle)', () => {
    expect(2 * PUZZLE_NECK_HALF).toBeGreaterThanOrEqual(2 * NOZZLE_BASELINE);
  });

  it('shares the legacy reach so split-plate bed-budget / bbox math is unchanged', () => {
    expect(PUZZLE_PROTRUSION).toBe(TONGUE_PROTRUSION);
    expect(PUZZLE_NECK_PROTRUSION).toBeLessThan(PUZZLE_PROTRUSION);
  });
});

describe('seam key printable undercut (issue #2637)', () => {
  it('keeps the undercut above the FDM swallow budget the bowtie key fell below', () => {
    // The original key was two mirrored dovetail tongues: TONGUE_BASE_HALF →
    // TONGUE_TIP_HALF = 0.3mm/side of undercut. A 0.4mm nozzle rounds outside
    // AND pocket corners by ~the nozzle radius, first-layer squish spreads
    // another ~0.2mm, and the press-fit clearance eats the rest — printed keys
    // came out near-rectangular and pulled straight out. The key now shares the
    // puzzle lobe profile; this pins its undercut above that swallow budget so
    // a future retune can't quietly regress the lock into decoration again.
    const undercutPerSide = PUZZLE_HEAD_HALF - PUZZLE_NECK_HALF;
    const cornerRounding = NOZZLE_BASELINE / 2;
    const firstLayerSquish = 0.2;
    const swallowBudget = cornerRounding + firstLayerSquish + DOVETAIL_KEY_CLEARANCE;
    expect(undercutPerSide).toBeGreaterThanOrEqual(2 * swallowBudget);
    // The legacy taper demonstrably failed this bar (#2637).
    const legacyUndercut = TONGUE_TIP_HALF - TONGUE_BASE_HALF;
    expect(legacyUndercut).toBeLessThan(2 * swallowBudget);
  });
});

describe('snapClipLevels nozzle scaling', () => {
  // 5mm slab + 2.4mm magnet floor is a typical viable snap-clip baseplate.
  const H = 7.4;

  it('matches the legacy barb/leg footprint at the 0.4mm baseline', () => {
    const legacy = snapClipLevels(H, 0);
    const explicit04 = snapClipLevels(H, 0, 0.4);
    expect(explicit04.legOuter).toBe(legacy.legOuter);
    expect(explicit04.barbTip).toBe(legacy.barbTip);
    // Legacy barb engagement is the un-scaled SNAP_CLIP.BARB_DEPTH.
    expect(legacy.barbTip - legacy.legOuter).toBeCloseTo(SNAP_CLIP.BARB_DEPTH, 10);
  });

  it('grows the sub-bead barb to a full bead on a 0.6mm nozzle', () => {
    const wide = snapClipLevels(H, 0, 0.6);
    // The 0.45mm barb would vanish under a 0.6mm bead — it must scale to ≥0.6mm.
    expect(wide.barbTip - wide.legOuter).toBeCloseTo(0.6, 10);
  });

  it('keeps the leg at least two perimeters wide on a 0.8mm nozzle', () => {
    const wide = snapClipLevels(H, 0, 0.8);
    const legW = wide.legOuter - SNAP_CLIP.GAP_HALF;
    expect(legW).toBeGreaterThanOrEqual(2 * 0.8 - 1e-9);
  });
});
