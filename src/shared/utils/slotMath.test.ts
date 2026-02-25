import { describe, it, expect } from 'vitest';
import {
  calculateSlotPositions,
  calculateDividerHeight,
  calculateDividerLength,
  getEffectiveSlotDimensions,
} from './slotMath';

describe('calculateSlotPositions', () => {
  it('returns empty for zero pitch', () => {
    expect(calculateSlotPositions(80, 0)).toEqual([]);
  });

  it('returns empty for negative pitch', () => {
    expect(calculateSlotPositions(80, -10)).toEqual([]);
  });

  it('returns empty for zero inner dimension', () => {
    expect(calculateSlotPositions(0, 20)).toEqual([]);
  });

  it('returns empty when effective dimension is negative due to edge inset', () => {
    expect(calculateSlotPositions(10, 5, 6)).toEqual([]);
  });

  it('returns empty when dimension is too small for 2 compartments', () => {
    // 80mm / 80mm = 1 compartment → fewer than 2 → no dividers
    expect(calculateSlotPositions(80, 80)).toEqual([]);
  });

  it('returns 1 divider for 2 compartments', () => {
    // 80mm / 40mm = 2 compartments → 1 divider at center
    const positions = calculateSlotPositions(80, 40);
    expect(positions).toHaveLength(1);
    expect(positions[0]).toBeCloseTo(0);
  });

  it('returns 2 dividers for 3 compartments', () => {
    // 90mm / 30mm = 3 compartments → 2 dividers
    const positions = calculateSlotPositions(90, 30);
    expect(positions).toHaveLength(2);
    expect(positions[0]).toBeCloseTo(-15);
    expect(positions[1]).toBeCloseTo(15);
  });

  it('uses Math.round for compartment count', () => {
    // 80mm / 30mm = 2.67 → rounds to 3 compartments → 2 dividers
    const positions = calculateSlotPositions(80, 30);
    expect(positions).toHaveLength(2);
  });

  it('positions are symmetric around zero', () => {
    const positions = calculateSlotPositions(100, 25);
    // 100/25 = 4 compartments → 3 dividers
    expect(positions).toHaveLength(3);
    expect(positions[0]).toBeCloseTo(-positions[2]);
    expect(positions[1]).toBeCloseTo(0);
  });

  it('accounts for edge inset', () => {
    // 80mm inner, 5mm inset each side → 70mm effective → 70/35 = 2 compartments
    const positions = calculateSlotPositions(80, 35, 5);
    expect(positions).toHaveLength(1);
    expect(positions[0]).toBeCloseTo(0);
  });
});

describe('calculateDividerHeight', () => {
  it('returns wallHeight when auto and no lip', () => {
    expect(calculateDividerHeight({ height: 'auto' }, 30, false)).toBe(30);
  });

  it('subtracts lip taper when auto and has lip', () => {
    const result = calculateDividerHeight({ height: 'auto' }, 30, true);
    // LIP_SMALL_TAPER is 0.7mm
    expect(result).toBeCloseTo(29.3);
  });

  it('returns explicit height regardless of lip', () => {
    expect(calculateDividerHeight({ height: 15 }, 30, true)).toBe(15);
    expect(calculateDividerHeight({ height: 15 }, 30, false)).toBe(15);
  });
});

describe('calculateDividerLength', () => {
  it('subtracts length clearance (0.3mm) from each tab', () => {
    // tabDepth = max(0.3, 1.0 - 0.1 - 0.3) = 0.6
    // length = 80 + 2 * 0.6 = 81.2
    expect(calculateDividerLength(80, 1.0, 0.1)).toBeCloseTo(81.2);
  });

  it('clamps tab depth to minimum 0.3mm when clearance exceeds slot depth', () => {
    // tabDepth = max(0.3, 0.5 - 0.5 - 0.3) = 0.3 (clamped)
    // length = 80 + 2 * 0.3 = 80.6
    expect(calculateDividerLength(80, 0.5, 0.5)).toBeCloseTo(80.6);
  });

  it('clamps tab depth to minimum when clearance far exceeds slot depth', () => {
    // tabDepth = max(0.3, 0.3 - 0.5 - 0.3) = 0.3 (clamped)
    // length = 80 + 2 * 0.3 = 80.6
    expect(calculateDividerLength(80, 0.3, 0.5)).toBeCloseTo(80.6);
  });

  it('handles deep slots with zero clearance', () => {
    // tabDepth = max(0.3, 1.5 - 0 - 0.3) = 1.2
    // length = 80 + 2 * 1.2 = 82.4
    expect(calculateDividerLength(80, 1.5, 0)).toBeCloseTo(82.4);
  });
});

describe('getEffectiveSlotDimensions', () => {
  it('slot width equals thickness + 2 * clearance', () => {
    const { slotWidth } = getEffectiveSlotDimensions(0.95, 1.2, 0.1);
    expect(slotWidth).toBeCloseTo(1.4);
  });

  it('slot depth is 50% of wall thickness', () => {
    const { slotDepth } = getEffectiveSlotDimensions(2.0, 1.2, 0.1);
    expect(slotDepth).toBe(1.0);
  });

  it('clamps slot depth to 80% of wall thickness for thin walls', () => {
    const { slotDepth } = getEffectiveSlotDimensions(0.6, 1.2, 0.1);
    // 0.6 * 0.5 = 0.3 → raw clamped to 0.5, then capped at 0.6 * 0.8 = 0.48
    expect(slotDepth).toBeCloseTo(0.48);
  });

  it('clamps slot depth to minimum 0.5mm for adequate walls', () => {
    const { slotDepth } = getEffectiveSlotDimensions(1.0, 1.2, 0.1);
    // 1.0 * 0.5 = 0.5 → clamped to 0.5, within 80% cap (0.8)
    expect(slotDepth).toBe(0.5);
  });

  it('clamps slot depth to maximum 1.5mm', () => {
    const { slotDepth } = getEffectiveSlotDimensions(4.0, 1.2, 0.1);
    // 4.0 * 0.5 = 2.0 → clamped to 1.5
    expect(slotDepth).toBe(1.5);
  });

  it('standard wall thickness 0.95mm respects 80% cap', () => {
    const { slotDepth } = getEffectiveSlotDimensions(0.95, 1.2, 0.1);
    // 0.95 * 0.5 = 0.475 → raw clamped to 0.5, then capped at 0.95 * 0.8 = 0.76
    // 0.5 < 0.76, so result is 0.5
    expect(slotDepth).toBe(0.5);
  });

  it('never exceeds wall thickness (prevents cutting through wall)', () => {
    // wallThickness = 0.4mm: raw = max(0.5, 0.2) = 0.5, cap = 0.4 * 0.8 = 0.32
    const { slotDepth } = getEffectiveSlotDimensions(0.4, 1.2, 0.1);
    expect(slotDepth).toBeCloseTo(0.32, 10);
    expect(slotDepth).toBeLessThan(0.4);
  });
});
