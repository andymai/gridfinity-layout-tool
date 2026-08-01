import { describe, it, expect } from 'vitest';
import {
  computePinPositions,
  splitConnectorsSuppressedByBase,
  splitHasConnectors,
} from './splitUtils';

describe('computePinPositions', () => {
  it('returns at least 2 pins for any valid edge', () => {
    const positions = computePinPositions(20, 35);
    expect(positions.length).toBeGreaterThanOrEqual(2);
  });

  it('returns positions centered around zero', () => {
    const positions = computePinPositions(100, 35);
    // 100mm / 35mm ≈ 3 pins
    expect(positions).toHaveLength(3);
    // Sum of centered positions should be ~0
    const sum = positions.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(0, 5);
  });

  it('returns 2 pins for short edge', () => {
    const positions = computePinPositions(30, 35);
    expect(positions).toHaveLength(2);
  });

  it('distributes pins evenly', () => {
    const positions = computePinPositions(120, 35);
    // 120/35 ≈ 3.4 → rounds to 3 pins
    expect(positions).toHaveLength(3);
    // Check even spacing
    const spacing = positions[1] - positions[0];
    expect(positions[2] - positions[1]).toBeCloseTo(spacing, 5);
  });

  it('returns empty for zero or negative edge', () => {
    expect(computePinPositions(0, 35)).toEqual([]);
    expect(computePinPositions(-10, 35)).toEqual([]);
  });

  it('returns empty for zero spacing', () => {
    expect(computePinPositions(100, 0)).toEqual([]);
  });

  it('scales pin count with edge length', () => {
    const short = computePinPositions(50, 35);
    const long = computePinPositions(200, 35);
    expect(long.length).toBeGreaterThan(short.length);
  });
});

const base = (over: Partial<{ lightweight: boolean; spacer: boolean; style: string }> = {}) => ({
  lightweight: false,
  spacer: false,
  style: 'standard',
  ...over,
});

describe('splitConnectorsSuppressedByBase', () => {
  it('suppresses on a lightweight or spacer base — no solid floor for the scarf', () => {
    expect(splitConnectorsSuppressedByBase(base({ lightweight: true }))).toBe(true);
    expect(splitConnectorsSuppressedByBase(base({ spacer: true }))).toBe(true);
  });

  it('exempts a flat base, which has a real floor', () => {
    expect(splitConnectorsSuppressedByBase(base({ lightweight: true, style: 'flat' }))).toBe(false);
    expect(splitConnectorsSuppressedByBase(base({ spacer: true, style: 'flat' }))).toBe(false);
  });

  it('allows a standard base', () => {
    expect(splitConnectorsSuppressedByBase(base())).toBe(false);
  });
});

describe('splitHasConnectors', () => {
  it('is false when the design turned connectors off', () => {
    expect(splitHasConnectors({ base: base(), splitConnectors: { enabled: false } })).toBe(false);
  });

  it('is false when the base cannot host them, whatever the design asked for', () => {
    expect(
      splitHasConnectors({ base: base({ lightweight: true }), splitConnectors: { enabled: true } })
    ).toBe(false);
  });

  it('is true when both the design and the base allow them', () => {
    expect(splitHasConnectors({ base: base(), splitConnectors: { enabled: true } })).toBe(true);
  });

  it('defaults to true when the design has no stored preference', () => {
    expect(splitHasConnectors({ base: base() })).toBe(true);
  });
});
