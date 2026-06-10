import { describe, it, expect } from 'vitest';
import {
  TONGUE_CLEARANCE,
  DOVETAIL_KEY_CLEARANCE,
  MIN_CONNECTOR_CLEARANCE,
  CONNECTOR_FIT_OFFSET_MIN,
  CONNECTOR_FIT_OFFSET_MAX,
  SNAP_CLIP,
  effectiveClearance,
  snapClipLevels,
} from './connectors';

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
