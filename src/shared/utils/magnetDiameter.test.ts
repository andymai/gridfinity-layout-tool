import { describe, it, expect } from 'vitest';
import {
  MAGNET_DIAMETER_STEP_MM,
  formatMagnetDiameter,
  snapMagnetDiameter,
} from './magnetDiameter';

describe('MAGNET_DIAMETER_STEP_MM', () => {
  it('is 0.05mm', () => {
    expect(MAGNET_DIAMETER_STEP_MM).toBe(0.05);
  });
});

describe('snapMagnetDiameter', () => {
  it('keeps a value already on the 0.05mm grid', () => {
    expect(snapMagnetDiameter(6.45)).toBe(6.45);
    expect(snapMagnetDiameter(6.05)).toBe(6.05);
    expect(snapMagnetDiameter(6)).toBe(6);
  });

  it('keeps every value of the old 0.1mm and 0.5mm grids', () => {
    for (let tenths = 10; tenths <= 200; tenths++) {
      expect(snapMagnetDiameter(tenths / 10)).toBe(tenths / 10);
    }
  });

  it('removes the float noise that repeated 0.05mm steps add', () => {
    const noisy = 6.1 + 0.05;
    expect(noisy).not.toBe(6.15);
    expect(snapMagnetDiameter(noisy)).toBe(6.15);
    expect(snapMagnetDiameter(0.1 + 0.2)).toBe(0.3);
  });

  it('snaps an off-grid value to the nearest 0.05mm', () => {
    expect(snapMagnetDiameter(6.43)).toBe(6.45);
    expect(snapMagnetDiameter(6.42)).toBe(6.4);
    expect(snapMagnetDiameter(6.47)).toBe(6.45);
    expect(snapMagnetDiameter(6.48)).toBe(6.5);
  });
});

describe('formatMagnetDiameter', () => {
  it('shows one decimal for a value on the 0.1mm grid', () => {
    expect(formatMagnetDiameter(6)).toBe('6.0');
    expect(formatMagnetDiameter(6.5)).toBe('6.5');
    expect(formatMagnetDiameter(10.1)).toBe('10.1');
  });

  it('shows two decimals for a value between the 0.1mm steps', () => {
    expect(formatMagnetDiameter(6.45)).toBe('6.45');
    expect(formatMagnetDiameter(6.05)).toBe('6.05');
    expect(formatMagnetDiameter(12.35)).toBe('12.35');
  });

  it('rounds float noise away instead of printing it', () => {
    expect(formatMagnetDiameter(6.450000000000001)).toBe('6.45');
    expect(formatMagnetDiameter(6.499999999999999)).toBe('6.5');
  });
});
