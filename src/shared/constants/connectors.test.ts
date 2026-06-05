import { describe, it, expect } from 'vitest';
import {
  TONGUE_CLEARANCE,
  DOVETAIL_KEY_CLEARANCE,
  MIN_CONNECTOR_CLEARANCE,
  CONNECTOR_FIT_OFFSET_MIN,
  CONNECTOR_FIT_OFFSET_MAX,
  effectiveClearance,
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
});
