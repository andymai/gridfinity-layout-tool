import { describe, expect, it } from 'vitest';
import { MAX_CUTOUT_LEAN_DEG, resolveCutoutLeanDeg } from './cutout';

describe('resolveCutoutLeanDeg', () => {
  it('passes an in-range lean through, either sign', () => {
    expect(resolveCutoutLeanDeg({ shape: 'rectangle', leanDeg: 30 })).toBe(30);
    expect(resolveCutoutLeanDeg({ shape: 'path', leanDeg: -15 })).toBe(-15);
  });

  it('treats absent and non-finite values as vertical', () => {
    expect(resolveCutoutLeanDeg({ shape: 'rectangle' })).toBe(0);
    expect(resolveCutoutLeanDeg({ shape: 'rectangle', leanDeg: Number.NaN })).toBe(0);
    expect(resolveCutoutLeanDeg({ shape: 'rectangle', leanDeg: Infinity })).toBe(0);
  });

  it('clamps past the editor cap in both directions', () => {
    expect(resolveCutoutLeanDeg({ shape: 'circle', leanDeg: 90 })).toBe(MAX_CUTOUT_LEAN_DEG);
    expect(resolveCutoutLeanDeg({ shape: 'circle', leanDeg: -90 })).toBe(-MAX_CUTOUT_LEAN_DEG);
  });

  it('gates out the shapes the builder never tilts', () => {
    expect(resolveCutoutLeanDeg({ shape: 'mesh', leanDeg: 30 })).toBe(0);
    expect(resolveCutoutLeanDeg({ shape: 'knifeSlot', leanDeg: 30 })).toBe(0);
  });
});
