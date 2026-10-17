import { describe, expect, it } from 'vitest';

import { sanitizeBinFitFields } from './binFitValidation.js';

const taper = { profile: 'fillet', bandHeight: 12, enabled: true, flare: 3 };
const overhang = { enabled: true, left: 4.5, right: 0, front: 0, back: 21, feet: false };

describe('sanitizeBinFitFields', () => {
  it('keeps well-formed values exactly', () => {
    expect(
      sanitizeBinFitFields({
        clearanceHeight: 2,
        extendToMargin: true,
        marginTaper: taper,
        overhang,
      })
    ).toEqual({ clearanceHeight: 2, extendToMargin: true, marginTaper: taper, overhang });
  });

  it('returns nothing for a bin that carries none of them', () => {
    expect(sanitizeBinFitFields({ id: 'b', label: 'x' })).toEqual({});
  });

  it.each([
    ['a negative clearance', { clearanceHeight: -1 }],
    ['a non-finite clearance', { clearanceHeight: Number.POSITIVE_INFINITY }],
    ['a string clearance', { clearanceHeight: '2' }],
    ['a truthy non-boolean margin flag', { extendToMargin: 'yes' }],
    ['a false margin flag', { extendToMargin: false }],
    ['an unknown taper profile', { marginTaper: { ...taper, profile: 'bevel' } }],
    ['a taper band past the ceiling', { marginTaper: { ...taper, bandHeight: 351 } }],
    ['a taper without a band', { marginTaper: { profile: 'chamfer' } }],
    ['an overhang side past one grid unit', { overhang: { ...overhang, back: 43 } }],
    ['a negative overhang side', { overhang: { ...overhang, left: -1 } }],
    ['an overhang missing a side', { overhang: { left: 1, right: 1, front: 1 } }],
    ['an array overhang', { overhang: [1, 1, 1, 1] }],
  ])('drops %s', (_name, bin) => {
    expect(sanitizeBinFitFields(bin)).toEqual({});
  });

  it('drops only the malformed optional parts of a taper and an overhang', () => {
    expect(
      sanitizeBinFitFields({
        marginTaper: { profile: 'chamfer', bandHeight: 8, enabled: 'no', flare: 99 },
        overhang: { left: 1, right: 2, front: 3, back: 4, enabled: 1, feet: 'true' },
      })
    ).toEqual({
      marginTaper: { profile: 'chamfer', bandHeight: 8 },
      overhang: { left: 1, right: 2, front: 3, back: 4 },
    });
  });

  it('keeps one field when its neighbour is malformed', () => {
    expect(sanitizeBinFitFields({ clearanceHeight: 1.5, overhang: { left: 'wide' } })).toEqual({
      clearanceHeight: 1.5,
    });
  });

  it('drops keys a taper or overhang does not define', () => {
    const result = sanitizeBinFitFields({
      marginTaper: { ...taper, extra: 1 },
      overhang: { ...overhang, extra: 1 },
    });
    expect(Object.keys(result.marginTaper ?? {}).sort()).toEqual(
      ['bandHeight', 'enabled', 'flare', 'profile'].sort()
    );
    expect(result.overhang).not.toHaveProperty('extra');
  });
});
