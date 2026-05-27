import { describe, it, expect } from 'vitest';
import { FeatureTag } from '@/shared/types/generation';
import {
  ZONE_ORDER,
  computeActiveZones,
  featureTagToColorZone,
  getZoneColor,
  isSingleColor,
  lipCornerZone,
  resolveColorMapping,
} from './featureColors';
import type { ActiveZonesParams, FeatureColorConfig, LipCorner } from './featureColors';

const SINGLE = '#d4d8dc';

function colors(overrides: Partial<FeatureColorConfig> = {}): FeatureColorConfig {
  return {
    enabled: false,
    body: SINGLE,
    lip: { frontLeft: SINGLE, frontRight: SINGLE, backRight: SINGLE, backLeft: SINGLE },
    labelTab: SINGLE,
    base: SINGLE,
    scoop: SINGLE,
    dividers: SINGLE,
    text: SINGLE,
    lid: SINGLE,
    ...overrides,
  };
}

describe('featureTagToColorZone', () => {
  it('returns null for LIP (caller must resolve per-corner)', () => {
    expect(featureTagToColorZone(FeatureTag.LIP)).toBeNull();
  });

  it('maps tagged faces to their zones', () => {
    expect(featureTagToColorZone(FeatureTag.LABEL_TAB)).toBe('labelTab');
    expect(featureTagToColorZone(FeatureTag.SOCKET)).toBe('base');
    expect(featureTagToColorZone(FeatureTag.SCOOP)).toBe('scoop');
    expect(featureTagToColorZone(FeatureTag.DIVIDER)).toBe('dividers');
  });

  it.each([
    ['BASE', FeatureTag.BASE],
    ['WALL_CUTOUT', FeatureTag.WALL_CUTOUT],
    ['SLOT', FeatureTag.SLOT],
    ['INSERT', FeatureTag.INSERT],
    ['CUTOUT', FeatureTag.CUTOUT],
    ['WALL_PATTERN', FeatureTag.WALL_PATTERN],
    ['HANDLE', FeatureTag.HANDLE],
    ['UNKNOWN', FeatureTag.UNKNOWN],
  ] as const)('maps %s to body zone', (_name, tag) => {
    expect(featureTagToColorZone(tag)).toBe('body');
  });
});

describe('getZoneColor', () => {
  it('returns the matching hex for each non-lip zone', () => {
    const c = colors({
      body: '#111',
      labelTab: '#222',
      base: '#333',
      scoop: '#444',
      dividers: '#555',
    });
    expect(getZoneColor(c, 'body')).toBe('#111');
    expect(getZoneColor(c, 'labelTab')).toBe('#222');
    expect(getZoneColor(c, 'base')).toBe('#333');
    expect(getZoneColor(c, 'scoop')).toBe('#444');
    expect(getZoneColor(c, 'dividers')).toBe('#555');
  });

  it('returns the matching hex for each lip corner', () => {
    const c = colors({
      lip: { frontLeft: '#fl', frontRight: '#fr', backRight: '#br', backLeft: '#bl' },
    });
    expect(getZoneColor(c, 'lip:frontLeft')).toBe('#fl');
    expect(getZoneColor(c, 'lip:frontRight')).toBe('#fr');
    expect(getZoneColor(c, 'lip:backRight')).toBe('#br');
    expect(getZoneColor(c, 'lip:backLeft')).toBe('#bl');
  });
});

describe('lipCornerZone', () => {
  it.each<[LipCorner, ReturnType<typeof lipCornerZone>]>([
    ['frontLeft', 'lip:frontLeft'],
    ['frontRight', 'lip:frontRight'],
    ['backRight', 'lip:backRight'],
    ['backLeft', 'lip:backLeft'],
  ])('composes lip:%s', (corner, expected) => {
    expect(lipCornerZone(corner)).toBe(expected);
  });
});

