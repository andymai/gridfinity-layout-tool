// @vitest-environment node
/**
 * Spec-regression: the lightweight floor relief must never intrude into a magnet
 * hole.
 *
 * The Gridfinity baseplate spec fixes the magnet holes at ±13mm from each cell
 * centre, 6.5mm diameter, with a retaining floor — bins rely on those magnets
 * seating fully. The lightweight relief is a separate, optional underside cut
 * that removes material *between* the magnet pads; it is bounded to stay clear
 * of them (`padHalf = HOLE_OFFSET - magnetRadius - PAD_MARGIN`). If a future
 * change to the relief profile (e.g. the corner shape) ever let it reach a
 * magnet hole, it would eat into the magnet pocket and break retention.
 *
 * This pins the invariant directly: the boolean intersection of every magnet
 * hole with every relief cutter has zero volume, with PAD_MARGIN (1mm) of
 * clearance to spare.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume, intersect } from 'brepjs';
import { isOk } from '@/core/result';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildMagnetHoles } from './baseplateMagnets';
import { buildLightweightFloorCutters } from './lightweightFloorCutter';

const vol = (s: Parameters<typeof measureVolume>[0]): number => {
  const r = measureVolume(s);
  if (!isOk(r)) throw new Error('measureVolume failed');
  return r.value;
};

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

describe('lightweight relief vs magnet holes — spec clearance', () => {
  const GU = 42;
  const magnetRadius = 3.25; // 6.5mm dia (spec default)
  const magnetDepth = 2.4;
  const cellOpts = {
    fractionalEdgeX: 'end' as const,
    fractionalEdgeY: 'end' as const,
    gridUnitMm: GU,
  };

  it('relief never overlaps any magnet hole (1x1)', () => {
    const holes = buildMagnetHoles(1, 1, magnetRadius, magnetDepth, cellOpts);
    const cutters = buildLightweightFloorCutters(1, 1, magnetRadius, magnetDepth, cellOpts);

    // Guard against a vacuous pass: the cell must actually have 4 magnets and
    // a relief cutter, otherwise there'd be nothing to clear.
    expect(holes.length, 'magnet holes per full cell').toBe(4);
    expect(cutters.length, 'relief cutter present').toBeGreaterThan(0);

    try {
      for (const hole of holes) {
        for (const cutter of cutters) {
          const i = intersect(hole, cutter);
          const overlap = isOk(i) ? vol(i.value) : NaN;
          expect(overlap, 'magnet-hole ∩ relief overlap volume').toBeLessThan(0.01);
        }
      }
    } finally {
      for (const h of holes) h.delete();
      for (const c of cutters) c.delete();
    }
  }, 60_000);

  it('relief never overlaps any magnet hole across a 2x2 split', () => {
    const holes = buildMagnetHoles(2, 2, magnetRadius, magnetDepth, cellOpts);
    const cutters = buildLightweightFloorCutters(2, 2, magnetRadius, magnetDepth, cellOpts);

    expect(holes.length, 'magnet holes (4 cells × 4)').toBe(16);
    expect(cutters.length, 'relief cutters (one per cell)').toBe(4);

    try {
      let maxOverlap = 0;
      for (const hole of holes) {
        for (const cutter of cutters) {
          const i = intersect(hole, cutter);
          if (isOk(i)) maxOverlap = Math.max(maxOverlap, vol(i.value));
        }
      }
      expect(maxOverlap, 'largest magnet-hole ∩ relief overlap').toBeLessThan(0.01);
    } finally {
      for (const h of holes) h.delete();
      for (const c of cutters) c.delete();
    }
  }, 120_000);
});
