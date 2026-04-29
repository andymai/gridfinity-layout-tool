import { describe, it, expect } from 'vitest';
import { DEFAULT_LID_CONFIG, LID_FIT_CLEARANCE, type LidConfig } from './lid';

describe('DEFAULT_LID_CONFIG', () => {
  it('is disabled by default', () => {
    expect(DEFAULT_LID_CONFIG.enabled).toBe(false);
  });

  it('disables stackable top by default (the lid prints rails-up; stack grid would land on the build plate)', () => {
    expect(DEFAULT_LID_CONFIG.stackableTop).toBe(false);
  });

  it('uses 50% click-rail coverage by default (filament-economy default; users can dial up for more grip)', () => {
    expect(DEFAULT_LID_CONFIG.clickRailCoverage).toBe(50);
  });

  it('enables click rails on all four sides by default (preserves the click-lock semantics that gave the feature its name)', () => {
    expect(DEFAULT_LID_CONFIG.clickRails).toEqual({
      front: true,
      back: true,
      left: true,
      right: true,
    });
  });

  it('disables magnet holes by default', () => {
    expect(DEFAULT_LID_CONFIG.magnetHoles).toBe(false);
  });

  // wallThickness, topThickness, fit are intentionally NOT on LidConfig —
  // they're locked-down constants in `lidConstants.ts`. The type-level
  // test below ensures they aren't reintroduced silently.
  it('does not expose wall/top/fit knobs (validated values live in lidConstants)', () => {
    const cfg: LidConfig = DEFAULT_LID_CONFIG;
    expect('wallThickness' in cfg).toBe(false);
    expect('topThickness' in cfg).toBe(false);
    expect('fit' in cfg).toBe(false);
  });
});

describe('LID_FIT_CLEARANCE', () => {
  it('is a positive, sub-mm clearance', () => {
    expect(LID_FIT_CLEARANCE).toBeGreaterThan(0);
    expect(LID_FIT_CLEARANCE).toBeLessThanOrEqual(0.5);
  });
});
