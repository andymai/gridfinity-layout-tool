// @vitest-environment node
/**
 * Gridfinity stacking divisibility guard (#2416).
 *
 * The reporter believed stacks overshoot because each bin carries a 4.3mm lip.
 * They don't: the lip nests into the socket of the bin above, so the stacking
 * pitch equals the bin's BODY height (`height × heightUnitMm`), and only the
 * topmost lip is exposed. Two H-unit bins therefore stack to exactly the height
 * of one 2H-unit bin. The #2416 fix relies on this invariant (see
 * `stackPitchMm`/`stackedTotalMm` in `heightUnits.ts`) rather than changing the
 * geometry — so this asserts the geometry actually keeps its side of the
 * bargain, measured on the real generated solid.
 *
 * Method: generate a bin, drop an identical copy onto it via CSG, and check the
 * collision-free seat is at body height (lip fully nested), then confirm a
 * body-height stack equals the single 2H bin's mesh height.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume, translate, intersect } from 'brepjs';
import { isOk } from '@/core/result';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { STACK_LIP_MM } from '@/shared/utils/heightUnits';
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

/**
 * @param label human-readable config name
 * @param height single-bin height in units; the stack of two is checked against
 *   a bin of `2 × height` units at the same unit size.
 */
function assertDivisibility(label: string, base: BinParams, height: number): void {
  const bodyH = height * base.heightUnitMm;
  const generateBin = getGenerateBin();

  clearAllCaches();
  const single = generateBin({ ...base, height }, undefined, true);
  const singleH = meshHeight(single.vertices);
  const solid = getLastSolid();
  if (!solid) throw new Error(`${label}: no solid`);

  // One bin prints to body + exactly one lip.
  expect(singleH, `${label}: single-bin height`).toBeCloseTo(bodyH + STACK_LIP_MM, 1);

  // Seats cleanly at body height (lip nests into the socket above)…
  expect(overlapAtPitch(solid, bodyH), `${label}: overlap at body-height pitch`).toBeLessThan(0.05);
  // …and the seat is real geometry, not two hollow shells passing through each
  // other — dropping 1mm lower drives the lip hard into the socket.
  expect(overlapAtPitch(solid, bodyH - 1), `${label}: overlap below the seat`).toBeGreaterThan(5);

  clearAllCaches();
  const doubleBin = generateBin({ ...base, height: height * 2 }, undefined, true);
  const doubleH = meshHeight(doubleBin.vertices);

  // Divisibility: two H-unit bins stacked at body-height pitch reach exactly the
  // height of one 2H-unit bin.
  expect(bodyH + singleH, `${label}: 2×${height}u stack vs 1×${height * 2}u bin`).toBeCloseTo(
    doubleH,
    1
  );
}

describe('stacking divisibility — nested lip keeps 2×Hu == 1×2Hu (#2416)', () => {
  it(
    'holds at the standard 7mm unit',
    () => assertDivisibility('7mm 3u', { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2 }, 3),
    180_000
  );

  it(
    'holds at a custom non-standard unit',
    () =>
      assertDivisibility(
        'custom 9.362mm 2u',
        { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, heightUnitMm: 9.362 },
        2
      ),
    180_000
  );
});
