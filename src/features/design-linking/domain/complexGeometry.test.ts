import { describe, it, expect } from 'vitest';
import { hasComplexGeometry, getComplexityReasons } from './complexGeometry';
import type { BinParams, Insert, Cutout, CompartmentConfig } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';

const testInsert: Insert = {
  id: 'insert-1',
  templateId: null,
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
};

const testCutout: Cutout = {
  id: 'cutout-1',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
};

function compartmentsWithCells(cells: number[]): CompartmentConfig {
  return { cols: cells.length, rows: 1, thickness: 1.2, cells };
}

/** Minimal BinParams for testing — only the fields checked by complex geometry detection. */
function createParams(
  overrides: Partial<Pick<BinParams, 'inserts' | 'cutouts' | 'compartments'>> = {}
): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    inserts: [],
    cutouts: [],
    compartments: compartmentsWithCells([0, 0, 0, 0]),
    ...overrides,
  };
}

describe('hasComplexGeometry', () => {
  it('returns false for a simple design', () => {
    expect(hasComplexGeometry(createParams())).toBe(false);
  });

  it('returns true when inserts are present', () => {
    expect(hasComplexGeometry(createParams({ inserts: [testInsert] }))).toBe(true);
  });

  it('returns true when cutouts are present', () => {
    expect(hasComplexGeometry(createParams({ cutouts: [testCutout] }))).toBe(true);
  });

  it('returns true for non-default compartments (>1 unique)', () => {
    expect(
      hasComplexGeometry(createParams({ compartments: compartmentsWithCells([0, 1, 0, 1]) }))
    ).toBe(true);
  });

  it('returns false when all compartments share the same id', () => {
    expect(
      hasComplexGeometry(createParams({ compartments: compartmentsWithCells([3, 3, 3, 3]) }))
    ).toBe(false);
  });
});

describe('getComplexityReasons', () => {
  it('returns empty array for simple design', () => {
    expect(getComplexityReasons(createParams())).toEqual([]);
  });

  it('returns all applicable reasons', () => {
    const params = createParams({
      inserts: [testInsert],
      cutouts: [testCutout],
      compartments: compartmentsWithCells([0, 1]),
    });
    expect(getComplexityReasons(params)).toEqual([
      'inserts',
      'cutouts',
      'non-default-compartments',
    ]);
  });

  it('returns only matching reasons', () => {
    expect(getComplexityReasons(createParams({ cutouts: [testCutout] }))).toEqual(['cutouts']);
  });
});
