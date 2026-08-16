// @vitest-environment node
/**
 * What a stack of bins really measures (discussion #2374, fixed in #3525).
 *
 * A reporter's calculator put the bin-to-bin junction at 4.87-5.40mm and varied
 * it by configuration; the tool used to answer a flat 4.30mm at every height,
 * on the grounds that the socket bottoms out on the lip and cannot sink
 * further. Both were arguments rather than measurements, and every mesh check
 * passed either way.
 *
 * Mating the two solids says both were partly right. The junction IS one
 * constant, as the tool argued — it does not move with bin height, footprint or
 * height unit, so a per-configuration constant cannot be describing it. But the
 * constant is 4.75mm: the foot's flare and the lip's funnel are parallel 45
 * degree surfaces that mate face to face, so the bin above settles one BASE
 * profile below the lip top, not one lip. The old figure was 0.45mm shy of it
 * and every stack readout inherited the error.
 *
 * The value is stated below as a measurement and never derived. Recomputing it
 * from the socket and lip profiles would only prove the arithmetic
 * self-consistent — the trap that left the question open for two rounds
 * (CLAUDE.md gotchas #14, #18) — so the point of these cases is that a number
 * read off the assembled solids agrees with `STACK_JUNCTION_MM`.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { STACK_JUNCTION_MM, stackPitchMm, stackedTotalMm } from '@/shared/utils/heightUnits';
import { initTestKernel } from '@/test/initTestKernel';
import { stackSeat } from './__kernel-tests__/binStacking';

let generateBin: (params: BinParams, onProgress: undefined, forExport: boolean) => MeshData;

beforeAll(async () => {
  await initTestKernel();
  generateBin = (await import('./binOrchestrator')).generateBin;
}, 60000);

/**
 * The junction the assembled pair actually comes to rest at, in mm. Measured
 * across every case below and unchanging; update it only from a fresh sweep,
 * never from `STACK_JUNCTION_MM` — the two agreeing is the assertion.
 */
const JUNCTION_MM = 4.75;

/**
 * Tessellation slack, in mm. The contact is taper-on-taper, so both faces are
 * planar and the read is near-exact; this leaves room for corner faceting
 * without admitting the 0.45mm the old readout was out by.
 */
const TOLERANCE_MM = 0.05;

interface Spec {
  width?: number;
  depth?: number;
  height?: number;
  heightUnitMm?: number;
  stackingLip?: boolean;
}

const cache = new Map<string, MeshData>();

function bin(spec: Spec = {}): MeshData {
  const { width = 2, depth = 2, height = 3, heightUnitMm = 7, stackingLip = true } = spec;
  const key = `${width}x${depth}x${height}/${heightUnitMm}/${stackingLip}`;
  let mesh = cache.get(key);
  if (!mesh) {
    // Export fidelity, not preview: the preview path meshes the base socket
    // separately and concatenates it, and the surviving coincident
    // socket-top/floor-bottom faces flip `verticalSolidSpans`' enter/exit
    // parity. The probe then reads the cavity as solid and the joint as 5.00.
    mesh = generateBin(
      {
        ...DEFAULT_BIN_PARAMS,
        width,
        depth,
        height,
        heightUnitMm,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip },
      },
      undefined,
      true
    );
    cache.set(key, mesh);
  }
  return mesh;
}

/**
 * Sweep step for the invariance cases, in mm. The joint is a full-face mate
 * around the whole perimeter, so hundreds of columns read the same depth and a
 * coarse grid still lands on it — worth 4x the sweep cost on a shard whose
 * neighbours run near their timeouts. The primary measurement below keeps the
 * default fine step, where the exact number is what is being claimed.
 */
const COARSE_STEP_MM = 4;

const junctionOf = (spec: Spec = {}, step?: number): number => {
  const mesh = bin(spec);
  return stackSeat(mesh, mesh, undefined, step).junctionMm;
};

describe('bin-on-bin stacking (#2374)', () => {
  it('sees one bin sink into the next', () => {
    // Baseline: if this fails the probe is wrong, not the geometry. A bin that
    // perched on the rim instead of nesting would add its whole printed height.
    const mesh = bin();
    const seat = stackSeat(mesh, mesh);
    expect(Number.isFinite(seat.junctionMm)).toBe(true);
    expect(seat.junctionMm).toBeGreaterThan(0);
    expect(seat.pitchMm).toBeLessThan(seat.totalMm / 2);
  }, 180000);

  it('makes the same joint at every height, footprint and height unit', () => {
    // The discriminating case, and the reporter's calculator fails it: one
    // physical joint reads one number, so a constant per configuration — 5.40
    // for halves, 4.87 for quarters, 5.00 for thirds — cannot be describing it.
    // One case per axis the junction could plausibly depend on: body height,
    // footprint, and a non-standard unit. Intermediate sizes are the same
    // geometry extruded further and were measured at 4.75 too.
    const cases: Spec[] = [
      { height: 12 },
      { width: 1, depth: 1 },
      { width: 3, depth: 2, height: 4 },
      { heightUnitMm: 4.37 },
    ];
    for (const spec of cases) {
      expect(junctionOf(spec, COARSE_STEP_MM), JSON.stringify(spec)).toBeCloseTo(JUNCTION_MM, 1);
    }
  }, 600000);

  it('rests where STACK_JUNCTION_MM says it does', () => {
    // Measurement against the constant the app derives from the profiles. These
    // are computed two different ways on purpose: if the profiles move and the
    // derivation does not follow, this is what notices.
    expect(STACK_JUNCTION_MM).toBeCloseTo(JUNCTION_MM, 2);
    expect(junctionOf()).toBeCloseTo(STACK_JUNCTION_MM, 1);
  }, 180000);

  it('reaches the total the inspector prints', () => {
    // What a caliper reads against what the panel says, for one junction.
    const seat = stackSeat(bin(), bin());
    expect(seat.pitchMm).toBeCloseTo(stackPitchMm(3, 7), 1);
    expect(seat.totalMm).toBeCloseTo(stackedTotalMm(3, 7, 2), 1);
    expect(Math.abs(stackedTotalMm(3, 7, 2) - seat.totalMm)).toBeLessThan(TOLERANCE_MM);
  }, 180000);

  it('does not make that joint without a lip to nest into', () => {
    // Control: the probe reads the joint rather than returning a constant.
    expect(junctionOf({ stackingLip: false })).toBeLessThan(JUNCTION_MM - 0.5);
  }, 180000);
});
