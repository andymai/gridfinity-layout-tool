import { describe, it, expect } from 'vitest';
import { SIZE, CLEARANCE, SOCKET_HEIGHT, LIP_HEIGHT, LIP_TAPER_WIDTH } from './generatorTypes';

describe('constants (re-exported via generatorTypes barrel)', () => {
  it('SIZE matches Gridfinity grid size', () => {
    expect(SIZE).toBe(42);
  });

  it('CLEARANCE matches Gridfinity tolerance', () => {
    expect(CLEARANCE).toBe(0.5);
  });

  it('SOCKET_HEIGHT is 5mm', () => {
    expect(SOCKET_HEIGHT).toBe(5);
  });

  it('LIP_HEIGHT is 4.4mm total', () => {
    expect(LIP_HEIGHT).toBeCloseTo(4.4, 1);
  });

  it('LIP_TAPER_WIDTH is 2.6mm', () => {
    expect(LIP_TAPER_WIDTH).toBeCloseTo(2.6, 1);
  });
});
