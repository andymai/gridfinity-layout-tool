import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '../constants';
import { makeUniformLipCells } from '../types/featureColors';
import type { BinParams, Cutout } from '../types';
import { contrastingTextColor, flatTextSurfaces, hiddenFlatTextSurfaces } from './flatTextContrast';

const LIGHT = '#d4d8dc';

function design(over: Partial<BinParams> = {}, colors: Partial<BinParams['featureColors']> = {}) {
  return {
    ...DEFAULT_BIN_PARAMS,
    textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, mode: 'flat' as const },
    featureColors: {
      ...DEFAULT_BIN_PARAMS.featureColors,
      enabled: true,
      body: LIGHT,
      labelTab: LIGHT,
      lid: LIGHT,
      text: LIGHT,
      ...colors,
    },
    ...over,
  } satisfies BinParams;
}

const tabs = (texts: string[], label: Partial<BinParams['label']> = {}): Partial<BinParams> => ({
  label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, ...label },
  compartments: {
    ...DEFAULT_BIN_PARAMS.compartments,
    cols: texts.length,
    rows: 1,
    cells: texts.map((_, i) => i),
    compartmentTexts: texts,
  },
});

const cutout = (over: Partial<Cutout> = {}): Cutout => ({
  id: 'c1',
  shape: 'rectangle',
  x: 5,
  y: 5,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: 'M4',
  engraveLabel: true,
  groupId: null,
  ...over,
});

describe('flatTextSurfaces', () => {
  it('names the surface each flat caption sits on', () => {
    expect([...flatTextSurfaces(design(tabs(['BOLTS', ''])))]).toEqual(['labelTab']);
    expect([...flatTextSurfaces(design({ surfaceText: { walls: { front: 'AB' } } }))]).toEqual([
      'body',
    ]);
    expect([...flatTextSurfaces(design({ cutouts: [cutout()] }))]).toEqual(['body']);
    const lid = design({
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
      surfaceText: { lidText: 'TOOLS' },
    });
    expect([...flatTextSurfaces(lid)]).toEqual(['lid']);
  });

  it('puts swappable plates on the label-tab colour, icons included', () => {
    const plates = design({
      ...tabs(['', '']),
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, mode: 'socket' },
      compartments: {
        ...DEFAULT_BIN_PARAMS.compartments,
        cols: 2,
        rows: 1,
        cells: [0, 1],
        compartmentTexts: ['', ''],
        labelIcons: ['bolt', null],
      },
    });
    expect([...flatTextSurfaces(plates)]).toEqual(['labelTab']);
    const cutoutPlate = design({ cutouts: [cutout({ labelMode: 'socket' })] });
    expect([...flatTextSurfaces(cutoutPlate)]).toEqual(['labelTab']);
  });

  it('ignores text that is not flat or will not be built', () => {
    const engraved = design({
      ...tabs(['BOLTS']),
      textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, mode: 'engrave' },
    });
    expect(flatTextSurfaces(engraved).size).toBe(0);
    const gridTop = design({
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true },
      surfaceText: { lidText: 'TOOLS' },
    });
    expect(flatTextSurfaces(gridTop).size).toBe(0);
  });
});

describe('hiddenFlatTextSurfaces', () => {
  const tabbed = (text: string, labelTab = LIGHT) => design(tabs(['BOLTS']), { text, labelTab });

  it('flags a Text colour identical or nearly identical to the surface', () => {
    expect(hiddenFlatTextSurfaces(tabbed(LIGHT))).toEqual(['labelTab']);
    expect(hiddenFlatTextSurfaces(tabbed('#d0d4d8'))).toEqual(['labelTab']);
    expect(hiddenFlatTextSurfaces(tabbed('#1a1a1a'))).toEqual([]);
  });

  it('narrows to one host when asked', () => {
    const both = design({ ...tabs(['BOLTS']), surfaceText: { walls: { front: 'AB' } } });
    expect(hiddenFlatTextSurfaces(both, ['body'])).toEqual(['body']);
  });
});

describe('contrastingTextColor', () => {
  it('reuses a design colour that reads on the surface', () => {
    const p = design(tabs(['BOLTS']), { body: '#202020' });
    expect(contrastingTextColor(p, ['labelTab'])).toBe('#202020');
  });

  it('falls back to black or white when no design colour stands out', () => {
    expect(contrastingTextColor(design(tabs(['BOLTS'])), ['labelTab'])).toBe('#000000');
    const D = '#202020';
    const dark = design(tabs(['BOLTS']), {
      body: D,
      labelTab: D,
      text: D,
      base: D,
      lip: { ...DEFAULT_BIN_PARAMS.featureColors.lip, cells: makeUniformLipCells(D) },
    });
    expect(contrastingTextColor(dark, ['labelTab'])).toBe('#ffffff');
  });
});
