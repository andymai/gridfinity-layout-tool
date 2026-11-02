import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/shared/types/bin';
import { DEFAULT_SCOOP_EDGES } from '@/shared/types/bin';
import { resolveScoop } from './cutoutScoopHelpers';
import { fingerBottom } from './fingerAccess';

function cut(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'f',
    shape: 'slot',
    x: 0,
    y: 0,
    width: 20,
    depth: 40,
    cutDepth: 12,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

describe('fingerBottom', () => {
  it.each(['slot', 'circle'] as const)('reads the bottom of a %s finger cut', (shape) => {
    expect(fingerBottom(cut({ shape, finger: { bottom: 'flat' } }))).toBe('flat');
  });

  it('is null for a cut without the role, or a shape that cannot take it', () => {
    expect(fingerBottom(cut())).toBeNull();
    expect(fingerBottom(cut({ shape: 'rectangle', finger: { bottom: 'curved' } }))).toBeNull();
  });
});

describe('resolveScoop on a finger cut', () => {
  it('gives a curved cut the deepest fillet that fits, on every edge', () => {
    const curved = cut({ finger: { bottom: 'curved' }, scoopRadiusW: 2, scoopRadiusD: 2 });
    expect(resolveScoop(curved, 12)).toEqual({ w: 9.99, d: 9.99, edges: DEFAULT_SCOOP_EDGES });
  });

  it('caps a shallow curved cut at its depth', () => {
    const shallow = resolveScoop(cut({ finger: { bottom: 'curved' } }), 4);
    expect(shallow.w).toBeCloseTo(3.99, 6);
  });

  // The fillet would climb into the entry edge's loft, which the kernel refuses.
  it('stops below the entry edge', () => {
    const edged = cut({ finger: { bottom: 'curved' }, chamferWidth: 1, entryProfile: 'round' });
    expect(resolveScoop(edged, 9).w).toBeCloseTo(7.99, 6);
  });

  it('leaves a flat cut on its own scoop settings', () => {
    const flat = cut({ finger: { bottom: 'flat' }, scoopRadiusW: 2, scoopRadiusD: 2 });
    expect(resolveScoop(flat, 12)).toEqual(
      resolveScoop(cut({ scoopRadiusW: 2, scoopRadiusD: 2 }), 12)
    );
  });
});
