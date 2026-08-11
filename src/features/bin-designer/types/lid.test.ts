import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import { migrateParams } from '../constants/paramMigration';
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
  resolveLidPlateThickness,
  resolveLidTrayBreakdown,
  LID_MAGNET_CEILING,
  LID_TRAY_FLOOR,
  LID_EXTRA_HEIGHT_MIN_MM,
  LID_EXTRA_HEIGHT_MAX_MM,
  LID_EXTRA_HEIGHT_STEP_MM,
  LID_CORNER_RADIUS,
  LID_CLICK_RAIL_COVERAGE_OPTIONS,
  LID_CLICK_RAIL_COVERAGE_MIN,
  LID_CLICK_RAIL_COVERAGE_MAX,
  LID_MAGNET_LIP_CLEARANCE,
  LID_GRIP_SPAN_MIN_MM,
  LID_GRIP_SPAN_MAX_MM,
  LID_GRIP_MIN_WALL_MM,
  resolveLidGripSpanMm,
  resolveLidGripDepth,
  resolveLidGripHeightPlan,
  lidGripRequestedHeightMm,
  LID_GRIP_HEIGHT_MIN_MM,
  LID_GRIP_HEIGHT_MAX_MM,
  LID_GRIP_CHAMFER_MM,
  LID_GRIP_REVEAL_HEIGHT_MM,
  LID_GRIP_SCALLOP_HEIGHT_MM,
  LID_GRIP_TOP_SKIN_MM,
  lidGripRequestedDepthMm,
  hasLidGrip,
  hasBinLipDip,
  lidGripModeAllowed,
  type LidConfig,
} from './lid';
import type { LidGripConfig } from './lid';

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

describe('resolveLidPlateThickness', () => {
  const params = (lid: Partial<BinParams['lid']>, rest: Partial<BinParams> = {}): BinParams => ({
    ...DEFAULT_BIN_PARAMS,
    ...rest,
    lid: { ...DEFAULT_BIN_PARAMS.lid, ...lid },
  });
  const tray = (depthMm: number) => ({ enabled: true, depthMm, wallMm: 2 });

  it('is the plate itself on a lid with no tray', () => {
    expect(resolveLidPlateThickness(params({ topThicknessMm: 2.4 }))).toBe(2.4);
  });

  it('never drops below the base thickness', () => {
    expect(resolveLidPlateThickness(params({ topThicknessMm: 0 }))).toBe(LID_TOP_THICKNESS_BASE);
  });

  it('keeps material above a stack magnet pocket', () => {
    const plate = resolveLidPlateThickness(
      params(
        { stackableTop: true, magnetHoles: true, topThicknessMm: 0.8 },
        { base: { ...DEFAULT_BIN_PARAMS.base, magnetDepth: 2.5 } }
      )
    );
    expect(plate).toBeCloseTo(2.5 + LID_MAGNET_CEILING, 6);
  });

  // #3072: the knob used to be `max(plate, recess + floor)`, which pinned a
  // default 4mm tray at 4.8mm — every value under that changed nothing the
  // user could see, and the tray floor was always the bare minimum.
  it('adds the tray recess on top of the requested floor', () => {
    expect(resolveLidPlateThickness(params({ tray: tray(4), topThicknessMm: 3 }))).toBeCloseTo(
      7,
      6
    );
  });

  it('moves with the knob instead of sitting inert below a threshold', () => {
    const thin = resolveLidPlateThickness(params({ tray: tray(4), topThicknessMm: 2 }));
    const thick = resolveLidPlateThickness(params({ tray: tray(4), topThicknessMm: 3 }));
    expect(thick - thin).toBeCloseTo(1, 6);
  });

  it('holds the minimum floor under the recess when the knob is lower', () => {
    const plate = resolveLidPlateThickness(params({ tray: tray(4), topThicknessMm: 0.8 }));
    expect(plate - 4).toBeCloseTo(LID_TRAY_FLOOR, 6);
  });

  it('ignores the tray when the top is stackable — they cannot share the face', () => {
    expect(
      resolveLidPlateThickness(params({ tray: tray(4), stackableTop: true, topThicknessMm: 1.2 }))
    ).toBe(1.2);
  });
});

