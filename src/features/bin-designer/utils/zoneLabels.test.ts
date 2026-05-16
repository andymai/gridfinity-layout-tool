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

  it('zoneColorPatch mirrors any lip-corner zone into all four corner slots', () => {
    // Post per-corner-rollback: the lip is visually a single zone, so the
    // eyedropper patch for any specific corner mirrors across all four.
    expect(zoneColorPatch('lip:frontLeft', '#aa0000')).toEqual({
      lip: {
        frontLeft: '#aa0000',
        frontRight: '#aa0000',
        backRight: '#aa0000',
        backLeft: '#aa0000',
      },
    });
    expect(zoneColorPatch('lip:backRight', '#bb0000')).toEqual({
      lip: {
        frontLeft: '#bb0000',
        frontRight: '#bb0000',
        backRight: '#bb0000',
        backLeft: '#bb0000',
      },
    });
  });
});
