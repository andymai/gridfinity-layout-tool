import { describe, it, expect } from 'vitest';
import { resolveLidInputs, chamferApexXForCavityWall } from './lidBuilder';
import { LID_CLICK_RAIL_INNER, LID_CLICK_RAIL_TOP_CHAMFER } from './lidConstants';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, LidConfig } from '@/features/bin-designer/types';

function makeParams(lid: Partial<LidConfig> = {}, extra: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...extra,
    lid: { ...DEFAULT_BIN_PARAMS.lid, ...lid },
  };
}

describe('resolveLidInputs', () => {
  it('derives outer dimensions from bin width/depth and grid unit', () => {
    const inputs = resolveLidInputs(makeParams({}, { width: 3, depth: 2 }));
    // bin*42 − 2 × fitClearance (0.2) − 2 × LIP_BIG_TAPER (1.9). The
    // LIP_BIG_TAPER subtraction sinks the lid INSIDE the bin's lip
    // vertical part so the lid's exterior matches the lip's inner face;
    // eliminates the chamfer step that used to flare the upper section
    // outward above the lip-mating zone.
    expect(inputs.lidOuterW).toBeCloseTo(3 * 42 - 2 * 0.2 - 2 * 1.9, 3);
    expect(inputs.lidOuterD).toBeCloseTo(2 * 42 - 2 * 0.2 - 2 * 1.9, 3);
    expect(inputs.cellsX).toBe(3);
    expect(inputs.cellsY).toBe(2);
  });

  it('uses the locked-down fit clearance regardless of legacy config', () => {
    // The loose/standard/tight preset map was retired — there's now one
    // validated value, baked into `lidConstants.LID_FIT_CLEARANCE`.
    const inputs = resolveLidInputs(makeParams({}));
    expect(inputs.fitClearance).toBeCloseTo(0.2, 4);
  });

  it('uses the locked-down wall thickness regardless of legacy config', () => {
    // wallThickness was removed from LidConfig — `resolveLidInputs` now
    // sources it from `lidConstants.LID_WALL_THICKNESS`.
    const inputs = resolveLidInputs(makeParams({}));
    expect(inputs.wallThickness).toBe(1.2);
  });

  it('top thickness defaults to baseline when magnets are off', () => {
    const inputs = resolveLidInputs(makeParams({ magnetHoles: false }));
    expect(inputs.topThickness).toBe(1.2);
  });

  it('top thickness grows to fit a deeper magnet pocket', () => {
    // Magnet pocket needs `magnetDepth` of depth + a sealed ceiling
    // (LID_MAGNET_CEILING = 0.6mm). For a 2.5mm magnet the floor must be
    // ≥ 3.1mm, well above the 1.2mm baseline.
    const inputs = resolveLidInputs(
      makeParams(
        { enabled: true, stackableTop: true, magnetHoles: true },
        { base: { ...DEFAULT_BIN_PARAMS.base, magnetDepth: 2.5 } }
      )
    );
    expect(inputs.topThickness).toBeCloseTo(3.1, 4);
  });

  it('skips magnet pockets when stackableTop is off, even if persisted flag is true', () => {
    // Magnets only do something when there's a stack grid above; gate at
    // resolve time so the worker never cuts useless pockets.
    const inputs = resolveLidInputs(makeParams({ stackableTop: false, magnetHoles: true }));
    expect(inputs.stackableTop).toBe(false);
    expect(inputs.magnetHoles).toBe(false);
  });

  it('keeps magnet pockets when both stackableTop and magnetHoles are on', () => {
    const inputs = resolveLidInputs(makeParams({ stackableTop: true, magnetHoles: true }));
    expect(inputs.stackableTop).toBe(true);
    expect(inputs.magnetHoles).toBe(true);
  });

  it('inherits magnet diameter and depth from bin BaseConfig', () => {
    const inputs = resolveLidInputs(
      makeParams(
        { magnetHoles: true },
        { base: { ...DEFAULT_BIN_PARAMS.base, magnetDiameter: 6.0, magnetDepth: 2.5 } }
      )
    );
    expect(inputs.magnetDiameter).toBe(6.0);
    expect(inputs.magnetDepth).toBe(2.5);
  });

  it('omits front/back rails when bin has label tabs (label sits on back wall)', () => {
    const withLabel = resolveLidInputs(
      makeParams({}, { label: { ...DEFAULT_BIN_PARAMS.label, enabled: true } })
    );
    expect(withLabel.omitFrontBackRails).toBe(true);
  });

  it('keeps all four rails when bin has no label tabs', () => {
    const noLabel = resolveLidInputs(makeParams({}));
    expect(noLabel.omitFrontBackRails).toBe(false);
  });

  it('anchorZ sits within the lid (above wall bottom, below floor top)', () => {
    const inputs = resolveLidInputs(makeParams({}));
    expect(inputs.anchorZ).toBeLessThan(0);
    expect(inputs.anchorZ).toBeGreaterThan(inputs.wallBottomZ);
  });

  it('converts clickRailCoverage from percent (0–100) to fraction (0–1)', () => {
    expect(resolveLidInputs(makeParams({ clickRailCoverage: 100 })).clickRailCoverage).toBe(1);
    expect(resolveLidInputs(makeParams({ clickRailCoverage: 75 })).clickRailCoverage).toBe(0.75);
    expect(resolveLidInputs(makeParams({ clickRailCoverage: 50 })).clickRailCoverage).toBe(0.5);
  });
});

