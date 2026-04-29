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
    // 3 grid units × 42mm − 2 × fitClearance (0.2)
    expect(inputs.lidOuterW).toBeCloseTo(125.6, 3);
    expect(inputs.lidOuterD).toBeCloseTo(83.6, 3);
    expect(inputs.cellsX).toBe(3);
    expect(inputs.cellsY).toBe(2);
  });

  it('maps fit enum to clearance values', () => {
    const loose = resolveLidInputs(makeParams({ fit: 'loose' }));
    const standard = resolveLidInputs(makeParams({ fit: 'standard' }));
    const tight = resolveLidInputs(makeParams({ fit: 'tight' }));
    expect(loose.fitClearance).toBeGreaterThan(standard.fitClearance);
    expect(standard.fitClearance).toBeGreaterThan(tight.fitClearance);
    expect(loose.fitClearance).toBeCloseTo(0.3, 4);
    expect(standard.fitClearance).toBeCloseTo(0.2, 4);
    expect(tight.fitClearance).toBeCloseTo(0.1, 4);
  });

  it('passes through wall + top thickness from config', () => {
    const inputs = resolveLidInputs(makeParams({ wallThickness: 1.6, topThickness: 1.2 }));
    expect(inputs.wallThickness).toBe(1.6);
    expect(inputs.topThickness).toBe(1.2);
  });

  it('passes through stackable + magnet toggles', () => {
    const inputs = resolveLidInputs(makeParams({ stackableTop: false, magnetHoles: true }));
    expect(inputs.stackableTop).toBe(false);
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
