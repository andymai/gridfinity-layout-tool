// @vitest-environment node
/**
 * Fit + engagement for the split-bin wall-locking key (`wallConnector: 'key'`,
 * issue #2321 — "beef up split-bin wall connectors so they actually lock").
 *
 * The scenario suite (`binGenerator.scenario.split-wall-locking`) only proves the
 * key ADDS geometry and preserves the lip; `splitConnectorBuilder.test.ts` pins
 * the key's own footprint math (outer skin, protrusion floor, self-supporting
 * ramp). Neither asserts the male tongue actually engages the female groove
 * across the seam — the exact contract #2321 was about. A regression that shrinks
 * the tongue below engagement leaves every one of those tests green.
 *
 * The key is a STRAIGHT (non-undercut) press-together tongue/groove — an undercut
 * would force a vertical drop-in, impossible past the partial-height groove and
 * the stacking lip (see `addKeyConnectors`). So the contract is NOT axial
 * pull-apart capture (that would be the wrong invariant to copy from the dovetail
 * key); it is:
 *
 *  1. SEATS — the male tongue fits inside the matching female groove with a
 *     positive clearance (the groove is strictly larger), so the halves press
 *     together without seizing.
 *  2. ENGAGES — the tongue protrudes past the seam into the mating piece with
 *     real bearing volume, so it resists the walls splaying apart and gives glue
 *     surface. This is the "actually locks/aligns" contract.
 *  3. STAYS ENGAGED ON A WIDER NOZZLE — protrusion and tongue width hold ≥2
 *     perimeters at 0.6 mm, so the joint doesn't degrade to a sub-bead sliver.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { intersect, measureVolume, draw } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { isOk } from '@/core/result';
import { NOZZLE_BASELINE } from '@/shared/printSettings/connectorScaling';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { sketch } from './generatorTypes';
import { buildKey, wallKeyGeometry, fitWallKeyToHeight } from './splitConnectorBuilder';

const CLEARANCE = 0.15;
const WALL_THICKNESS = 1.2;
const FLOOR_Z = 0;
const WALL_TOP_Z = 18; // ~3U interior wall height
const KEY_HEIGHT_FRACTION = 0.85; // DEFAULT_WALL_KEY_HEIGHT_FRACTION

const vol = (s: Shape3D): number => {
  const r = measureVolume(s);
  if (!isOk(r)) throw new Error('measureVolume failed');
  return r.value;
};

/** Overlap volume between two solids (0 when the boolean finds no material). */
function overlap(a: Shape3D, b: Shape3D): number {
  const i = intersect(a, b);
  if (!isOk(i)) return 0;
  const v = vol(i.value);
  i.value.delete();
  return v;
}

/** A large solid covering the mating half-space x > seam, to isolate the tongue's protrusion. */
function mateHalfSpace(seamX: number): Shape3D {
  const profile = draw([seamX + 1e-3, -50])
    .lineTo([seamX + 100, -50])
    .lineTo([seamX + 100, 50])
    .lineTo([seamX + 1e-3, 50])
    .close();
  return sketch(profile, 'XY', -20).extrude(60);
}

/** Male tongue + female groove for one wall key on an x-axis seam at x=0. */
function buildTongueAndGroove(nozzle: number): {
  tongue: Shape3D;
  groove: Shape3D;
  fitProtrusion: number;
  keyWidth: number;
} {
  const wallHeight = WALL_TOP_Z - FLOOR_Z;
  const keyHeight = wallHeight * KEY_HEIGHT_FRACTION;
  const geom = wallKeyGeometry(WALL_THICKNESS, CLEARANCE, nozzle);
  const fit = fitWallKeyToHeight(keyHeight, geom.protrusion, nozzle);
  if (!fit.fits) throw new Error('wall key unexpectedly skipped at this height');

  // axis 'x', seam at x=0, perimeter wall at y=0 reaching inward (+y).
  const tongue = buildKey('x', 0, 0, 1, FLOOR_Z, keyHeight, 0, fit.protrusion, geom);
  const groove = buildKey('x', 0, 0, 1, FLOOR_Z, keyHeight, CLEARANCE, fit.protrusion, geom);
  return { tongue, groove, fitProtrusion: fit.protrusion, keyWidth: geom.keyHalfWidth * 2 };
}

beforeAll(async () => {
  await initBrepjs();
}, 30000);

describe('split-bin wall key fit + engagement (issue #2321)', () => {
  it('seats in the matching groove with a positive clearance (no seize)', () => {
    const { tongue, groove } = buildTongueAndGroove(NOZZLE_BASELINE);
    try {
      const tongueVol = vol(tongue);
      // The groove is the tongue grown by clearance on every axis, so the tongue
      // fits entirely inside it: their overlap recovers essentially the whole tongue.
      expect(overlap(tongue, groove), 'tongue ∩ groove (seated)').toBeGreaterThan(tongueVol * 0.98);
      // …and the groove is strictly larger, so the press-fit has room and never seizes.
      expect(vol(groove), 'groove larger than tongue by the clearance envelope').toBeGreaterThan(
        tongueVol
      );
    } finally {
      tongue.delete();
      groove.delete();
    }
  });

  it('engages across the seam with real bearing volume (the lock contract)', () => {
    const { tongue, fitProtrusion, keyWidth } = buildTongueAndGroove(NOZZLE_BASELINE);
    const half = mateHalfSpace(0);
    try {
      // The tongue must protrude past the seam into the mating piece — that
      // protruding volume IS the alignment/glue engagement. A key that stopped
      // reaching across the cut (the #2321 failure) craters this to ~0.
      const bearing = overlap(tongue, half);
      expect(bearing, 'tongue volume past the seam (bearing across the joint)').toBeGreaterThan(10);
      // Engagement depth and tongue cross-section stay printable (≥2 perimeters).
      expect(fitProtrusion, 'protrusion ≥ 2 perimeters').toBeGreaterThanOrEqual(
        2 * NOZZLE_BASELINE
      );
      expect(keyWidth, 'tongue width ≥ 2 perimeters').toBeGreaterThanOrEqual(2 * NOZZLE_BASELINE);
    } finally {
      tongue.delete();
      half.delete();
    }
  });

  it('keeps ≥2-perimeter engagement on a 0.6mm nozzle', () => {
    const nozzle = 0.6;
    const { tongue, groove, fitProtrusion, keyWidth } = buildTongueAndGroove(nozzle);
    const half = mateHalfSpace(0);
    try {
      expect(overlap(tongue, half), 'bearing volume at 0.6mm').toBeGreaterThan(10);
      expect(fitProtrusion, 'protrusion ≥ 2 perimeters at 0.6mm').toBeGreaterThanOrEqual(
        2 * nozzle
      );
      expect(keyWidth, 'tongue width ≥ 2 perimeters at 0.6mm').toBeGreaterThanOrEqual(2 * nozzle);
    } finally {
      tongue.delete();
      groove.delete();
      half.delete();
    }
  });
});
