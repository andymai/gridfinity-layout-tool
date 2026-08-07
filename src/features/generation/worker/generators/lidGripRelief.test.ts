/**
 * Grip-relief placement math (#3272).
 *
 * `gripPlacements` is the single derivation of where a relief sits — the lid
 * cutter, the click-rail split and the bin's lip dip all read it — so it is
 * worth testing on its own, without the WASM kernel. The geometry it feeds is
 * covered by `lidGripRelief.scenario.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { LID_GRIP_SPAN_MIN_MM, LID_GRIP_SPAN_MAX_MM } from '@/shared/types/bin';
import type { BinParams, LidGripConfig } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import { resolveLidInputs } from './lidInputs';
import { gripPlacements } from './lidGripRelief';

const ALL_SIDES = { front: true, back: true, left: true, right: true } as const;

function makeParams(grip: Partial<LidGripConfig>, over: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 4,
    depth: 3,
    height: 4,
    ...over,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      grip: { ...DEFAULT_BIN_PARAMS.lid.grip, sides: ALL_SIDES, ...grip },
    },
  };
}

const placementsFor = (grip: Partial<LidGripConfig>, over: Partial<BinParams> = {}) =>
  gripPlacements(resolveLidInputs(makeParams(grip, over)));

describe('gripPlacements', () => {
  it('produces nothing when the relief is off', () => {
    expect(placementsFor({ mode: 'none' })).toHaveLength(0);
  });

  it('produces nothing when the user turned every wall off', () => {
    expect(
      placementsFor({
        mode: 'scallop',
        sides: { front: false, back: false, left: false, right: false },
      })
    ).toHaveLength(0);
  });

  it('places one relief per enabled wall', () => {
    const sides = placementsFor({ mode: 'scallop' })
      .map((p) => p.side)
      .sort();
    expect(sides).toEqual(['back', 'front', 'left', 'right']);
  });

  it('addresses each wall with the rotation that carries the canonical cutter there', () => {
    const byside = new Map(placementsFor({ mode: 'scallop' }).map((p) => [p.side, p]));
    expect(byside.get('back')?.rotationDeg).toBe(0);
    expect(byside.get('front')?.rotationDeg).toBe(180);
    expect(byside.get('right')?.rotationDeg).toBe(-90);
    expect(byside.get('left')?.rotationDeg).toBe(90);
  });

  it('centres each relief on its wall, at that wall’s outer face', () => {
    const inputs = resolveLidInputs(makeParams({ mode: 'scallop' }));
    const byside = new Map(placementsFor({ mode: 'scallop' }).map((p) => [p.side, p]));
    // Front/back sit at ±D/2 and are centred on X; left/right mirror that.
    expect(byside.get('back')?.centerY).toBeCloseTo(inputs.lidOuterD / 2, 6);
    expect(byside.get('front')?.centerY).toBeCloseTo(-inputs.lidOuterD / 2, 6);
    expect(byside.get('back')?.centerX).toBeCloseTo(0, 6);
    expect(byside.get('right')?.centerX).toBeCloseTo(inputs.lidOuterW / 2, 6);
    expect(byside.get('left')?.centerX).toBeCloseTo(-inputs.lidOuterW / 2, 6);
    expect(byside.get('right')?.centerY).toBeCloseTo(0, 6);
  });

  it('keeps every span within the hand-sized bounds', () => {
    // The span is a percentage of the wall, then clamped — so a 6-wide lid
    // gets a grip, not a 126mm trench, and a 1-wide lid still gets something.
    for (const size of [1, 2, 4, 6]) {
      for (const coverage of [10, 50, 100]) {
        for (const p of placementsFor(
          { mode: 'scallop', coverage },
          { width: size, depth: size }
        )) {
          expect(p.spanMm).toBeLessThanOrEqual(LID_GRIP_SPAN_MAX_MM);
          // The floor gives way only on a wall too short to hold it.
          expect(p.spanMm).toBeGreaterThan(Math.min(LID_GRIP_SPAN_MIN_MM, p.spanMm) - 1e-9);
        }
      }
    }
  });

  it('follows a polygon footprint edge by edge', () => {
    // 3x3 L-shape with the top-right unit removed: the two edges bounding the
    // notch face the same way as two outer edges, so a naive by-side placement
    // would double up.
    const L_SHAPE: CellMask = {
      cols: 6,
      rows: 6,
      cells: [
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1,
        1, 1, 1, 0, 0,
      ],
    };
    const placements = placementsFor(
      { mode: 'scallop' },
      { cellMask: L_SHAPE, width: 3, depth: 3 }
    );
    // Six straight edges on an L, each long enough to carry a relief.
    expect(placements.length).toBeGreaterThan(4);
    for (const p of placements) {
      expect(Number.isFinite(p.centerX)).toBe(true);
      expect(Number.isFinite(p.centerY)).toBe(true);
      expect(p.spanMm).toBeGreaterThan(0);
    }
  });
});
