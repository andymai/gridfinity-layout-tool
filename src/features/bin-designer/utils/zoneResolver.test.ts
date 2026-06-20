import { describe, it, expect } from 'vitest';
import { buildZoneResolver } from './zoneResolver';
import type { ColorZone } from '../types/featureColors';

describe('buildZoneResolver', () => {
  it('resolves a triangle index to its precomputed zone', () => {
    const triZones: ColorZone[] = ['body', 'scoop', 'lip:frontLeft:0', 'lip:backRight:1'];
    const resolver = buildZoneResolver(triZones);
    expect(resolver.resolve(0)).toBe('body');
    expect(resolver.resolve(1)).toBe('scoop');
    expect(resolver.resolve(2)).toBe('lip:frontLeft:0');
    expect(resolver.resolve(3)).toBe('lip:backRight:1');
  });

  it('falls back to body for an out-of-range index', () => {
    const resolver = buildZoneResolver(['scoop']);
    expect(resolver.resolve(5)).toBe('body');
  });
});
