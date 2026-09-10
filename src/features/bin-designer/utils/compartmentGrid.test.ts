import { describe, it, expect } from 'vitest';
import {
  getCompartmentBounds,
  getCompartmentIds,
  isRectangularCompartment,
} from './compartmentGrid';
import type { CompartmentConfig } from '../types';

const L: CompartmentConfig = {
  cols: 3,
  rows: 2,
  thickness: 1.2,
  cells: [0, 0, 1, 0, 2, 2],
};

describe('compartmentGrid', () => {
  it('lists ids and bounds from the flat cell array', () => {
    expect(getCompartmentIds(L)).toEqual([0, 1, 2]);
    expect(getCompartmentBounds(L, 0)).toEqual({ minCol: 0, maxCol: 1, minRow: 0, maxRow: 1 });
    expect(getCompartmentBounds(L, 9)).toBeNull();
  });

  it('tells an L-shaped compartment from a rectangular one', () => {
    expect(isRectangularCompartment(L, 0)).toBe(false);
    expect(isRectangularCompartment(L, 2)).toBe(true);
  });
});
