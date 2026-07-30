import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams } from './index';
import {
  DEFAULT_LID_CONFIG,
  LID_FIT_CLEARANCE,
  LID_MAGNETIC_EXTRA_CLEARANCE,
  LID_TOP_THICKNESS_BASE,
  LID_TOP_THICKNESS_MIN_MM,
  LID_TOP_THICKNESS_MAX_MM,
  LID_TOP_THICKNESS_STEP_MM,
  resolveLidFootprintClearance,
  LID_EXTRA_HEIGHT_MIN_MM,
  LID_EXTRA_HEIGHT_MAX_MM,
  LID_EXTRA_HEIGHT_STEP_MM,
  type LidConfig,
} from './lid';

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

  it('keeps the stack grid fused by default (separate baseplate is opt-in)', () => {
    expect(DEFAULT_LID_CONFIG.separateStackPlate).toBe(false);
  });

  it('adds no extra lid height by default (0 = standard one-grid-unit lid)', () => {
    expect(DEFAULT_LID_CONFIG.extraHeightMm).toBe(0);
  });

  it('starts the floor plate at the baseline so pre-#2761 designs regenerate unchanged', () => {
    expect(DEFAULT_LID_CONFIG.topThicknessMm).toBe(LID_TOP_THICKNESS_BASE);
  });

  // wallThickness, fit, and the LEGACY `topThickness` are intentionally NOT on
  // LidConfig — they're locked-down constants in `lidConstants.ts`. The
  // millimetre floor-plate knob is `topThicknessMm` (#2761); the legacy name
  // must stay absent so `migrateParams` keeps stripping it.
  it('does not expose wall/fit knobs or the legacy topThickness field', () => {
    const cfg: LidConfig = DEFAULT_LID_CONFIG;
    expect('wallThickness' in cfg).toBe(false);
    expect('topThickness' in cfg).toBe(false);
    expect('fit' in cfg).toBe(false);
  });
});

describe('LID_TOP_THICKNESS bounds', () => {
  it('floors at the baseline plate thickness so the knob can only add material', () => {
    expect(LID_TOP_THICKNESS_MIN_MM).toBe(LID_TOP_THICKNESS_BASE);
    expect(LID_TOP_THICKNESS_MAX_MM).toBeGreaterThan(LID_TOP_THICKNESS_MIN_MM);
  });

  it('steps in increments that divide evenly into common layer heights', () => {
    expect(LID_TOP_THICKNESS_STEP_MM).toBeCloseTo(0.2, 6);
  });
});

describe('resolveLidFootprintClearance', () => {
  const params = (lid: Partial<BinParams['lid']>, rest: Partial<BinParams> = {}): BinParams => ({
    ...DEFAULT_BIN_PARAMS,
    ...rest,
    lid: { ...DEFAULT_BIN_PARAMS.lid, ...lid },
  });

  it('returns the base clearance for friction and click-rail lids', () => {
    expect(resolveLidFootprintClearance(params({ attachment: 'friction' }))).toBe(
      LID_FIT_CLEARANCE
    );
    expect(resolveLidFootprintClearance(params({ attachment: 'clickRails' }))).toBe(
      LID_FIT_CLEARANCE
    );
  });

  it('adds the magnetic relief when the design actually gets retention magnets', () => {
    expect(resolveLidFootprintClearance(params({ attachment: 'magnetic' }))).toBeCloseTo(
      LID_FIT_CLEARANCE + LID_MAGNETIC_EXTRA_CLEARANCE,
      6
    );
  });

  // A magnetic lid without a lip, or on a polygon footprint, generates NO
  // corner bosses (`usesMagneticLid` rejects both) — it falls back to a plain
  // friction fit, so the relief would leave it rattling.
  it('withholds the relief when magnetic retention cannot actually be built', () => {
    const noLip = params(
      { attachment: 'magnetic' },
      { base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } }
    );
    expect(resolveLidFootprintClearance(noLip)).toBe(LID_FIT_CLEARANCE);

    const polygon = params(
      { attachment: 'magnetic' },
      // DEFAULT_BIN_PARAMS is a 2×2-unit bin; a cellMask is half-bin
      // resolution (MASK_CELLS_PER_UNIT = 2), so it needs a 4×4 grid here,
      // not 2×2.
      {
        cellMask: {
          cols: 4,
          rows: 4,
          cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        },
      }
    );
    expect(resolveLidFootprintClearance(polygon)).toBe(LID_FIT_CLEARANCE);
  });

  it('shrinks a 6×4 magnetic lid by 0.3mm per axis versus a friction one', () => {
    const frictionW = 6 * 42 - 2 * resolveLidFootprintClearance(params({ attachment: 'friction' }));
    const magneticW = 6 * 42 - 2 * resolveLidFootprintClearance(params({ attachment: 'magnetic' }));
    expect(frictionW - magneticW).toBeCloseTo(0.3, 6);
  });
});

describe('LID_FIT_CLEARANCE', () => {
  it('is a positive, sub-mm clearance', () => {
    expect(LID_FIT_CLEARANCE).toBeGreaterThan(0);
    expect(LID_FIT_CLEARANCE).toBeLessThanOrEqual(0.5);
  });
});

describe('LID_EXTRA_HEIGHT bounds', () => {
  it('defines a non-negative range with the default at the floor', () => {
    expect(LID_EXTRA_HEIGHT_MIN_MM).toBe(0);
    expect(LID_EXTRA_HEIGHT_MAX_MM).toBeGreaterThan(LID_EXTRA_HEIGHT_MIN_MM);
    expect(DEFAULT_LID_CONFIG.extraHeightMm).toBe(LID_EXTRA_HEIGHT_MIN_MM);
  });

  it('uses a whole-millimetre step', () => {
    expect(LID_EXTRA_HEIGHT_STEP_MM).toBeGreaterThan(0);
    expect(Number.isInteger(LID_EXTRA_HEIGHT_STEP_MM)).toBe(true);
  });
});
