import { describe, it, expect } from 'vitest';
import { resolveSelection } from './selection';
import type { CompartmentConfig } from '../types';

const TWO_BY_TWO: CompartmentConfig = {
  cols: 2,
  rows: 2,
  cells: [0, 1, 2, 3],
  thickness: 1.2,
};

describe('resolveSelection', () => {
  it('passes null through', () => {
    expect(resolveSelection(null, TWO_BY_TWO)).toBeNull();
  });

  it('keeps a compartment that still exists and nulls one that does not', () => {
    expect(resolveSelection({ kind: 'compartment', id: 3 }, TWO_BY_TWO)).toEqual({
      kind: 'compartment',
      id: 3,
    });
    expect(resolveSelection({ kind: 'compartment', id: 9 }, TWO_BY_TWO)).toBeNull();
  });

  it('nulls a label tab whose compartment renumbered away', () => {
    expect(resolveSelection({ kind: 'labelTab', compartmentId: 7 }, TWO_BY_TWO)).toBeNull();
    expect(resolveSelection({ kind: 'labelTab', compartmentId: 0 }, TWO_BY_TWO)).toEqual({
      kind: 'labelTab',
      compartmentId: 0,
    });
  });

  it('keeps a divider only while its pair is still adjacent', () => {
    expect(resolveSelection({ kind: 'divider', key: '0-1' }, TWO_BY_TWO)).toEqual({
      kind: 'divider',
      key: '0-1',
    });
    // 0 and 3 sit diagonally; no divider separates them.
    expect(resolveSelection({ kind: 'divider', key: '0-3' }, TWO_BY_TWO)).toBeNull();
  });
});
