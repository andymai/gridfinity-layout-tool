import { describe, expect, it } from 'vitest';
import { ZONE_ORDER } from '../types/featureColors';
import { zoneColorPatch, zoneTranslationKey } from './zoneLabels';

describe('zoneLabels', () => {
  it('produces a unique translation key for every ColorZone', () => {
    const keys = ZONE_ORDER.map(zoneTranslationKey);
    expect(new Set(keys).size).toBe(ZONE_ORDER.length);
  });

  it('zoneColorPatch maps non-lip zones to flat updateFeatureColors patches', () => {
    expect(zoneColorPatch('body', '#abcdef')).toEqual({ body: '#abcdef' });
    expect(zoneColorPatch('base', '#abcdef')).toEqual({ base: '#abcdef' });
    expect(zoneColorPatch('scoop', '#abcdef')).toEqual({ scoop: '#abcdef' });
    expect(zoneColorPatch('dividers', '#abcdef')).toEqual({ dividers: '#abcdef' });
    expect(zoneColorPatch('labelTab', '#abcdef')).toEqual({ labelTab: '#abcdef' });
  });

  it('zoneColorPatch nests lip-corner zones under `lip`', () => {
    expect(zoneColorPatch('lip:frontLeft', '#aa0000')).toEqual({
      lip: { frontLeft: '#aa0000' },
    });
    expect(zoneColorPatch('lip:backRight', '#bb0000')).toEqual({
      lip: { backRight: '#bb0000' },
    });
  });
});
