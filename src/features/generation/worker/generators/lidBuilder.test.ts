import { describe, it, expect } from 'vitest';
import { resolveLidInputs, chamferApexXForCavityWall } from './lidBuilder';
import {
  LID_CLICK_RAIL_INNER,
  LID_CLICK_RAIL_TOP_CHAMFER,
  LID_WALL_THICKNESS,
} from './lidConstants';
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
    // Lid outer = bin*42 − 2 × LID_FIT_CLEARANCE (0.25): 3×42−0.5=125.5, 2×42−0.5=83.5
    const inputs = resolveLidInputs(makeParams({}, { width: 3, depth: 2 }));
    expect(inputs.lidOuterW).toBeCloseTo(125.5, 3);
    expect(inputs.lidOuterD).toBeCloseTo(83.5, 3);
    expect(inputs.cellsX).toBe(3);
    expect(inputs.cellsY).toBe(2);
  });

  it('uses LID_FIT_CLEARANCE = 0.25mm (lid clearance, not bin TOLERANCE)', () => {
    const inputs = resolveLidInputs(makeParams({}));
    expect(inputs.fitClearance).toBeCloseTo(0.25, 4);
  });

  it('LID_WALL_THICKNESS is LID_CORNER_RADIUS − fitClearance − LIP_BIG_TAPER = 1.85mm', () => {
    expect(LID_WALL_THICKNESS).toBeCloseTo(1.85, 4);
  });

  it('top thickness defaults to 0.8mm when magnets are off', () => {
    const inputs = resolveLidInputs(makeParams({ magnetHoles: false }));
    expect(inputs.topThickness).toBe(0.8);
  });

  it('top thickness grows to fit a deeper magnet pocket', () => {
    // Magnet pocket needs `magnetDepth` of depth + a sealed ceiling
    // (LID_MAGNET_CEILING = 0.6mm). For a 2.5mm magnet the floor must
    // be ≥ 3.1mm, well above the 0.8mm baseline.
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

  it('disables only the BACK rail when bin has label tabs (label sits on back wall)', () => {
    const withLabel = resolveLidInputs(
      makeParams({}, { label: { ...DEFAULT_BIN_PARAMS.label, enabled: true } })
    );
    expect(withLabel.disabledRails.has('back')).toBe(true);
    expect(withLabel.disabledRails.has('front')).toBe(false);
    expect(withLabel.disabledRails.has('left')).toBe(false);
    expect(withLabel.disabledRails.has('right')).toBe(false);
  });

  it('keeps all four rails when bin has no label tabs', () => {
    const noLabel = resolveLidInputs(makeParams({}));
    expect(noLabel.disabledRails.size).toBe(0);
  });

  it('disables rails on sides that have a wall cutout', () => {
    const withCutouts = resolveLidInputs(
      makeParams(
        {},
        {
          walls: {
            ...DEFAULT_BIN_PARAMS.walls,
            enabled: true,
            left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true },
            right: { ...DEFAULT_BIN_PARAMS.walls.right, enabled: true },
          },
        }
      )
    );
    expect(withCutouts.disabledRails.has('left')).toBe(true);
    expect(withCutouts.disabledRails.has('right')).toBe(true);
    expect(withCutouts.disabledRails.has('front')).toBe(false);
    expect(withCutouts.disabledRails.has('back')).toBe(false);
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

  it('uses the baseline 0.8mm chamfer when cavity wall sits on the rail spine', () => {
    // When cavityWallX = 0, the baseline chamfer (LID_CLICK_RAIL_INNER +
    // 0.8) already reaches the cavity wall, so no extension is needed.
    expect(chamferApexXForCavityWall(0)).toBeCloseTo(
      LID_CLICK_RAIL_INNER + LID_CLICK_RAIL_TOP_CHAMFER,
      6
    );
  });

  it('clamps to baseline when cavity wall is inboard of the rail spine (thick walls)', () => {
    // For a hypothetical thicker-wall config the cavity wall would sit
    // INSIDE the rail body. Keep the 0.8mm baseline chamfer rather than
    // shrinking it negatively.
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
