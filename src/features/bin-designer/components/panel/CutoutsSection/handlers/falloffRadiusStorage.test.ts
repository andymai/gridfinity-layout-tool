import { describe, it, expect, beforeEach } from 'vitest';
import { loadFalloffMm, saveFalloffMm } from './falloffRadiusStorage';
import { DEFAULT_FALLOFF_MM, FALLOFF_MAX_MM } from './falloffDrag';

describe('falloffRadiusStorage', () => {
  beforeEach(() => localStorage.clear());

  it('starts at the default radius', () => {
    expect(loadFalloffMm()).toBe(DEFAULT_FALLOFF_MM);
  });

  it('keeps a saved radius', () => {
    saveFalloffMm(25);
    expect(loadFalloffMm()).toBe(25);
  });

  it('ignores a stored value out of range', () => {
    localStorage.setItem('gridfinity-cutout-falloff-mm', String(FALLOFF_MAX_MM * 2));
    expect(loadFalloffMm()).toBe(DEFAULT_FALLOFF_MM);
  });
});
