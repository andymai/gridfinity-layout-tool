import { describe, expect, it } from 'vitest';
import { computeAnchoredPaddings } from './computeAnchoredPaddings';

const base = (l: number, r: number, f: number, b: number) => ({
  paddingLeft: l,
  paddingRight: r,
  paddingFront: f,
  paddingBack: b,
});

describe('computeAnchoredPaddings', () => {
  it('top-left anchor puts all padding on front and right', () => {
    const result = computeAnchoredPaddings(base(10, 10, 10, 10), 'tl');
    expect(result.paddingLeft).toBe(0);
    expect(result.paddingRight).toBe(20);
    expect(result.paddingBack).toBe(0);
    expect(result.paddingFront).toBe(20);
    expect(result.clamped).toBe(false);
  });

  it('top-right anchor puts all padding on front and left', () => {
    const result = computeAnchoredPaddings(base(10, 10, 10, 10), 'tr');
    expect(result.paddingLeft).toBe(20);
    expect(result.paddingRight).toBe(0);
    expect(result.paddingBack).toBe(0);
    expect(result.paddingFront).toBe(20);
  });

  it('bottom-right anchor puts all padding on back and left', () => {
    const result = computeAnchoredPaddings(base(10, 10, 10, 10), 'br');
    expect(result.paddingLeft).toBe(20);
    expect(result.paddingRight).toBe(0);
    expect(result.paddingBack).toBe(20);
    expect(result.paddingFront).toBe(0);
  });

  it('center anchor splits each axis evenly', () => {
    const result = computeAnchoredPaddings(base(8, 12, 7, 13), 'c');
    expect(result.paddingLeft).toBe(10);
    expect(result.paddingRight).toBe(10);
    expect(result.paddingBack).toBe(10);
    expect(result.paddingFront).toBe(10);
    expect(result.clamped).toBe(false);
  });

  it('odd-sum center split gives leftover 0.01mm to the end side', () => {
    const result = computeAnchoredPaddings(base(16, 16.01, 0, 0), 'c');
    // 32.01 / 2 = 16.005 → rounded 16.00, leftover 0.01 → right
    expect(result.paddingLeft).toBe(16);
    expect(result.paddingRight).toBe(16.01);
  });

  it('middle-left anchor splits Y evenly and pushes X to right', () => {
    const result = computeAnchoredPaddings(base(6, 4, 10, 10), 'ml');
    expect(result.paddingLeft).toBe(0);
    expect(result.paddingRight).toBe(10);
    expect(result.paddingBack).toBe(10);
    expect(result.paddingFront).toBe(10);
  });

  it('clamps to PADDING_MAX when total exceeds 2× max and flags clamped', () => {
    // total X = 250 (exceeds 2×100=200), top-left → all on right, which clamps to 100
    const result = computeAnchoredPaddings(base(120, 130, 0, 0), 'tl');
    expect(result.paddingLeft).toBe(0);
    expect(result.paddingRight).toBe(100);
    expect(result.clamped).toBe(true);
  });

  it('handles zero-sum inputs cleanly (no clamp)', () => {
    const result = computeAnchoredPaddings(base(0, 0, 0, 0), 'c');
    expect(result.paddingLeft).toBe(0);
    expect(result.paddingRight).toBe(0);
    expect(result.paddingBack).toBe(0);
    expect(result.paddingFront).toBe(0);
    expect(result.clamped).toBe(false);
  });

  it('preserves total X and total Y under any anchor when within bounds', () => {
    const input = base(7.5, 12.5, 3, 17);
    const totalX = input.paddingLeft + input.paddingRight;
    const totalY = input.paddingFront + input.paddingBack;
    const anchors = ['tl', 'tc', 'tr', 'ml', 'c', 'mr', 'bl', 'bc', 'br'] as const;
    for (const a of anchors) {
      const r = computeAnchoredPaddings(input, a);
      expect(r.paddingLeft + r.paddingRight).toBeCloseTo(totalX, 6);
      expect(r.paddingBack + r.paddingFront).toBeCloseTo(totalY, 6);
    }
  });
});
