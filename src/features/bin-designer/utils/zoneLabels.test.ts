import { describe, expect, it } from 'vitest';
import { ZONE_ORDER } from '../types/featureColors';
import { zoneColorPatch, zoneLabel, zoneTranslationKey } from './zoneLabels';
import type { TFunction } from '@/i18n';

const fakeT: TFunction = (key, vars) => (vars ? `${key}|${JSON.stringify(vars)}` : key);

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

  it('zoneLabel appends the band number only when the lip has multiple bands', () => {
    // Single band: two cells differ only by corner, no band suffix.
    expect(zoneLabel('lip:frontLeft:0', fakeT, 1)).toBe('binDesigner.colors.zone.lip.frontLeft');
    // Multi-band: same corner, different bands must read differently.
    const band1 = zoneLabel('lip:frontLeft:0', fakeT, 2);
    const band2 = zoneLabel('lip:frontLeft:1', fakeT, 2);
    expect(band1).not.toBe(band2);
    expect(band1).toContain('binDesigner.colors.lip.bandN');
    expect(band1).toContain('"n":1');
    expect(band2).toContain('"n":2');
  });

  it('zoneLabel leaves non-lip zones unchanged regardless of band count', () => {
    expect(zoneLabel('body', fakeT, 4)).toBe('binDesigner.colors.zone.body');
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
