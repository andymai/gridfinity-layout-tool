import { describe, it, expect } from 'vitest';
import { modifiedCategories } from './categoryModified';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';

const stock = (): Record<string, boolean> => ({
  shape: false,
  interior: false,
  features: false,
  style: false,
  print: false,
});

describe('modifiedCategories', () => {
  it('reports nothing modified for a stock bin', () => {
    expect(modifiedCategories({ ...DEFAULT_BIN_PARAMS })).toEqual(stock());
  });

  it.each(['featureColors', 'floorPattern', 'lid', 'base'] as const)(
    'reads a legacy design omitting %s as unmodified, not changed',
    (key) => {
      const { [key]: _omitted, ...params } = DEFAULT_BIN_PARAMS as unknown as Record<
        string,
        unknown
      >;
      expect(modifiedCategories(params as unknown as BinParams)).toEqual(stock());
    }
  );

  it('attributes dimensions to Shape', () => {
    expect(modifiedCategories({ ...DEFAULT_BIN_PARAMS, width: 4 })).toEqual({
      ...stock(),
      shape: true,
    });
  });

  it('attributes a base change to Shape under the task taxonomy', () => {
    expect(
      modifiedCategories({
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: !DEFAULT_BIN_PARAMS.base.stackingLip },
      })
    ).toEqual({ ...stock(), shape: true });
  });

  it('attributes a lid change to Features', () => {
    expect(
      modifiedCategories({
        ...DEFAULT_BIN_PARAMS,
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
      })
    ).toEqual({ ...stock(), features: true });
  });

  it('attributes an interior mode change to Interior', () => {
    expect(modifiedCategories({ ...DEFAULT_BIN_PARAMS, style: 'solid' })).toEqual({
      ...stock(),
      interior: true,
    });
  });

  it('attributes the wall pattern to Style', () => {
    expect(
      modifiedCategories({
        ...DEFAULT_BIN_PARAMS,
        wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true, pattern: 'honeycomb' },
      })
    ).toEqual({ ...stock(), style: true });
  });

  it('attributes surface text to Style, no longer excluded as cross-group', () => {
    expect(
      modifiedCategories({ ...DEFAULT_BIN_PARAMS, surfaceText: { walls: { front: 'Cables' } } })
    ).toEqual({ ...stock(), style: true });
  });

  it('attributes the units to Print', () => {
    expect(modifiedCategories({ ...DEFAULT_BIN_PARAMS, gridUnitMm: 40 })).toEqual({
      ...stock(),
      print: true,
    });
  });

  it('ignores an undefined-valued field, matching an absent one', () => {
    expect(modifiedCategories({ ...DEFAULT_BIN_PARAMS, cellMask: undefined })).toEqual(stock());
  });

  it('lights multiple categories independently', () => {
    expect(
      modifiedCategories({
        ...DEFAULT_BIN_PARAMS,
        width: 4,
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
      })
    ).toEqual({ ...stock(), shape: true, features: true });
  });
});