describe('resolveLidTrayBreakdown', () => {
  const params = (lid: Partial<BinParams['lid']>): BinParams => ({
    ...DEFAULT_BIN_PARAMS,
    lid: { ...DEFAULT_BIN_PARAMS.lid, ...lid },
  });

  it('is null when there is no tray to break down', () => {
    expect(resolveLidTrayBreakdown(params({ topThicknessMm: 2 }))).toBeNull();
    expect(
      resolveLidTrayBreakdown(
        params({ tray: { enabled: true, depthMm: 4, wallMm: 2 }, stackableTop: true })
      )
    ).toBeNull();
  });

  it('splits the plate into recess and floor, summing to the whole', () => {
    const b = resolveLidTrayBreakdown(
      params({ tray: { enabled: true, depthMm: 4, wallMm: 2 }, topThicknessMm: 2.4 })
    );
    expect(b).not.toBeNull();
    expect(b?.recessMm).toBeCloseTo(4, 6);
    expect(b?.floorMm).toBeCloseTo(2.4, 6);
    expect(b?.overallMm).toBeCloseTo(6.4, 6);
  });

  it('reports the same total the geometry builds from', () => {
    const p = params({ tray: { enabled: true, depthMm: 3, wallMm: 2 }, topThicknessMm: 1 });
    expect(resolveLidTrayBreakdown(p)?.overallMm).toBe(resolveLidPlateThickness(p));
  });
});

describe('resolveLidGripSpanMm', () => {
  it('clamps a wide wall down to a hand-sized span', () => {
    // 6-wide lid: 50% of the straight run is a 100mm+ trench nobody needs.
    expect(resolveLidGripSpanMm(244, 50)).toBe(LID_GRIP_SPAN_MAX_MM);
  });

  it('clamps a narrow wall up to a fingertip', () => {
    expect(resolveLidGripSpanMm(60, 10)).toBe(LID_GRIP_SPAN_MIN_MM);
  });

  it('never exceeds the wall it sits on', () => {
    // A wall shorter than the minimum span gets the whole wall, not an
    // overhanging relief.
    expect(resolveLidGripSpanMm(9, 100)).toBe(9);
  });

  it('scales with coverage between the bounds', () => {
    expect(resolveLidGripSpanMm(60, 50)).toBe(30);
  });
});

describe('resolveLidGripDepth', () => {
  const params = (lid: Partial<BinParams['lid']>): BinParams => ({
    ...DEFAULT_BIN_PARAMS,
    lid: { ...DEFAULT_BIN_PARAMS.lid, ...lid },
  });
  const grip = (g: Partial<BinParams['lid']['grip']>): Partial<BinParams['lid']> => ({
    grip: { ...DEFAULT_LID_CONFIG.grip, mode: 'scallop', ...g },
  });

  it('suppresses a disabled relief', () => {
    const plan = resolveLidGripDepth(params(grip({ mode: 'none' })));
    expect(plan.depthMm).toBe(0);
    expect(plan.suppressed).toBe(true);
  });

  it('gives each mode its requested depth on a plain lid', () => {
    for (const mode of ['chamfer', 'reveal', 'scallop'] as const) {
      const plan = resolveLidGripDepth(params(grip({ mode })));
      expect(plan.depthMm).toBeCloseTo(lidGripRequestedDepthMm(mode), 6);
      expect(plan.clamped).toBe(false);
      expect(plan.limitedBy).toBeNull();
    }
  });

  it('leaves at least the minimum wall in front of the cavity', () => {
    const plan = resolveLidGripDepth(params(grip({ mode: 'scallop' })));
    const cavityInset = LID_CORNER_RADIUS - LID_FIT_CLEARANCE;
    expect(cavityInset - plan.depthMm).toBeGreaterThanOrEqual(LID_GRIP_MIN_WALL_MM);
  });

  it('clamps against a thin tray wall and says so', () => {
    const plan = resolveLidGripDepth(
      params({
        ...grip({ mode: 'scallop' }),
        tray: { enabled: true, depthMm: 4, wallMm: 2 },
      })
    );
    expect(plan.depthMm).toBeCloseTo(2 - LID_GRIP_MIN_WALL_MM, 6);
    expect(plan.clamped).toBe(true);
    expect(plan.limitedBy).toBe('trayWall');
  });

  it('ignores the tray budget when a stackable top disables the tray', () => {
    const plan = resolveLidGripDepth(
      params({
        ...grip({ mode: 'scallop' }),
        tray: { enabled: true, depthMm: 4, wallMm: 2 },
        stackableTop: true,
      })
    );
    expect(plan.clamped).toBe(false);
  });

  it('keeps every mode clear of a mid-span edge magnet boss', () => {
    // The boss's nearest face sits LID_MAGNET_LIP_CLEARANCE inboard of the
    // footprint edge — mid-span, exactly where a centered relief cuts. No
    // current mode is deep enough to reach it, so this asserts the invariant
    // rather than a clamp: raising a mode's depth past the boss must reduce
    // the relief, not silently intersect it. An intersecting boss leaves the
    // lid watertight, so nothing cheaper catches it.
    for (const mode of ['chamfer', 'reveal', 'scallop'] as const) {
      const plan = resolveLidGripDepth(
        params({
          ...grip({ mode }),
          attachment: 'magnetic',
          retentionMagnet: { ...DEFAULT_LID_CONFIG.retentionMagnet, edgeMagnets: 2 },
        })
      );
      expect(plan.depthMm + LID_GRIP_MIN_WALL_MM).toBeLessThanOrEqual(LID_MAGNET_LIP_CLEARANCE);
    }
  });

  it('suppresses the relief when no useful depth survives', () => {
    const plan = resolveLidGripDepth(
      params({
        ...grip({ mode: 'scallop' }),
        tray: { enabled: true, depthMm: 4, wallMm: LID_GRIP_MIN_WALL_MM + 0.1 },
      })
    );
    expect(plan.suppressed).toBe(true);
  });
});

