import { describe, it, expect } from 'vitest';
import {
  defaultInteriorFilletMm,
  interiorFilletCornerMm,
  interiorFilletRadiusMm,
  interiorFilletRiseMm,
} from './interiorFillet';

describe('interior fillet reach', () => {
  it('defaults to the shell corner, stepped down to the control step', () => {
    expect(defaultInteriorFilletMm(1.2)).toBe(2.5);
    expect(defaultInteriorFilletMm(0.8)).toBe(2.9);
    expect(defaultInteriorFilletMm(3.6)).toBe(0.5);
  });

  it('reads an absent or unusable radius as off', () => {
    expect(interiorFilletRadiusMm({})).toBe(0);
    expect(interiorFilletRadiusMm({ interiorFilletMm: Number.NaN })).toBe(0);
    expect(interiorFilletRiseMm({ interiorFilletMm: 4, compartments: {} })).toBe(4);
  });

  it('rises from the highest raised compartment floor', () => {
    const compartments = { floorRaises: [null, 6, 2] };
    expect(interiorFilletRiseMm({ interiorFilletMm: 3, compartments })).toBe(9);
    expect(interiorFilletRiseMm({ compartments })).toBe(0);
  });

  it('never reports a corner narrower than the shell already rounds', () => {
    expect(interiorFilletCornerMm({ interiorFilletMm: 1, wallThickness: 1.2 })).toBeCloseTo(
      2.55,
      6
    );
    expect(interiorFilletCornerMm({ interiorFilletMm: 6, wallThickness: 1.2 })).toBe(6);
    expect(interiorFilletCornerMm({ wallThickness: 1.2 })).toBe(0);
  });
});
