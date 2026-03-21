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

  it('clamps so cutout does not exceed left wall edge', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'left', -50);
    // Min center: -halfSpan + halfCut = -40 + 20 = -20
    expect(result).toBe(-20);
  });

  it('clamps so cutout does not exceed right wall edge', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'right', 50);
    // Max center: halfSpan - halfCut = 40 - 20 = 20
    expect(result).toBe(20);
  });

  it('handles cutWidth equal to wallSpan (full width)', () => {
    const result = computeCutoutCenter(wallSpan, wallSpan, wallThickness, 'left', 0);
    // halfCut = halfSpan, so minCenter = maxCenter = 0
    expect(result).toBe(0);
  });

  it('handles center alignment with offset', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'center', 10);
    expect(result).toBe(10);
  });

  it('clamps center alignment offset at wall edge', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'center', 100);
    // Max center: 40 - 20 = 20
    expect(result).toBe(20);
  });

  it('handles very small wallSpan', () => {
    const result = computeCutoutCenter(10, 8, 1.2, 'left', 0);
    // -5 + 1.2 + 4 = 0.2
    expect(result).toBeCloseTo(0.2);
  });
});
