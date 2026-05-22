import { describe, it, expect } from 'vitest';
import { FeatureTag } from '@/shared/types/generation';
import {
  ZONE_ORDER,
  featureTagToColorZone,
  getZoneColor,
  isSingleColor,
  lipCornerZone,
  resolveColorMapping,
} from './featureColors';
import type { FeatureColorConfig, LipCorner } from './featureColors';

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
      body: '#aaa',
      lip: { frontLeft: '#aaa', frontRight: '#aaa', backRight: '#aaa', backLeft: '#aaa' },
      labelTab: '#aaa',
      base: '#bbb',
      scoop: '#aaa',
      dividers: '#aaa',
      text: '#aaa',
    };
    const { colors: palette, colorToIndex, defaultIndex } = resolveColorMapping(c);
    expect(defaultIndex).toBe(0);
    expect(palette).toEqual(['#aaa', '#bbb']);
    expect(colorToIndex.get('#aaa')).toBe(0);
    expect(colorToIndex.get('#bbb')).toBe(1);
  });

  it('emits four distinct slots when all lip corners differ', () => {
    const c = colors({
      lip: { frontLeft: '#1', frontRight: '#2', backRight: '#3', backLeft: '#4' },
    });
    const { colors: palette } = resolveColorMapping(c);
    expect(palette).toEqual(expect.arrayContaining(['#1', '#2', '#3', '#4']));
  });

  it('normalizes hex to lowercase so mixed-case zones dedupe', () => {
    // Without normalization the exporter would emit two materials for what
    // is the same color, breaking lockstep with the slicer-handoff preview
    // (which already lowercased before deduping). Mirrors the `displaycolor`
    // convention slicers expect.
    const c: FeatureColorConfig = {
      enabled: false,
      body: '#FFF',
      lip: { frontLeft: '#fff', frontRight: '#fff', backRight: '#fff', backLeft: '#fff' },
      labelTab: '#FFF',
      base: '#fff',
      scoop: '#FFF',
      dividers: '#fff',
      text: '#FFF',
    };
    const { colors: palette, colorToIndex } = resolveColorMapping(c);
    expect(palette).toEqual(['#fff']);
    expect(colorToIndex.get('#fff')).toBe(0);
  });
});