describe('isSingleColor', () => {
  it('returns true when all zones equal body', () => {
    expect(isSingleColor(colors(), ZONE_ORDER)).toBe(true);
  });

  it('returns false when any lip corner differs', () => {
    const c = colors({
      lip: { frontLeft: '#ff0000', frontRight: SINGLE, backRight: SINGLE, backLeft: SINGLE },
    });
    expect(isSingleColor(c, ZONE_ORDER)).toBe(false);
  });

  it('treats mixed-case hex as the same color', () => {
    // Locks in case-insensitive equality so this gate stays consistent
    // with `resolveColorMapping`'s lowercase deduplication.
    const c = colors({ body: '#FFF', labelTab: '#fff', text: '#FFF' });
    expect(isSingleColor(c, ['body', 'labelTab', 'text'])).toBe(true);
  });

  it("respects activeZones — disabled lip corners with different colors don't count", () => {
    // The user changed the lip color, then turned off the stacking lip.
    // Lip corners aren't active any more, so the bin is single-color from
    // the slicer's perspective.
    const c = colors({
      lip: { frontLeft: '#ff0000', frontRight: '#00ff00', backRight: '#0000ff', backLeft: '#fff' },
    });
    expect(isSingleColor(c, new Set(['body', 'base']))).toBe(true);
  });
});

describe('resolveColorMapping', () => {
  it('puts body at index 0 and dedupes equal colors', () => {
    const c: FeatureColorConfig = {
      enabled: false,
      body: '#aaaaaa',
      lip: {
        frontLeft: '#aaaaaa',
        frontRight: '#aaaaaa',
        backRight: '#aaaaaa',
        backLeft: '#aaaaaa',
      },
      labelTab: '#aaaaaa',
      base: '#bbbbbb',
      scoop: '#aaaaaa',
      dividers: '#aaaaaa',
      text: '#aaaaaa',
      lid: '#aaaaaa',
    };
    const { colors: palette, colorToIndex, defaultIndex } = resolveColorMapping(c);
    expect(defaultIndex).toBe(0);
    expect(palette).toEqual(['#aaaaaa', '#bbbbbb']);
    expect(colorToIndex.get('#aaaaaa')).toBe(0);
    expect(colorToIndex.get('#bbbbbb')).toBe(1);
  });

  it('emits four distinct slots when all lip corners differ', () => {
    const c = colors({
      lip: {
        frontLeft: '#111111',
        frontRight: '#222222',
        backRight: '#333333',
        backLeft: '#444444',
      },
    });
    const { colors: palette } = resolveColorMapping(c);
    expect(palette).toEqual(expect.arrayContaining(['#111111', '#222222', '#333333', '#444444']));
  });

  it('normalizes case AND expands 3-char shorthand so equivalent hex dedupes', () => {
    // Picker emits 6-char lowercase, but legacy/imported designs may carry
    // CSS-style shorthand or mixed case. Without normalization the exporter
    // would spuriously emit two materials for what is the same color.
    const c: FeatureColorConfig = {
      enabled: false,
      body: '#FFF',
      lip: { frontLeft: '#fff', frontRight: '#FFFFFF', backRight: '#ffffff', backLeft: '#FfF' },
      labelTab: '#fFf',
      base: '#FFFFFF',
      scoop: '#fff',
      dividers: '#FfFfFf',
      text: '#FFF',
      lid: '#FFF',
    };
    const { colors: palette, colorToIndex } = resolveColorMapping(c);
    expect(palette).toEqual(['#ffffff']);
    expect(colorToIndex.get('#ffffff')).toBe(0);
  });
});

describe('computeActiveZones — lid gate', () => {
  const baseParams: ActiveZonesParams = {
    base: { style: 'standard', stackingLip: false },
    label: { enabled: false },
    scoop: { enabled: false },
    lid: { enabled: false },
    compartments: { cells: [0] },
  };

  it('omits lid when toggle is off', () => {
    expect(computeActiveZones(baseParams).has('lid')).toBe(false);
  });

  it('omits lid when toggle is on but stacking lip is off (lid mesh would not generate)', () => {
    const zones = computeActiveZones({
      ...baseParams,
      lid: { enabled: true },
      base: { style: 'standard', stackingLip: false },
    });
    // No lid color row appears for a config where the lid can't actually
    // print — `shouldGenerateLid` requires a stacking lip for the click
    // rails to land on.
    expect(zones.has('lid')).toBe(false);
  });

  it('adds lid when toggle is on AND stacking lip is present', () => {
    const zones = computeActiveZones({
      ...baseParams,
      lid: { enabled: true },
      base: { style: 'standard', stackingLip: true },
    });
    expect(zones.has('lid')).toBe(true);
  });
});
