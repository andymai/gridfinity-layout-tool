// @vitest-environment node
/**
 * Tripwire for occt-wasm's helix handedness gaps (run with the other
 * __kernel-tests__ diagnostics on every brepjs/occt-wasm bump).
 *
 * Pinned CURRENT behavior (the assertions below fail when upstream fixes it):
 *   - makeHelixWire has no handedness input, so brepjs's sketchHelix
 *     left-handed flag is a NO-OP — both flags produce the identical
 *     right-handed sweep. This is why kumikoWrapBuilder approximates corner
 *     FALLING diagonals with chord boxes instead of helix sweeps.
 *   - brepjs `mirror` on a helical sweep yields an EMPTY solid (volume 0),
 *     so mirroring a right-handed sweep is not a viable left-handed
 *     substitute either.
 * A failure here means the upstream gap is fixed: retire the chord-box
 * approximation in kumikoWrapBuilder's falling-diagonal branch.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { sketchHelix, drawRoundedRectangle, mesh, mirror, measureVolume, unwrap } from 'brepjs';
import { initBrepjs } from './wasmInit';

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
    const m2 = mirror(swept, [0, 1, 0], [0, 0, 0]);
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
  it('left-handed flag is still a no-op (else retire the kumiko chord-box workaround)', () => {
    const right = sweepAndMeasure(false);
    const left = sweepAndMeasure(true);
    expect(right.vol).toBeGreaterThan(0);
    expect(
      left.phiMin,
      'left-handed sketchHelix now diverges from right-handed — occt-wasm gained handedness; retire the chord-box approximation in kumikoWrapBuilder'
    ).toBeCloseTo(right.phiMin, 3);
    expect(left.phiMax).toBeCloseTo(right.phiMax, 3);
    expect(left.vol).toBeCloseTo(right.vol, 3);
  }, 120_000);

  it('mirror on a helical sweep is still empty (else it becomes a viable left-handed substitute)', () => {
    const mirrored = sweepAndMeasure(false, true);
    expect(
      mirrored.vol,
      'mirror now produces a real solid from a helical sweep — a mirrored right-handed sweep can replace the kumiko chord boxes'
    ).toBe(0);
  }, 120_000);
});