describe('hasLidGrip / hasBinLipDip', () => {
  const params = (g: Partial<BinParams['lid']['grip']>): BinParams => ({
    ...DEFAULT_BIN_PARAMS,
    lid: { ...DEFAULT_BIN_PARAMS.lid, grip: { ...DEFAULT_LID_CONFIG.grip, ...g } },
  });

  it('is off by default, so pre-#3272 designs are unchanged', () => {
    expect(hasLidGrip(DEFAULT_BIN_PARAMS)).toBe(false);
    expect(hasBinLipDip(DEFAULT_BIN_PARAMS)).toBe(false);
  });

  it('needs a mode and at least one side', () => {
    expect(hasLidGrip(params({ mode: 'scallop' }))).toBe(true);
    expect(
      hasLidGrip(
        params({ mode: 'scallop', sides: { front: false, back: false, left: false, right: false } })
      )
    ).toBe(false);
  });

  it('does not dip the bin lip without a relief above it to reach through', () => {
    expect(hasBinLipDip(params({ mode: 'none', binDip: true }))).toBe(false);
    expect(hasBinLipDip(params({ mode: 'scallop', binDip: true }))).toBe(true);
  });
});

describe('lidGripModeAllowed', () => {
  const params = (lid: Partial<BinParams['lid']>): BinParams => ({
    ...DEFAULT_BIN_PARAMS,
    lid: { ...DEFAULT_BIN_PARAMS.lid, ...lid },
  });

  it('allows every mode on a plain lid', () => {
    for (const mode of ['none', 'chamfer', 'reveal', 'scallop'] as const) {
      expect(lidGripModeAllowed(params({}), mode)).toBe(true);
    }
  });

  it('rejects only reveal on a stackable top', () => {
    for (const lid of [{ stackableTop: true }, { separateStackPlate: true }]) {
      expect(lidGripModeAllowed(params(lid), 'reveal')).toBe(false);
      expect(lidGripModeAllowed(params(lid), 'chamfer')).toBe(true);
      expect(lidGripModeAllowed(params(lid), 'scallop')).toBe(true);
    }
  });

  it('builds no geometry for the disallowed combination', () => {
    expect(
      hasLidGrip(
        params({ stackableTop: true, grip: { ...DEFAULT_LID_CONFIG.grip, mode: 'reveal' } })
      )
    ).toBe(false);
  });
});

