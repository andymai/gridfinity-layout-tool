import { describe, it, expect } from 'vitest';
import { FeatureTag } from '@/shared/types/generation';
import {
  LIP_CELL_ZONES,
  ZONE_ORDER,
  activeCornerColumns,
  activeLipCells,
  computeActiveZones,
  featureTagToColorZone,
  getZoneColor,
  isSingleColor,
  lipCellZone,
  lipCellsUniform,
  makeUniformLipCells,
  maxZOfVertices,
  normalizePaletteLip,
  parseLipCell,
  resolveColorMapping,
  topAccentCutZ,
  zoneIndex,
} from './featureColors';
import type { ActiveZonesParams, FeatureColorConfig, LipColorConfig } from './featureColors';

const SINGLE = '#d4d8dc';

function lip(
  cells: Record<string, string> = {},
  corners: 1 | 2 | 4 = 1,
  bands: 1 | 2 | 4 = 1
): LipColorConfig {
  return { corners, bands, cells: { ...makeUniformLipCells(SINGLE), ...cells } };
}

function colors(overrides: Partial<FeatureColorConfig> = {}): FeatureColorConfig {
  return {
    enabled: false,
    body: SINGLE,
    lip: lip(),
    labelTab: SINGLE,
    base: SINGLE,
    scoop: SINGLE,
    dividers: SINGLE,
    text: SINGLE,
    lid: SINGLE,
    topAccent: { enabled: false, heightMm: 2, color: SINGLE },
    ...overrides,
  };
}

describe('featureTagToColorZone', () => {
  it('returns null for LIP (caller must resolve per-cell)', () => {
    expect(featureTagToColorZone(FeatureTag.LIP)).toBeNull();
  });

  it('maps tagged faces to their zones', () => {
    expect(featureTagToColorZone(FeatureTag.LABEL_TAB)).toBe('labelTab');
    expect(featureTagToColorZone(FeatureTag.SOCKET)).toBe('base');
    expect(featureTagToColorZone(FeatureTag.SCOOP)).toBe('scoop');
    expect(featureTagToColorZone(FeatureTag.DIVIDER)).toBe('dividers');
    expect(featureTagToColorZone(FeatureTag.TEXT)).toBe('text');
  });

  it.each([
    ['BASE', FeatureTag.BASE],
    ['UNKNOWN', FeatureTag.UNKNOWN],
  ] as const)('maps %s to body zone', (_name, tag) => {
    expect(featureTagToColorZone(tag)).toBe('body');
  });
});

describe('lip cell helpers', () => {
  it('lipCellZone composes the id', () => {
    expect(lipCellZone('frontLeft', 0)).toBe('lip:frontLeft:0');
    expect(lipCellZone('backRight', 3)).toBe('lip:backRight:3');
  });

  it('parseLipCell round-trips valid ids and rejects others', () => {
    expect(parseLipCell('lip:frontRight:2')).toEqual({ corner: 'frontRight', band: 2 });
    expect(parseLipCell('body')).toBeNull();
    expect(parseLipCell('lip:frontRight:9')).toBeNull();
    expect(parseLipCell('lip:nope:0')).toBeNull();
  });

  it('makeUniformLipCells fills all 16 cells', () => {
    const cells = makeUniformLipCells('#abcdef');
    expect(Object.keys(cells)).toHaveLength(16);
    expect(LIP_CELL_ZONES.every((id) => cells[id] === '#abcdef')).toBe(true);
  });
});

