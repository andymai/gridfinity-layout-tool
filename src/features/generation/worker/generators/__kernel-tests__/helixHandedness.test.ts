// @vitest-environment node
/**
 * Diagnostic (not a CI gate): pin occt-wasm's helix handedness behavior.
 * Sweeps a rectangle along right- and left-handed helixes (radius 3, one
 * radian over height 5) and reports each swept solid's angular footprint.
 *
 * Current findings (occt-wasm pinned pair):
 *   - makeHelixWire has no handedness input, so brepjs's sketchHelix
 *     left-handed flag is a NO-OP — both flags produce the identical
 *     right-handed sweep. This is why kumikoWrapBuilder approximates corner
 *     diagonals with chord boxes instead of helix sweeps.
 *   - brepjs `mirror` on a helical sweep yields an EMPTY solid (volume 0),
 *     so mirroring a right-handed sweep is not a viable left-handed
 *     substitute either.
 * If this probe ever shows the two flags diverging and mirror producing a
 * real solid, the upstream gaps are fixed and the chord-box approximation
 * can be revisited.
 */
import { describe, it, beforeAll } from 'vitest';
import { sketchHelix, drawRoundedRectangle, mesh, mirror, measureVolume, unwrap } from 'brepjs';
import { initBrepjs } from './wasmInit';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

function sweepAndMeasure(lefthand: boolean, mirrored = false): string {
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
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 0; i < m.vertices.length; i += 3) {
    const x = m.vertices[i];
    const y = m.vertices[i + 1];
    const z = m.vertices[i + 2];
    const phi = Math.atan2(y, x);
    if (phi < phiMin) phiMin = phi;
    if (phi > phiMax) phiMax = phi;
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
  }
  swept.delete();
  return `lefthand=${lefthand} mirrored=${mirrored} vol=${vol.toFixed(2)}: phi [${phiMin.toFixed(3)}, ${phiMax.toFixed(3)}], z [${zMin.toFixed(2)}, ${zMax.toFixed(2)}]`;
}

describe('helix handedness probe', () => {
  it('measures swept solid angular footprint per handedness', () => {
    // eslint-disable-next-line no-console
    console.log(sweepAndMeasure(false));
    // eslint-disable-next-line no-console
    console.log(sweepAndMeasure(true));
    // eslint-disable-next-line no-console
    console.log(sweepAndMeasure(false, true));
  }, 120_000);
});
