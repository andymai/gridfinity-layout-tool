// @vitest-environment node
/**
 * Where a stacked bin actually seats, and what that costs divisibility.
 *
 * This guard was written (#2416) for the claim that the pitch equals the bin's
 * BODY height, so two H-unit bins stack to exactly one 2H-unit bin. Mating the
 * solids disproved it (#3525): the bin above settles `STACK_JUNCTION_MM` below
 * the lip top, which is one base profile rather than one lip, so the pitch runs
 * 0.45mm under the body and a 2-bin stack lands that much short of the single
 * tall bin. Divisibility is off by 0.45mm per junction, not exact.
 *
 * The original method could not have caught it: it asked whether the pair
 * INTERSECTS at body height, and a bin resting 0.45mm lower does not intersect
 * there — it floats clear. Non-interference brackets the seat between two
 * pitches; it never locates it. So the seat is now pinned from both sides, a
 * tenth of a millimetre apart, which is a measurement rather than a bound.
 *
 * CSG volume here, ray descent in `binStackSeating.kernel.test.ts` — two
 * independent methods on the same joint, deliberately.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume, translate, intersect } from 'brepjs';
import { isOk } from '@/core/result';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { LIP_PROTRUSION_MM, STACK_JUNCTION_MM, stackPitchMm } from '@/shared/utils/heightUnits';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { getLastSolid, clearAllCaches } from './shapeCache';

const vol = (s: Parameters<typeof measureVolume>[0]): number => {
  const r = measureVolume(s);
  if (!isOk(r)) throw new Error('measureVolume failed');
  return r.value;
};

function meshHeight(vertices: Float32Array): number {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 2; i < vertices.length; i += 3) {
    const z = vertices[i];
    if (z < min) min = z;
    if (z > max) max = z;
  }
  return max - min;
}

/** Overlap volume when an identical bin is seated `pitch` mm above `solid`. */
function overlapAtPitch(
  solid: NonNullable<ReturnType<typeof getLastSolid>>,
  pitch: number
): number {
  const upper = translate(solid, [0, 0, pitch]);
  try {
    const r = intersect(solid, upper);
    // Fail loudly rather than reporting 0 overlap — a swallowed boolean error
    // would let the "seats cleanly" assertion pass vacuously.
    if (!isOk(r)) throw new Error(`intersect failed at pitch ${pitch}`);
    try {
      return vol(r.value);
    } finally {
      r.value.delete();
    }
  } finally {
    upper.delete();
  }
}

beforeAll(async () => {
  await initBrepjs();
}, 60000);

/** How far below the seat the pair is probed for the interference side. */
const PROBE_MM = 0.1;

/**
 * @param label human-readable config name
 * @param height single-bin height in units; the stack of two is checked against
 *   a bin of `2 × height` units at the same unit size.
 */
function assertSeating(label: string, base: BinParams, height: number): void {
  const bodyH = height * base.heightUnitMm;
  const pitch = stackPitchMm(height, base.heightUnitMm);
  const generateBin = getGenerateBin();

  clearAllCaches();
  const single = generateBin({ ...base, height }, undefined, true);
  const singleH = meshHeight(single.vertices);
  const solid = getLastSolid();
  if (!solid) throw new Error(`${label}: no solid`);

  // One bin prints to body + exactly one lip.
  expect(singleH, `${label}: single-bin height`).toBeCloseTo(bodyH + LIP_PROTRUSION_MM, 1);

  // The seat, pinned from both sides. Clear at the pitch the readout quotes…
  expect(overlapAtPitch(solid, pitch), `${label}: overlap at the quoted pitch`).toBeLessThan(0.05);
  // …and biting a tenth of a millimetre lower, so the pair really does come to
  // rest here rather than somewhere in a gap this test never looked at.
  expect(
    overlapAtPitch(solid, pitch - PROBE_MM),
    `${label}: overlap just below the seat`
  ).toBeGreaterThan(0);

  // Body height is NOT the seat: the bin above still floats there.
  expect(pitch, `${label}: pitch sits under body height`).toBeLessThan(bodyH);

  clearAllCaches();
  const doubleBin = generateBin({ ...base, height: height * 2 }, undefined, true);
  const doubleH = meshHeight(doubleBin.vertices);

  // Divisibility, and how far it misses: two H-unit bins stack to one junction
  // less than the single 2H-unit bin standing beside them.
  expect(pitch + singleH, `${label}: 2×${height}u stack vs 1×${height * 2}u bin`).toBeCloseTo(
    doubleH - (STACK_JUNCTION_MM - LIP_PROTRUSION_MM),
    1
  );
}

describe('stacking seat — where a bin rests on the lip below (#2416, #3525)', () => {
  it(
    'holds at the standard 7mm unit',
    () => assertSeating('7mm 3u', { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2 }, 3),
    180_000
  );

  it(
    'holds at a custom non-standard unit',
    () =>
      assertSeating(
        'custom 9.362mm 2u',
        { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, heightUnitMm: 9.362 },
        2
      ),
    180_000
  );
});
