import { describe, it, expect } from 'vitest';
import { hasComplexGeometry, getComplexityReasons } from './complexGeometry';
import type { BinParams } from '@/features/bin-designer';

/** Minimal BinParams for testing — only the fields checked by complex geometry detection. */
function createParams(
  overrides: Partial<Pick<BinParams, 'inserts' | 'cutouts' | 'compartments'>> = {}
): BinParams {
  return {
    inserts: [],
    cutouts: [],
    compartments: { cells: [0, 0, 0, 0] },
    ...overrides,
  } as unknown as BinParams;
}

describe('hasComplexGeometry', () => {
  it('returns false for a simple design', () => {
    expect(hasComplexGeometry(createParams())).toBe(false);
  });

  it('returns true when inserts are present', () => {
    expect(hasComplexGeometry(createParams({ inserts: [{}] as BinParams['inserts'] }))).toBe(true);
  });

  it('returns true when cutouts are present', () => {
    expect(hasComplexGeometry(createParams({ cutouts: [{}] as BinParams['cutouts'] }))).toBe(true);
  });

  it('returns true for non-default compartments (>1 unique)', () => {
    expect(hasComplexGeometry(createParams({ compartments: { cells: [0, 1, 0, 1] } }))).toBe(true);
  });

  it('returns false when all compartments share the same id', () => {
    expect(hasComplexGeometry(createParams({ compartments: { cells: [3, 3, 3, 3] } }))).toBe(false);
  });
});

describe('getComplexityReasons', () => {
  it('returns empty array for simple design', () => {
    expect(getComplexityReasons(createParams())).toEqual([]);
  });

  it('returns all applicable reasons', () => {
    const params = createParams({
      inserts: [{}] as BinParams['inserts'],
      cutouts: [{}] as BinParams['cutouts'],
      compartments: { cells: [0, 1] },
    });
    expect(getComplexityReasons(params)).toEqual([
      'inserts',
      'cutouts',
      'non-default-compartments',
    ]);
  });

  it('returns only matching reasons', () => {
    expect(getComplexityReasons(createParams({ cutouts: [{}] as BinParams['cutouts'] }))).toEqual([
      'cutouts',
    ]);
  });
});
