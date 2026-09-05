import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DETACHABLE_PIN_DIAMETER_MM,
  DETACHABLE_PIN_DIAMETERS_MM,
  DETACHABLE_PIN_HOLE_DIAMETER_MM,
  DETACHABLE_PIN_LEAD_IN_MM,
  DETACHABLE_PIN_MEMBRANE_MM,
  DETACHABLE_PIN_MIN_ENGAGEMENT_MM,
  DETACHABLE_PIN_TARGET_ENGAGEMENT_MM,
  detachableFeetFitFloor,
  binFloorMm,
  detachablePinEngagementMm,
} from './base';

describe('detachable pin sizes', () => {
  it('offers sizes both under and over the hole, so either print bias has somewhere to go', () => {
    expect(DETACHABLE_PIN_DIAMETERS_MM.some((d) => d < DETACHABLE_PIN_HOLE_DIAMETER_MM)).toBe(true);
    expect(DETACHABLE_PIN_DIAMETERS_MM.some((d) => d > DETACHABLE_PIN_HOLE_DIAMETER_MM)).toBe(true);
  });

  it('keeps the interference end modest', () => {
    // The floor around a 3mm hole is thin, and the pin bottoms out under a
    // 0.4mm membrane. A wedge sized well over the hole splits it rather than
    // gripping, so the over-size options are a nudge, not a range in themselves.
    const MAX_INTERFERENCE_MM = 0.2;
    expect(Math.max(...DETACHABLE_PIN_DIAMETERS_MM)).toBeLessThanOrEqual(
      DETACHABLE_PIN_HOLE_DIAMETER_MM + MAX_INTERFERENCE_MM
    );
  });

  it('keeps the default off the tight end, where a printer has no room to be off', () => {
    expect(DETACHABLE_PIN_DIAMETERS_MM).toContain(DEFAULT_DETACHABLE_PIN_DIAMETER_MM);
    expect(DEFAULT_DETACHABLE_PIN_DIAMETER_MM).toBeLessThan(
      Math.max(...DETACHABLE_PIN_DIAMETERS_MM)
    );
    expect(DEFAULT_DETACHABLE_PIN_DIAMETER_MM).toBeGreaterThan(
      Math.min(...DETACHABLE_PIN_DIAMETERS_MM)
    );
  });

  it('leaves every pin solid under its lead-in taper', () => {
    const narrowest = Math.min(...DETACHABLE_PIN_DIAMETERS_MM);
    expect(narrowest - 2 * DETACHABLE_PIN_LEAD_IN_MM).toBeGreaterThan(0);
  });
});

describe('detachable pin engagement', () => {
  it('spends the floor on the pin and keeps the membrane back', () => {
    expect(detachablePinEngagementMm(1.2)).toBeCloseTo(1.2 - DETACHABLE_PIN_MEMBRANE_MM, 6);
  });

  it('greys the toggle exactly where the body stops meeting the feet', () => {
    expect(
      detachableFeetFitFloor(DETACHABLE_PIN_MEMBRANE_MM + DETACHABLE_PIN_MIN_ENGAGEMENT_MM)
    ).toBe(true);
    expect(
      detachableFeetFitFloor(DETACHABLE_PIN_MEMBRANE_MM + DETACHABLE_PIN_MIN_ENGAGEMENT_MM - 0.01)
    ).toBe(false);
  });

  it('gives every allowed wall the same engagement, so the fit never depends on it', () => {
    for (const wall of [1, 1.2, 1.6, 2, 2.4]) {
      expect(detachablePinEngagementMm(binFloorMm(wall))).toBeGreaterThanOrEqual(
        DETACHABLE_PIN_TARGET_ENGAGEMENT_MM
      );
    }
    // A thicker wall keeps its own floor rather than being thinned to the target.
    expect(binFloorMm(4)).toBe(4);
  });
});
