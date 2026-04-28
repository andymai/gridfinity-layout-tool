import { describe, it, expect } from 'vitest';
import { DEFAULT_LID_CONFIG, LID_FIT_CLEARANCE, type LidConfig, type LidFit } from './lid';
import { WALL_THICKNESS_OPTIONS } from '../constants/gridfinity';

describe('DEFAULT_LID_CONFIG', () => {
  it('is disabled by default', () => {
    expect(DEFAULT_LID_CONFIG.enabled).toBe(false);
  });

  it('uses standard fit by default', () => {
    expect(DEFAULT_LID_CONFIG.fit).toBe('standard');
  });

  it('disables stackable top by default (the lid prints rails-up; stack grid would land on the build plate)', () => {
    expect(DEFAULT_LID_CONFIG.stackableTop).toBe(false);
  });

  it('uses 50% click-rail coverage by default (filament-economy default; users can dial up for more grip)', () => {
    expect(DEFAULT_LID_CONFIG.clickRailCoverage).toBe(50);
  });

  it('disables magnet holes by default', () => {
    expect(DEFAULT_LID_CONFIG.magnetHoles).toBe(false);
  });

  it('uses thickness defaults from WALL_THICKNESS_OPTIONS', () => {
    expect(WALL_THICKNESS_OPTIONS).toContain(DEFAULT_LID_CONFIG.wallThickness);
    expect(WALL_THICKNESS_OPTIONS).toContain(DEFAULT_LID_CONFIG.topThickness);
  });
});

describe('LID_FIT_CLEARANCE', () => {
  it('orders clearances from loose to tight', () => {
    expect(LID_FIT_CLEARANCE.loose).toBeGreaterThan(LID_FIT_CLEARANCE.standard);
    expect(LID_FIT_CLEARANCE.standard).toBeGreaterThan(LID_FIT_CLEARANCE.tight);
  });

  it('keeps all clearances within FDM-printable range', () => {
    const fits: readonly LidFit[] = ['loose', 'standard', 'tight'];
    for (const fit of fits) {
      expect(LID_FIT_CLEARANCE[fit]).toBeGreaterThan(0);
      expect(LID_FIT_CLEARANCE[fit]).toBeLessThanOrEqual(0.5);
    }
  });
});

describe('LidConfig type', () => {
  it('accepts all fit values', () => {
    const fits: LidFit[] = ['loose', 'standard', 'tight'];
    for (const fit of fits) {
      const config: LidConfig = { ...DEFAULT_LID_CONFIG, fit };
      expect(config.fit).toBe(fit);
    }
  });
});
