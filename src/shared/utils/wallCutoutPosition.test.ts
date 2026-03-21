import { describe, it, expect } from 'vitest';
import { computeCutoutCenter } from './wallCutoutPosition';

describe('computeCutoutCenter', () => {
  const wallSpan = 80; // mm (typical 2-unit bin inner width)
  const cutWidth = 40; // mm
  const wallThickness = 1.2; // mm

  it('returns 0 for center alignment with no offset', () => {
    expect(computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'center', 0)).toBe(0);
  });

  it('anchors left with auto-margin from corner', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'left', 0);
    // Expected: -halfSpan + margin + halfCut = -40 + 1.2 + 20 = -18.8
    expect(result).toBeCloseTo(-18.8);
  });

  it('anchors right with auto-margin from corner', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'right', 0);
    // Expected: halfSpan - margin - halfCut = 40 - 1.2 - 20 = 18.8
    expect(result).toBeCloseTo(18.8);
  });

  it('applies offset to alignment anchor', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'left', 5);
    // Expected: -18.8 + 5 = -13.8
    expect(result).toBeCloseTo(-13.8);
  });

  it('applies negative offset to right alignment', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'right', -10);
    // Expected: 18.8 - 10 = 8.8
    expect(result).toBeCloseTo(8.8);
  });

  it('clamps so cutout respects margin from left edge', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'left', -50);
    // Min center with margin: -halfSpan + margin + halfCut = -40 + 1.2 + 20 = -18.8
    expect(result).toBeCloseTo(-18.8);
  });

  it('clamps so cutout respects margin from right edge', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'right', 50);
    // Max center with margin: halfSpan - margin - halfCut = 40 - 1.2 - 20 = 18.8
    expect(result).toBeCloseTo(18.8);
  });

  it('returns 0 when cutout is too wide for margins (degenerate case)', () => {
    // cutWidth nearly fills the span, margins can't be satisfied
    const result = computeCutoutCenter(wallSpan, wallSpan, wallThickness, 'left', 0);
    expect(result).toBe(0);
  });

  it('handles center alignment with offset', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'center', 10);
    expect(result).toBe(10);
  });

  it('clamps center alignment offset at margin', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'center', 100);
    // Max center with margin: 40 - 1.2 - 20 = 18.8
    expect(result).toBeCloseTo(18.8);
  });

  it('returns 0 when wallSpan is too small for margin (degenerate)', () => {
    // wallSpan=10, cutWidth=8, margin=1.2 → minCenter=0.2, maxCenter=-0.2 → degenerate → 0
    const result = computeCutoutCenter(10, 8, 1.2, 'left', 0);
    expect(result).toBe(0);
  });

  it('handles small wallSpan where margin still fits', () => {
    // wallSpan=20, cutWidth=8, margin=1.2 → left anchor = -10 + 1.2 + 4 = -4.8
    const result = computeCutoutCenter(20, 8, 1.2, 'left', 0);
    expect(result).toBeCloseTo(-4.8);
  });
});