describe('resolveLidGripHeightPlan', () => {
  const grip = (over: Partial<LidGripConfig> = {}): LidGripConfig => ({
    ...DEFAULT_LID_CONFIG.grip,
    ...over,
  });
  // A deep cavity leaves plenty of skirt above the seam, so nothing clamps.
  const ROOMY = -20;
  // The whole skirt above the seam on a standard lid, which is a thin cap.
  const STANDARD = -2.09;

  it('gives each mode its requested height on a lid with skirt to spare', () => {
    expect(resolveLidGripHeightPlan(grip({ mode: 'chamfer' }), ROOMY, 5).heightMm).toBe(
      LID_GRIP_CHAMFER_MM
    );
    expect(resolveLidGripHeightPlan(grip({ mode: 'reveal' }), ROOMY, 5).heightMm).toBe(
      LID_GRIP_REVEAL_HEIGHT_MM
    );
    expect(resolveLidGripHeightPlan(grip({ mode: 'scallop' }), ROOMY, 5).heightMm).toBe(
      LID_GRIP_SCALLOP_HEIGHT_MM
    );
  });

  it('cuts to a user-set height instead of the mode request', () => {
    const plan = resolveLidGripHeightPlan(grip({ mode: 'scallop', heightMm: 2.4 }), ROOMY, 5);
    expect(plan.heightMm).toBe(2.4);
    expect(plan.requestedMm).toBe(2.4);
    expect(plan.clamped).toBe(false);
    expect(plan.limitedBy).toBeNull();
  });

  it('clamps a user-set height to the knob bounds', () => {
    expect(
      resolveLidGripHeightPlan(grip({ mode: 'scallop', heightMm: 99 }), ROOMY, 5).heightMm
    ).toBe(LID_GRIP_HEIGHT_MAX_MM);
    expect(
      resolveLidGripHeightPlan(grip({ mode: 'scallop', heightMm: 0.1 }), ROOMY, 5).heightMm
    ).toBe(LID_GRIP_HEIGHT_MIN_MM);
  });

  it('ignores a stored height in chamfer mode', () => {
    // The panel offers no height control for a chamfer, so a value carried
    // over from another mode must not move its geometry.
    expect(
      resolveLidGripHeightPlan(grip({ mode: 'chamfer', heightMm: 6 }), ROOMY, 5).heightMm
    ).toBe(LID_GRIP_CHAMFER_MM);
  });

  it("ties a chamfer's height to its depth, and says which bound bit", () => {
    const plan = resolveLidGripHeightPlan(grip({ mode: 'chamfer' }), ROOMY, 0.6);
    expect(plan.heightMm).toBe(0.6);
    expect(plan.limitedBy).toBe('depth');
  });

  it('keeps a solid skin above the relief on a standard lid', () => {
    // The scallop's 4mm request cannot be honoured without notching the top face.
    const plan = resolveLidGripHeightPlan(grip({ mode: 'scallop' }), STANDARD, 5);
    expect(plan.heightMm).toBeLessThan(LID_GRIP_SCALLOP_HEIGHT_MM);
    expect(plan.clamped).toBe(true);
    expect(plan.limitedBy).toBe('skirt');
    // The clamp binds, so the relief stops exactly at the reserved skin.
    expect(plan.skinMm).toBeCloseTo(LID_GRIP_TOP_SKIN_MM, 9);
    expect(STANDARD + plan.heightMm).toBeCloseTo(-LID_GRIP_TOP_SKIN_MM, 9);
  });

  it('reports the material left above a relief that fits', () => {
    // The point of the height knob (#3272): the reporter needed to see, and
    // then raise, the lid left over a pocket that prints upside down.
    const plan = resolveLidGripHeightPlan(grip({ mode: 'scallop', heightMm: 4 }), -8, 5);
    expect(plan.skirtMm).toBeCloseTo(8, 9);
    expect(plan.skinMm).toBeCloseTo(4, 9);
  });

  it('never returns a negative height when the seam is at the top face', () => {
    expect(resolveLidGripHeightPlan(grip({ mode: 'scallop' }), 0, 5).heightMm).toBe(0);
    expect(resolveLidGripHeightPlan(grip({ mode: 'scallop' }), -0.1, 5).heightMm).toBe(0);
    expect(resolveLidGripHeightPlan(grip({ mode: 'scallop' }), -0.1, 5).skinMm).toBeCloseTo(0.1, 9);
  });
});

describe('lidGripRequestedHeightMm', () => {
  it('falls back to the mode request when the height is auto', () => {
    expect(lidGripRequestedHeightMm({ mode: 'scallop', heightMm: null })).toBe(
      LID_GRIP_SCALLOP_HEIGHT_MM
    );
    expect(lidGripRequestedHeightMm({ mode: 'reveal', heightMm: null })).toBe(
      LID_GRIP_REVEAL_HEIGHT_MM
    );
  });

  it('is zero for a lid with no relief', () => {
    expect(lidGripRequestedHeightMm({ mode: 'none', heightMm: 4 })).toBe(0);
  });
});

describe('LID_CLICK_RAIL_COVERAGE_OPTIONS', () => {
  it('reaches the maximum exactly', () => {
    // The list is generated as MIN + i*STEP, so start and spacing are
    // tautologies of the generator. Landing ON the maximum is not: a step that
    // does not divide the range would stop short.
    expect(LID_CLICK_RAIL_COVERAGE_OPTIONS.at(-1)).toBe(LID_CLICK_RAIL_COVERAGE_MAX);
    expect(LID_CLICK_RAIL_COVERAGE_OPTIONS[0]).toBe(LID_CLICK_RAIL_COVERAGE_MIN);
  });

  it('round-trips every option through migration unchanged', () => {
    // The property the stop list actually has to hold: `migrateClickRailCoverage`
    // snaps to the nearest option, so any value that is a stop must survive a
    // load. Dropping one silently re-renders every design saved at it.
    for (const coverage of LID_CLICK_RAIL_COVERAGE_OPTIONS) {
      const result = migrateParams({
        lid: { ...DEFAULT_BIN_PARAMS.lid, clickRailCoverage: coverage },
      });
      expect(result.lid.clickRailCoverage).toBe(coverage);
    }
  });

  it('still contains the three stops designs were saved with', () => {
    // Dropping any of these would make `migrateClickRailCoverage` snap saved
    // designs onto a neighbour and quietly change a printed lid.
    for (const legacy of [50, 75, 100]) {
      expect(LID_CLICK_RAIL_COVERAGE_OPTIONS).toContain(legacy);
    }
  });
});
