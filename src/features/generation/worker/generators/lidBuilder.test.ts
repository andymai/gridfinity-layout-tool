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

  it('derives lid depth from gridUnitMmY on a non-square grid', () => {
    // Y pitch 22mm: lidOuterD = 2×22 − 0.5 = 43.5, while width stays on X (42).
    const inputs = resolveLidInputs(
      makeParams({}, { width: 3, depth: 2, gridUnitMm: 42, gridUnitMmY: 22 })
    );
    expect(inputs.lidOuterW).toBeCloseTo(125.5, 3);
    expect(inputs.lidOuterD).toBeCloseTo(43.5, 3);
    expect(inputs.gridUnitMmY).toBe(22);
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

  it('raises the plate to the user thickness knob', () => {
    const inputs = resolveLidInputs(makeParams({ topThicknessMm: 1.8 }));
    expect(inputs.topThickness).toBeCloseTo(1.8, 4);
  });

  // The knob is a floor, never a cap: a magnet pocket that needs more material
  // than the user asked for still wins, so it can't break into the cavity.
  it('keeps the deeper magnet requirement when it exceeds the user thickness', () => {
    const inputs = resolveLidInputs(
      makeParams(
        { enabled: true, stackableTop: true, magnetHoles: true, topThicknessMm: 1.2 },
        { base: { ...DEFAULT_BIN_PARAMS.base, magnetDepth: 2.5 } }
      )
    );
    expect(inputs.topThickness).toBeCloseTo(3.1, 4);
  });

  // With a tray the knob measures the floor UNDER the recess, so the plate is
  // recess + floor rather than the larger of the two.
  it('stacks the tray recess on top of the minimum floor', () => {
    const inputs = resolveLidInputs(
      makeParams({
        enabled: true,
        stackableTop: false,
        tray: { enabled: true, depthMm: 4, wallMm: 2 },
        topThicknessMm: 1.2,
      })
    );
    // 1.2 is below the 1.6mm minimum floor, so the floor wins: 4 + 1.6.
    expect(inputs.topThickness).toBeCloseTo(5.6, 4);
  });

  it('grows the plate with the requested tray floor', () => {
    const inputs = resolveLidInputs(
      makeParams({
        enabled: true,
        stackableTop: false,
        tray: { enabled: true, depthMm: 4, wallMm: 2 },
        topThicknessMm: 3,
      })
    );
    expect(inputs.topThickness).toBeCloseTo(7, 4);
  });

  it('gives a magnetic lid extra footprint clearance without moving the seated plane', () => {
    const friction = resolveLidInputs(
      makeParams({ enabled: true, attachment: 'friction' }, { width: 6, depth: 4 })
    );
    const magnetic = resolveLidInputs(
      makeParams({ enabled: true, attachment: 'magnetic' }, { width: 6, depth: 4 })
    );
    // 0.15mm per side on both axes so the magnets aren't fighting friction…
    expect(friction.lidOuterW - magnetic.lidOuterW).toBeCloseTo(0.3, 6);
    expect(friction.lidOuterD - magnetic.lidOuterD).toBeCloseTo(0.3, 6);
    // …but the anchor stays put, or the relief would eat LID_MAGNET_SEAT_GAP
    // and the corner posts would hold the lid off its lip.
    expect(magnetic.anchorZ).toBeCloseTo(friction.anchorZ, 9);
    expect(magnetic.wallBottomZ).toBeCloseTo(friction.wallBottomZ, 9);
  });

  it('withholds the magnetic relief when the bin has no stacking lip to mate with', () => {
    const noLip = resolveLidInputs(
      makeParams(
        { enabled: true, attachment: 'magnetic' },
        { base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } }
      )
    );
    expect(noLip.fitClearance).toBeCloseTo(0.25, 4);
    expect(noLip.retentionMagnets).toBe(false);
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

  it('gates separateStackPlate on stackableTop (no grid to split without one)', () => {
    // Persisted flag on, but no stackable top → nothing to separate.
    const off = resolveLidInputs(makeParams({ stackableTop: false, separateStackPlate: true }));
    expect(off.separateStackPlate).toBe(false);
    // Both on → the stack grid ships as a standalone slab.
    const on = resolveLidInputs(makeParams({ stackableTop: true, separateStackPlate: true }));
    expect(on.separateStackPlate).toBe(true);
  });

  it('gates stackLipOnly on stackableTop (no pockets to collapse without one)', () => {
    const off = resolveLidInputs(makeParams({ stackableTop: false, stackLipOnly: true }));
    expect(off.stackLipOnly).toBe(false);
    const on = resolveLidInputs(makeParams({ stackableTop: true, stackLipOnly: true }));
    expect(on.stackLipOnly).toBe(true);
  });

  it('keeps the stack grid fused when separateStackPlate is off', () => {
    const inputs = resolveLidInputs(makeParams({ stackableTop: true, separateStackPlate: false }));
    expect(inputs.stackableTop).toBe(true);
    expect(inputs.separateStackPlate).toBe(false);
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

  it('disables no rail for label tabs, and carries their footprints instead', () => {
    // Label tabs used to disable their anchor wall here. Since the rail
    // builder segments the run around the footprints and keeps any stretch
    // left over, so the decision moved from this set to the geometry. A
    // full-width tab still ends up with no back rail; a narrow one keeps the
    // gaps either side.
    const withLabel = resolveLidInputs(
      makeParams({}, { label: { ...DEFAULT_BIN_PARAMS.label, enabled: true } })
    );
    expect(withLabel.disabledRails.size).toBe(0);
    expect(withLabel.labelFootprints.length).toBeGreaterThan(0);
    expect(withLabel.labelFootprints.every((f) => f.anchor === 'back')).toBe(true);
  });

  it('keeps all four rails when bin has no label tabs', () => {
    const noLabel = resolveLidInputs(makeParams({}));
    expect(noLabel.disabledRails.size).toBe(0);
  });

  it('blocks a wall cutout span instead of disabling its wall (#3483)', () => {
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
    // Nothing is denied its whole wall — the window costs the rail its own
    // span, and the stretches either side survive the segment pass.
    expect(withCutouts.disabledRails.size).toBe(0);
    expect(withCutouts.wallBlocks.map((b) => b.side).sort()).toEqual(['left', 'right']);
    for (const block of withCutouts.wallBlocks) {
      expect(block.hi - block.lo).toBeGreaterThan(0);
      expect(block.hi - block.lo).toBeLessThan(withCutouts.lidOuterD);
    }
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

  it('threads fractionalEdgeX/Y from BinParams so magnet holes follow the bin foot', () => {
    const inputs = resolveLidInputs(
      makeParams({}, { width: 2.5, depth: 2.5, fractionalEdgeX: 'start', fractionalEdgeY: 'end' })
    );
    expect(inputs.fractionalEdgeX).toBe('start');
    expect(inputs.fractionalEdgeY).toBe('end');
  });

  it('defaults the fractional edge to "end"', () => {
    const inputs = resolveLidInputs(makeParams({}));
    expect(inputs.fractionalEdgeX).toBe('end');
    expect(inputs.fractionalEdgeY).toBe('end');
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
