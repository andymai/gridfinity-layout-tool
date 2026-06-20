import { describe, expect, it } from 'vitest';
import { ZONE_ORDER } from '../types/featureColors';
import { zoneColorPatch, zoneTranslationKey } from './zoneLabels';

describe('zoneLabels', () => {
  it('produces a non-empty translation key for every ColorZone', () => {
    // Lip cells intentionally share a corner label (band isn't in the key), so
    // keys aren't unique per zone — but every zone must resolve to some key.
    for (const zone of ZONE_ORDER) expect(zoneTranslationKey(zone)).toBeTruthy();
  });

  it('gives non-lip zones distinct keys', () => {
    const nonLip = ZONE_ORDER.filter((z) => !z.startsWith('lip:'));
    const keys = nonLip.map(zoneTranslationKey);
    expect(new Set(keys).size).toBe(nonLip.length);
  });

  it('zoneColorPatch maps non-lip zones to flat updateFeatureColors patches', () => {
    expect(zoneColorPatch('body', '#abcdef')).toEqual({ body: '#abcdef' });
    expect(zoneColorPatch('base', '#abcdef')).toEqual({ base: '#abcdef' });
    expect(zoneColorPatch('scoop', '#abcdef')).toEqual({ scoop: '#abcdef' });
    expect(zoneColorPatch('dividers', '#abcdef')).toEqual({ dividers: '#abcdef' });
    expect(zoneColorPatch('labelTab', '#abcdef')).toEqual({ labelTab: '#abcdef' });
  });

  it('zoneColorPatch writes a single lip cell (no mirroring)', () => {
    // Lip cells are independent zones now; the patch targets just the one
    // canonical cell the resolver returned.
    expect(zoneColorPatch('lip:frontLeft:0', '#aa0000')).toEqual({
      lip: { cells: { 'lip:frontLeft:0': '#aa0000' } },
    });
    expect(zoneColorPatch('lip:backRight:2', '#bb0000')).toEqual({
      lip: { cells: { 'lip:backRight:2': '#bb0000' } },
    });
  });
});
