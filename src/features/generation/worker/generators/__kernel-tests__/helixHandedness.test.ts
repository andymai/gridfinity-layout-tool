// @vitest-environment node
/**
 * occt-wasm helix handedness, for kumikoWrapBuilder's corner FALLING diagonals
 * (run with the other __kernel-tests__ diagnostics on every brepjs bump).
 *
 * The two cases here fail for OPPOSITE reasons — read the one that broke:
 *
 *   1. Tripwire, occt-wasm only. `makeHelixWire` takes no handedness input, so
 *      sketchHelix's left-handed flag is a NO-OP there: both flags give the same
 *      right-handed sweep. A FAILURE means occt-wasm gained handedness.
 *      brepkit already honours the flag, so under any other kernel the case
 *      asserts the opposite (divergence) — see occt-wasm#268.
 *
 *   2. Regression guard. `mirror` on a helical sweep used to yield an empty
 *      solid; as of brepjs 18.119.2 it yields a true reflection, so a mirrored
 *      right-handed sweep is a viable left-handed substitute. This one should
 *      keep PASSING — a failure means that capability regressed.
 *
 * Either outcome bears on the same decision: the chord-box approximation in
 * kumikoWrapBuilder's falling-diagonal branch exists because BOTH routes to a
 * left-handed sweep were unavailable. Route 2 has since opened, so the
 * approximation is already retirable (see the TODO on that case); case 1
 * turning green would make it doubly so.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { sketchHelix, drawRoundedRectangle, mesh, mirror, measureVolume, unwrap } from 'brepjs';
import { initBrepjs, getKernelName } from './wasmInit';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

interface SweepFootprint {
  readonly vol: number;
  readonly phiMin: number;
  readonly phiMax: number;
}

function sweepAndMeasure(lefthand: boolean, mirrored = false): SweepFootprint {
  const dPhi = 1;
  const height = 5;
  const pitch = (height * 2 * Math.PI) / dPhi;
  const spine = sketchHelix(pitch, height, 3, [0, 0, 0], [0, 0, 1], lefthand);
  let swept = spine.sweepSketch((plane) => drawRoundedRectangle(2, 1, 0).sketchOnPlane(plane), {
    frenet: true,
  });
  if (mirrored) {
    const m2 = mirror(swept, { normal: [0, 1, 0], at: [0, 0, 0] });
    swept.delete();
    swept = m2;
  }
  const vol = unwrap(measureVolume(swept));
  const m = mesh(swept, { tolerance: 0.1 });
  let phiMin = Infinity;
  let phiMax = -Infinity;
  for (let i = 0; i < m.vertices.length; i += 3) {
    const phi = Math.atan2(m.vertices[i + 1], m.vertices[i]);
    if (phi < phiMin) phiMin = phi;
    if (phi > phiMax) phiMax = phi;
  }
  swept.delete();
  return { vol, phiMin, phiMax };
}

describe('helix handedness tripwire', () => {
  it('left-handed flag is still a no-op on occt-wasm (brepkit honours it)', () => {
    const right = sweepAndMeasure(false);
    const left = sweepAndMeasure(true);
    expect(right.vol).toBeGreaterThan(0);

    // brepkit implements handedness, so the flag diverges there by design
    // (occt-wasm#268 asks occt to honour it or reject it rather than drop it
    // silently). Asserting occt's no-op under every kernel made a capability
    // difference read as a brepkit failure.
    if (getKernelName() !== 'occt-wasm') {
      expect(
        Math.abs(left.phiMin - right.phiMin),
        `${getKernelName()} should honour the left-handed flag`
      ).toBeGreaterThan(0.1);
      return;
    }

    expect(
      left.phiMin,
      'left-handed sketchHelix now diverges from right-handed — occt-wasm gained handedness; retire the chord-box approximation in kumikoWrapBuilder'
    ).toBeCloseTo(right.phiMin, 3);
    expect(left.phiMax).toBeCloseTo(right.phiMax, 3);
    expect(left.vol).toBeCloseTo(right.vol, 3);
  }, 120_000);

  // This tripwire FIRED. It asserted mirror yields an empty solid; on
  // brepjs 18.119.2 it yields a real one (~11.66mm³ for this fixture), so a
  // mirrored right-handed sweep is now a viable left-handed substitute. The
  // assertion is inverted to record that, and still catches a regression if
  // mirror goes back to producing nothing.
  // TODO: retire the chord-box approximation in kumikoWrapBuilder's
  // falling-diagonal branch, now that this substitute exists. Needs visual
  // verification of the corner diagonals before/after.
  it('mirror on a helical sweep produces a true reflection (left-handed substitute is viable)', () => {
    const right = sweepAndMeasure(false);
    const mirrored = sweepAndMeasure(false, true);

    // A non-empty result is not enough to justify retiring the workaround — a
    // degenerate sliver would clear that bar. Reflection through the y=0 plane
    // preserves volume and negates phi = atan2(y, x), so the angular footprint
    // must come back inverted end-for-end. The ~1 rad sweep never approaches
    // the ±pi branch cut, so phiMin/phiMax stay comparable.
    //
    // The footprint is asymmetric ([-0.211, +1.211] rad right-handed), which is
    // what makes this discriminating: an unmirrored or wrongly-oriented solid
    // misses by ~1 rad against a 5e-4 tolerance.
    expect(
      mirrored.vol,
      'mirror stopped reproducing the sweep volume — the left-handed substitute regressed'
    ).toBeCloseTo(right.vol, 3);
    expect(
      mirrored.phiMin,
      'mirrored footprint is not the reflection of the right-handed one'
    ).toBeCloseTo(-right.phiMax, 3);
    expect(mirrored.phiMax).toBeCloseTo(-right.phiMin, 3);
  }, 120_000);
});
