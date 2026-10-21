import { describe, it, expect } from 'vitest';
import type { BinParams, CompartmentConfig, LabelTabConfig } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import {
  blankCaptionSlot,
  placementCaption,
  takesPlacedTabCaption,
  withPlacedCaption,
  withPlacedTabCaption,
} from './placedCaption';

function design(
  compartments: Partial<CompartmentConfig> = {},
  label: Partial<LabelTabConfig> = {},
  extra: Partial<BinParams> = {}
): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 1,
    height: 4,
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, ...label },
    compartments: { ...DEFAULT_BIN_PARAMS.compartments, ...compartments },
    ...extra,
  };
}

/** Four columns on a 2-unit bin: no compartment fits a plate, so the row stands in. */
const NARROW_COLUMNS: Partial<CompartmentConfig> = { cols: 4, rows: 1, cells: [0, 1, 2, 3] };
const SOCKET: Partial<LabelTabConfig> = { mode: 'socket', depth: 14 };

describe('withPlacedCaption', () => {
  it('captions a single blank compartment with the trimmed bin label', () => {
    const params = design();
    const captioned = withPlacedCaption(params, '  Screws ');
    expect(captioned.compartments.compartmentTexts).toEqual(['Screws']);
    expect(params.compartments.compartmentTexts).toBeUndefined();
  });

  it('fills a blank entry the design already stores', () => {
    const params = design({ compartmentTexts: ['  '] });
    expect(withPlacedCaption(params, 'Bolts').compartments.compartmentTexts).toEqual(['Bolts']);
  });

  it.each([
    ['an empty label', design(), ''],
    ['a whitespace label', design(), '   '],
    ['a design with its own caption', design({ compartmentTexts: ['NUTS'] }), 'Screws'],
    ['label tabs switched off', design({}, { enabled: false }), 'Screws'],
    [
      'several compartments',
      design({ cols: 2, rows: 1, cells: [0, 1], compartmentTexts: ['', ''] }),
      'Screws',
    ],
    ['a slotted body, which builds no tabs', design({}, {}, { style: 'slotted' }), 'Screws'],
    [
      'a custom footprint, which builds no tabs',
      design({}, {}, { cellMask: { cols: 4, rows: 2, cells: [1, 1, 1, 1, 1, 1, 0, 0] } }),
      'Screws',
    ],
  ])('returns the same params for %s', (_name, params, label) => {
    expect(withPlacedCaption(params, label)).toBe(params);
  });

  it('captions the one row a spanning design hosts a tab on', () => {
    const params = design({ cols: 3, rows: 1, cells: [0, 1, 2] }, { span: true });
    const captioned = withPlacedCaption(params, 'Cables');
    expect(captioned.label.rowTexts).toEqual(['Cables']);
    expect(captioned.compartments).toBe(params.compartments);
  });

  it('finds the hosting row when a merged compartment leaves only one', () => {
    // One compartment over two rows: only the back row has a wall to hang from.
    const params = design({ cols: 1, rows: 2, cells: [0, 0] }, { span: true });
    expect(blankCaptionSlot(params)).toEqual({ scope: 'row', index: 1 });
    expect(withPlacedCaption(params, 'Cables').label.rowTexts).toEqual(['', 'Cables']);
  });

  it('leaves a spanning design with a tab on every row alone', () => {
    const params = design({ cols: 1, rows: 2, cells: [0, 1] }, { span: true, depth: 8 });
    expect(blankCaptionSlot(params)).toBeNull();
  });

  it('captions the forced row of a socket design whose compartments fit no plate', () => {
    const params = design(NARROW_COLUMNS, SOCKET);
    expect(blankCaptionSlot(params, 0.4)).toEqual({ scope: 'row', index: 0 });
    expect(withPlacedCaption(params, 'Nails', 0.4).label.rowTexts).toEqual(['Nails']);
  });

  it('captions a single-compartment socket design', () => {
    const params = design({}, SOCKET);
    expect(withPlacedCaption(params, 'Nails', 0.4).compartments.compartmentTexts).toEqual([
      'Nails',
    ]);
  });
});

describe('withPlacedTabCaption', () => {
  it('captions the tab of a text-mode design', () => {
    expect(withPlacedTabCaption(design(), 'Screws').compartments.compartmentTexts).toEqual([
      'Screws',
    ]);
  });

  it('leaves a socket design alone, whose caption prints on the plate', () => {
    const params = design({}, SOCKET);
    expect(withPlacedTabCaption(params, 'Screws')).toBe(params);
  });

  it('is announced by takesPlacedTabCaption before any label is known', () => {
    expect(takesPlacedTabCaption(design())).toBe(true);
    expect(takesPlacedTabCaption(design({ compartmentTexts: ['NUTS'] }))).toBe(false);
    expect(takesPlacedTabCaption(design({}, SOCKET))).toBe(false);
  });
});

describe('placementCaption', () => {
  it('trims a label and reads a blank one as none', () => {
    expect(placementCaption(' Screws ')).toBe('Screws');
    expect(placementCaption('  ')).toBeNull();
  });
});
