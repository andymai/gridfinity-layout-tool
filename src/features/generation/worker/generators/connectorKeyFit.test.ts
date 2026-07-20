// @vitest-environment node
/**
 * Fit + capture for the dogbone seam key (`connectorStyle: 'dovetailKey'`,
 * issue #2637).
 *
 * The original key was two mirrored dovetail tongues — a 0.3 mm/side undercut
 * that FDM corner rounding + first-layer squish swallowed entirely, so printed
 * keys came out near-rectangular and pulled straight out. The key now mirrors
 * two puzzle lobes (1.0 mm/side undercut). These tests pin the three geometric
 * contracts the part must keep:
 *
 *  1. SEATS — the nominal key drops into the cavity formed by two opposing
 *     puzzle grooves cut with `DOVETAIL_KEY_CLEARANCE` (clearance fit, no
 *     meaningful interference).
 *  2. LOCKS — with the plates pulled apart, the key's far lobe bears against
 *     the neck constriction of the still-attached piece (real captured volume).
 *  3. CLEARS BIN FEET — seated at a junction, the socket-relieved key does not
 *     intrude into any of the four flanking bin feet (same contract the snap
 *     clip and integral tongues honor; the wider puzzle head reaches into the
 *     open socket mouths near the top without the relief).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { cut, draw, intersect, translate, measureVolume } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import { isOk, unwrap } from '@/core/result';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildDovetailKey, makePuzzleGroove } from './baseplateConnectors';
import { buildSingleCellSocket } from './socketBuilder';
import {
  SOCKET_HEIGHT,
  CLEARANCE,
  COPLANAR_MARGIN,
  DOVETAIL_KEY_CLEARANCE,
  sketch,
} from './generatorTypes';

const GU = 42;
const H = SOCKET_HEIGHT;

const vol = (s: Parameters<typeof measureVolume>[0]): number => {
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

const pt = (wall: number, bp: number): [number, number] => [wall, bp];

/**
 * A block on one side of a seam at x=0 with the key-mode puzzle groove cut into
 * its seam face. `side = -1` builds the x<0 block (outward direction +1),
 * `side = +1` the x>0 block (outward direction −1) — matching how
 * `buildConnectors` cuts both-female seams.
 */
function grooveBlock(side: -1 | 1): Shape3D {
  const profile = draw([side < 0 ? -12 : 0, -8])
    .lineTo([side < 0 ? 0 : 12, -8])
    .lineTo([side < 0 ? 0 : 12, 8])
    .lineTo([side < 0 ? -12 : 0, 8])
    .close();
  const block = sketch(profile, 'XY', 0).extrude(-H);
  const groove = makePuzzleGroove(
    pt,
    0,
    0,
    side < 0 ? 1 : -1,
    DOVETAIL_KEY_CLEARANCE,
    COPLANAR_MARGIN,
    H
  );
  const cutRes = unwrap(cut(block as ValidSolid, groove as ValidSolid));
  block.delete();
  groove.delete();
  return cutRes;
}

/** The key seated in the plate frame (slab top at Z=0, junction at origin). */
function seatedKey(): Shape3D {
  const key = buildDovetailKey(H, GU);
  const seated = translate(key, [0, 0, -H]);
  key.delete();
  return seated;
}

beforeAll(async () => {
  await initBrepjs();
}, 30000);

describe('dogbone seam key fit + capture (issue #2637)', () => {
  it('seats in the two-groove cavity with a clearance fit', () => {
    const left = grooveBlock(-1);
    const right = grooveBlock(1);
    const key = seatedKey();
    try {
      // Sub-tolerance contact from fillet-radius mismatch between the grown
      // groove outline and the nominal key is expected; real interference is not.
      expect(overlap(key, left), 'seated key ∩ left plate').toBeLessThan(0.05);
      expect(overlap(key, right), 'seated key ∩ right plate').toBeLessThan(0.05);
    } finally {
      left.delete();
      right.delete();
      key.delete();
    }
  });

  it('captures the plates against pull-apart (lobe bears on the neck constriction)', () => {
    const right = grooveBlock(1);
    const key = seatedKey();
    // Pull the left plate (and the key seated in it) 0.4mm away from the right
    // plate. The key's right lobe must ram the right plate's neck channel —
    // that bearing volume IS the lock. The legacy bowtie's 0.3mm taper left
    // only a sliver here once FDM ate it; the puzzle lobe bears ~1mm deep.
    const pulled = translate(key, [-0.4, 0, 0]);
    key.delete();
    try {
      const captured = overlap(pulled, right);
      expect(captured, 'pulled key ∩ right plate (bearing volume)').toBeGreaterThan(1);
    } finally {
      pulled.delete();
      right.delete();
    }
  });

  it('clears all four nominal bin feet flanking a seam junction', () => {
    const key = seatedKey();
    const keyVol = vol(key);
    let feetOverlap = 0;
    for (const sx of [-1, 1] as const) {
      for (const sy of [-1, 1] as const) {
        const socket = buildSingleCellSocket(GU - CLEARANCE, GU - CLEARANCE);
        const foot = translate(socket, [(sx * GU) / 2, (sy * GU) / 2, 0]);
        socket.delete();
        feetOverlap += overlap(key, foot);
        foot.delete();
      }
    }
    key.delete();
    // Un-relieved, the 1.9mm half-width head reaches into the full-cell socket
    // mouths near the slab top (the old 1.3mm bowtie tips only grazed them).
    expect(feetOverlap, 'seated key ∩ junction bin feet').toBeLessThan(0.02);
    // …while the relief leaves the lobes their locking material.
    expect(keyVol, 'key retains locking material').toBeGreaterThan(25);
  });
});
