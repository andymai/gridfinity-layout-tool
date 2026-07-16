import { describe, expect, it } from 'vitest';
import { fitAxisUnits, halfUnitUpgrade } from './drawerFit';

describe('fitAxisUnits', () => {
  it('floors to the largest whole-unit grid that fits', () => {
    expect(fitAxisUnits(450, 42, false)).toEqual({ units: 10, slackMm: 30 });
  });

  it('never rounds up past the measured size', () => {
    expect(fitAxisUnits(419.9, 42, false).units).toBe(9);
  });

  it('is exact at whole-unit boundaries', () => {
    expect(fitAxisUnits(420, 42, false)).toEqual({ units: 10, slackMm: 0 });
  });

  it('fits half units when allowed', () => {
    expect(fitAxisUnits(450, 42, true)).toEqual({ units: 10.5, slackMm: 9 });
  });

  it('keeps whole units when half units are not allowed', () => {
    expect(fitAxisUnits(450, 42, false).units).toBe(10);
  });

  it('clamps tiny measurements to 1 whole unit and reports negative slack', () => {
    const fit = fitAxisUnits(10, 42, false);
    expect(fit.units).toBe(1);
    expect(fit.slackMm).toBe(10 - 42);
  });

  it('clamps tiny measurements to half a unit when half units are allowed', () => {
    expect(fitAxisUnits(10, 42, true).units).toBe(0.5);
  });

  it('clamps to GRID_MAX for oversized measurements', () => {
    expect(fitAxisUnits(4999, 42, false).units).toBe(50);
  });

  it('honors a custom grid pitch', () => {
    expect(fitAxisUnits(100, 25, false)).toEqual({ units: 4, slackMm: 0 });
  });
});

describe('halfUnitUpgrade', () => {
  it('offers the tighter half-unit fit when the remainder covers a half cell', () => {
    expect(halfUnitUpgrade(450, 42, 10)).toEqual({ units: 10.5, slackMm: 9 });
  });

  it('returns null when the whole-unit fit is already as tight as half units get', () => {
    expect(halfUnitUpgrade(430, 42, 10)).toBeNull();
  });

  it('returns null exactly at a whole-unit boundary', () => {
    expect(halfUnitUpgrade(420, 42, 10)).toBeNull();
  });

  it('offers the upgrade exactly at the half-cell threshold', () => {
    expect(halfUnitUpgrade(441, 42, 10)).toEqual({ units: 10.5, slackMm: 0 });
  });
});