describe('ZONE_ORDER', () => {
  it('contains all 16 lip cells with stable indices and body at 0', () => {
    expect(zoneIndex('body')).toBe(0);
    expect(new Set(ZONE_ORDER).size).toBe(ZONE_ORDER.length);
    for (const id of LIP_CELL_ZONES) expect(ZONE_ORDER).toContain(id);
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

  it('returns the cell color for a lip cell, falling back to body', () => {
    const c = colors({ lip: lip({ 'lip:frontLeft:0': '#fl', 'lip:backRight:2': '#br' }) });
    expect(getZoneColor(c, 'lip:frontLeft:0')).toBe('#fl');
    expect(getZoneColor(c, 'lip:backRight:2')).toBe('#br');
  });
});

describe('activeCornerColumns', () => {
  it('returns the active corner columns left→right', () => {
    expect(activeCornerColumns(1)).toEqual(['frontLeft']);
    expect(activeCornerColumns(2)).toEqual(['frontLeft', 'backLeft']);
    expect(activeCornerColumns(4)).toHaveLength(4);
  });
});

describe('activeLipCells', () => {
  it('returns corners × bands canonical cells', () => {
    expect(activeLipCells({ corners: 1, bands: 1 })).toEqual(['lip:frontLeft:0']);
    expect(activeLipCells({ corners: 2, bands: 1 })).toEqual(['lip:frontLeft:0', 'lip:backLeft:0']);
    expect(activeLipCells({ corners: 1, bands: 2 })).toEqual([
      'lip:frontLeft:0',
      'lip:frontLeft:1',
    ]);
    expect(activeLipCells({ corners: 4, bands: 4 })).toHaveLength(16);
  });
});

describe('lipCellsUniform', () => {
  it('is true for 1×1 and for a multi-cell grid whose active cells match', () => {
    expect(lipCellsUniform(lip())).toBe(true);
    expect(lipCellsUniform(lip(makeUniformLipCells('#112233'), 2, 2))).toBe(true);
  });

  it('is false when an active cell differs, and ignores inactive cells', () => {
    expect(lipCellsUniform(lip({ 'lip:backLeft:0': '#ff0000' }, 2, 1))).toBe(false);
    // The differing cell is inactive at 1×1, so the grid still reads uniform.
    expect(lipCellsUniform(lip({ 'lip:backRight:3': '#ff0000' }, 1, 1))).toBe(true);
  });
});

describe('isSingleColor', () => {
  it('returns true when all zones equal body', () => {
    expect(isSingleColor(colors(), ZONE_ORDER)).toBe(true);
  });

  it('returns false when any lip cell differs', () => {
    const c = colors({ lip: lip({ 'lip:frontLeft:0': '#ff0000' }) });
    expect(isSingleColor(c, ZONE_ORDER)).toBe(false);
  });

  it('treats mixed-case hex as the same color', () => {
    const c = colors({ body: '#FFF', labelTab: '#fff', text: '#FFF' });
    expect(isSingleColor(c, ['body', 'labelTab', 'text'])).toBe(true);
  });

  it("respects activeZones — a differing cell that isn't active doesn't count", () => {
    const c = colors({ lip: lip({ 'lip:frontLeft:0': '#ff0000' }) });
    // Lip not active → single color from the slicer's perspective.
    expect(isSingleColor(c, new Set(['body', 'base']))).toBe(true);
  });
});

describe('resolveColorMapping', () => {
  it('puts body at index 0 and dedupes equal colors', () => {
    const c: FeatureColorConfig = {
      enabled: false,
      body: '#aaaaaa',
      lip: { corners: 1, bands: 1, cells: makeUniformLipCells('#aaaaaa') },
      labelTab: '#aaaaaa',
      base: '#bbbbbb',
      scoop: '#aaaaaa',
      dividers: '#aaaaaa',
      text: '#aaaaaa',
      lid: '#aaaaaa',
      topAccent: { enabled: false, heightMm: 2, color: '#aaaaaa' },
    };
    const { colors: palette, colorToIndex, defaultIndex } = resolveColorMapping(c);
    expect(defaultIndex).toBe(0);
    expect(palette).toEqual(['#aaaaaa', '#bbbbbb']);
    expect(colorToIndex.get('#aaaaaa')).toBe(0);
    expect(colorToIndex.get('#bbbbbb')).toBe(1);
  });

  it('emits distinct slots when lip cells differ', () => {
    const c = colors({
      lip: lip({
        'lip:frontLeft:0': '#111111',
        'lip:frontRight:0': '#222222',
        'lip:backRight:0': '#333333',
        'lip:backLeft:0': '#444444',
      }),
    });
    const { colors: palette } = resolveColorMapping(c);
    expect(palette).toEqual(expect.arrayContaining(['#111111', '#222222', '#333333', '#444444']));
  });
});

describe('normalizePaletteLip', () => {
  it('coerces a legacy 4-corner palette to a uniform 1×1 grid', () => {
    const result = normalizePaletteLip(
      { frontLeft: '#ff0000', frontRight: '#ff0000', backRight: '#ff0000', backLeft: '#ff0000' },
      '#000000'
    );
    expect(result.corners).toBe(1);
    expect(result.bands).toBe(1);
    expect(result.cells['lip:frontLeft:0']).toBe('#ff0000');
  });

  it('passes through a grid palette and clamps counts', () => {
    const result = normalizePaletteLip(
      { corners: 4, bands: 2, cells: { 'lip:backRight:1': '#abcdef' } },
      '#000000'
    );
    expect(result.corners).toBe(4);
    expect(result.bands).toBe(2);
    expect(result.cells['lip:backRight:1']).toBe('#abcdef');
    expect(result.cells['lip:frontLeft:0']).toBe('#000000');
  });
});

describe('computeActiveZones', () => {
  const baseParams: ActiveZonesParams = {
    base: { style: 'standard', stackingLip: false },
    label: { enabled: false },
    scoop: { enabled: false },
    lid: { enabled: false },
    compartments: { cells: [0] },
  };

  it('omits lid when stacking lip is off', () => {
    expect(computeActiveZones({ ...baseParams, lid: { enabled: true } }).has('lid')).toBe(false);
  });

  it('adds lid when toggle is on AND stacking lip is present', () => {
    const zones = computeActiveZones({
      ...baseParams,
      lid: { enabled: true },
      base: { style: 'standard', stackingLip: true },
    });
    expect(zones.has('lid')).toBe(true);
  });

  it('adds exactly corners × bands lip cells when stacking lip is on', () => {
    const zones = computeActiveZones({
      ...baseParams,
      base: { style: 'standard', stackingLip: true },
      featureColors: { lip: { corners: 2, bands: 2 } },
    });
    const lipCells = [...zones].filter((z) => z.startsWith('lip:'));
    expect(lipCells).toHaveLength(4);
    expect(zones.has('lip:frontLeft:0')).toBe(true);
    expect(zones.has('lip:backLeft:1')).toBe(true);
  });

  it('defaults to a single lip cell when no grid is supplied', () => {
    const zones = computeActiveZones({
      ...baseParams,
      base: { style: 'standard', stackingLip: true },
    });
    const lipCells = [...zones].filter((z) => z.startsWith('lip:'));
    expect(lipCells).toEqual(['lip:frontLeft:0']);
  });

  it('adds topAccent when enabled with positive height, independent of the lip', () => {
    const zones = computeActiveZones({
      ...baseParams,
      base: { style: 'flat', stackingLip: false },
      featureColors: { lip: { corners: 1, bands: 1 }, topAccent: { enabled: true, heightMm: 2 } },
    });
    expect(zones.has('topAccent')).toBe(true);
  });

  it('omits topAccent when disabled or zero height', () => {
    const disabled = computeActiveZones({
      ...baseParams,
      featureColors: { lip: { corners: 1, bands: 1 }, topAccent: { enabled: false, heightMm: 2 } },
    });
    expect(disabled.has('topAccent')).toBe(false);
    const zeroHeight = computeActiveZones({
      ...baseParams,
      featureColors: { lip: { corners: 1, bands: 1 }, topAccent: { enabled: true, heightMm: 0 } },
    });
    expect(zeroHeight.has('topAccent')).toBe(false);
  });
});

describe('maxZOfVertices', () => {
  it('returns the highest z across a flat xyz buffer', () => {
    // x,y,z interleaved; z values 3, 9, 1.
    const v = new Float32Array([0, 0, 3, 1, 1, 9, 2, 2, 1]);
    expect(maxZOfVertices(v)).toBe(9);
  });

  it('returns -Infinity for an empty buffer', () => {
    expect(maxZOfVertices(new Float32Array([]))).toBe(-Infinity);
  });
});

describe('topAccentCutZ', () => {
  it('hangs the band down from the mesh top', () => {
    expect(topAccentCutZ({ enabled: true, heightMm: 2, color: '#000' }, 25)).toBe(23);
  });

  it('returns null when disabled, non-positive, or the mesh top is not finite', () => {
    expect(topAccentCutZ({ enabled: false, heightMm: 2, color: '#000' }, 25)).toBeNull();
    expect(topAccentCutZ({ enabled: true, heightMm: 0, color: '#000' }, 25)).toBeNull();
    expect(topAccentCutZ({ enabled: true, heightMm: 2, color: '#000' }, -Infinity)).toBeNull();
  });
});