describe('chamferApexXForCavityWall', () => {
  // The rail spine sits at the lid's corner-radius line; the cavity wall
  // sits at `lidCornerR - cavityInset` from the spine in the outward (+X)
  // direction. The top-chamfer apex must land on the cavity wall so the
  // rail attaches flush — otherwise a thin tongue hangs unsupported into
  // the cavity, leaving a printable gap.

  it('extends the chamfer apex to the cavity wall at default wallThickness (1.2mm)', () => {
    // For default params: lidCornerR = 3.55, cavityInset = 3.1.
    // cavityWallX = 3.55 - 3.1 = 0.45 → chamfer apex must reach +0.45,
    // 0.45mm beyond the original spine-aligned default.
    const cavityWallX = 3.55 - 3.1;
    expect(chamferApexXForCavityWall(cavityWallX)).toBeCloseTo(0.45, 6);
  });

  it('falls back to the baseline 0.8mm chamfer at the design-target wallThickness (~1.85mm)', () => {
    // wallThickness = 1.85 → cavityInset = 1.85 + 1.9 = 3.75 = lidCornerR
    // → cavityWallX = 0. The baseline chamfer (LID_CLICK_RAIL_INNER + 0.8)
    // already reaches the cavity wall, so no extra extension is needed.
    expect(chamferApexXForCavityWall(0)).toBeCloseTo(
      LID_CLICK_RAIL_INNER + LID_CLICK_RAIL_TOP_CHAMFER,
      6
    );
  });

  it('clamps to baseline when cavity wall is inboard of the rail spine (thick walls)', () => {
    // wallThickness 2.4mm: cavityInset = 4.3, cavityWallX = -0.75.
    // The cavity wall is now INSIDE the rail body, so the chamfer just
    // needs to provide a clean transition — keep the 0.8mm baseline.
    expect(chamferApexXForCavityWall(-0.75)).toBeCloseTo(
      LID_CLICK_RAIL_INNER + LID_CLICK_RAIL_TOP_CHAMFER,
      6
    );
  });

  it('produces a 45° chamfer slope (apex-X equals the chamfer height above the inner face)', () => {
    // The slope from (LID_CLICK_RAIL_INNER, yTop) to (apex, yTop + h) is
    // 45° iff h equals (apex - LID_CLICK_RAIL_INNER). Verifies the
    // geometric invariant the rail extrusion relies on for clean prints.
    const cavityWallX = 0.45;
    const apex = chamferApexXForCavityWall(cavityWallX);
    const height = apex - LID_CLICK_RAIL_INNER;
    expect(apex - LID_CLICK_RAIL_INNER).toBeCloseTo(height, 6);
    expect(apex).toBeGreaterThan(LID_CLICK_RAIL_INNER);
  });
});
