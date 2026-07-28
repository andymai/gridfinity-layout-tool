// @vitest-environment node
/**
 * Cross-layer guard: the `lidCompatibility` `magnetBinTooSmall` blocker must fire
 * exactly when the real retention-magnet pad geometry would merge (#2698).
 *
 * The four corner gusset pads each reach inward by a full boss radius, so on a
 * narrow band of small bins the opposite pads collide into a blob at the centre
 * instead of four clean corners. `checkLidCompatibility` blocks that case, but it
 * HAND-MIRRORS the worker's `LID_MAGNET_LIP_CLEARANCE` and `LID_MAGNET_BOSS_WALL`
 * as local literals ("keep in sync by hand") to avoid a cross-feature import. If
 * either mirror drifts from the worker constant, the guard's threshold and the
 * actual pad placement diverge: the guard would reject valid bins, or worse pass
 * bins whose pads merge (the #2698 defect). The geometry's own placement tests
 * only check that a pad stays inside the footprint, never that adjacent pads
 * clear each other, so nothing catches that drift today.
 *
 * This pins the two layers together behaviourally: the guard blocks iff the real
 * pad geometry (from `retentionMagnetGeometry`, which uses the worker constants)
 * would merge. Pure math, no kernel.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { checkLidCompatibility } from '@/shared/types/bin';
import type { BinParams } from '@/shared/types/bin';
import {
  retentionMagnetPositions,
  retentionMagnetInset,
  retentionBossRadius,
} from './retentionMagnetGeometry';

function magneticBin(o: {
  width: number;
  depth: number;
  gridUnitMm: number;
  gridUnitMmY?: number;
  diameter: number;
}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: o.width,
    depth: o.depth,
    height: 3,
    gridUnitMm: o.gridUnitMm,
    gridUnitMmY: o.gridUnitMmY ?? o.gridUnitMm,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'magnetic',
      retentionMagnet: { ...DEFAULT_BIN_PARAMS.lid.retentionMagnet, diameter: o.diameter },
    },
  };
}

/** The compatibility layer blocks the bin as too small for four clean pads. */
function guardBlocks(params: BinParams): boolean {
  return checkLidCompatibility(params).some((i) => i.id === 'magnetBinTooSmall');
}

/** The ACTUAL corner-pad geometry would overlap two pads (their disks intersect). */
function geometryMerges(params: BinParams): boolean {
  const d = params.lid.retentionMagnet.diameter;
  const r = retentionBossRadius(d);
  const guY = params.gridUnitMmY ?? params.gridUnitMm;
  const pos = retentionMagnetPositions(
    params.width,
    params.depth,
    params.gridUnitMm,
    guY,
    retentionMagnetInset(d)
  );
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) {
      const dx = pos[i].x - pos[j].x;
      const dy = pos[i].y - pos[j].y;
      if (Math.hypot(dx, dy) < 2 * r - 1e-9) return true;
    }
  }
  return false;
}

const DIAMETERS = [4, 6, 8];

describe('retention-magnet pad merge: guard matches geometry (#2698)', () => {
  for (const diameter of DIAMETERS) {
    // True geometry threshold (mm half-extent) below which adjacent pads merge.
    const threshold = retentionMagnetInset(diameter) + retentionBossRadius(diameter);

    describe(`${diameter}mm magnet`, () => {
      it.each([
        ['well below', threshold - 2],
        ['just below', threshold - 0.2],
        ['just above', threshold + 0.2],
        ['well above', threshold + 2],
      ])('guard blocks iff pads merge, %s the threshold (width axis)', (_label, halfMm) => {
        // width=1 with gridUnitMm = 2*halfMm puts the X half-extent exactly at
        // halfMm; the depth axis is kept generous so only the X pads can collide.
        const params = magneticBin({
          width: 1,
          depth: 4,
          gridUnitMm: 2 * halfMm,
          gridUnitMmY: 42,
          diameter,
        });
        expect(guardBlocks(params)).toBe(geometryMerges(params));
      });

      it('applies the same equivalence to the depth axis on a non-square grid', () => {
        // Generous X, tight Y just below the threshold — the Y-edge pads merge and
        // the guard must catch it via the depth term, not just width.
        const params = magneticBin({
          width: 4,
          depth: 1,
          gridUnitMm: 42,
          gridUnitMmY: 2 * (threshold - 0.2),
          diameter,
        });
        expect(geometryMerges(params)).toBe(true);
        expect(guardBlocks(params)).toBe(true);
      });
    });
  }

  it('a larger magnet blocks a bin the smaller magnet allows (threshold tracks diameter)', () => {
    // Half-extent = 11.0mm: clears the 4mm magnet's ~9.5mm threshold but not the
    // 8mm magnet's ~13.5mm one. The guard must follow the geometry both ways.
    const small = magneticBin({ width: 1, depth: 4, gridUnitMm: 22, gridUnitMmY: 42, diameter: 4 });
    const large = magneticBin({ width: 1, depth: 4, gridUnitMm: 22, gridUnitMmY: 42, diameter: 8 });
    expect(guardBlocks(small)).toBe(false);
    expect(geometryMerges(small)).toBe(false);
    expect(guardBlocks(large)).toBe(true);
    expect(geometryMerges(large)).toBe(true);
  });
});
