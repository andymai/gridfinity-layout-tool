// @vitest-environment node
/**
 * Pull-apart capture — the snap clip's PRIMARY job.
 *
 * The clip bridges the seam; for it to resist the two plates being pulled apart,
 * each leg must be buried in solid plate material on its SEAM side, so that
 * pulling a plate away from the seam rams that wall into the leg (bearing in
 * shear) — exactly like a real staple.
 *
 * This models one plate (a plain slab with the real seam pocket cut into it) and
 * the real clip, seats them at a shared seam at x=0, then translates the plate
 * away from the seam and asserts the clip now blocks it (interference volume
 * jumps). The pre-fix design cut the pocket OPEN to the seam, so pulling apart
 * only retreats the walls and the clip blocks nothing — this test fails there.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume, translate, intersect, cutAll, draw } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import { isOk, unwrap } from '@/core/result';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildSnapClip, makeSnapPocket } from './baseplateConnectors';
import { snapClipLevels } from './generatorConstants';

const vol = (s: Parameters<typeof measureVolume>[0]): number => {
  const r = measureVolume(s);
  if (!isOk(r)) throw new Error('measureVolume failed');
  return r.value;
};

const overlap = (a: ValidSolid, b: ValidSolid): number => {
  const i = intersect(a, b);
  // Fail loudly rather than returning 0 — a swallowed boolean error would let the
  // "seated clearance fit" assertion pass spuriously.
  if (!isOk(i)) throw new Error('intersect failed');
  const v = vol(i.value);
  i.value.delete();
  return v;
};

beforeAll(async () => {
  await initBrepjs();
}, 30000);

describe('snap-clip pull-apart capture (issue #1610 follow-up)', () => {
  const GU = 42;
  const H = 5; // SOCKET_HEIGHT slab, worst case (thinnest viable)
  const PULL = 0.4; // mm of plate separation to probe (> seated clearance)

  // Right plate: solid body x∈[0,GU] with the seam at x=0 (its left edge is the
  // join). The real seam pocket is cut from the slab so the bearing geometry is
  // identical to what the generator produces.
  function rightPlateWithPocket(): ValidSolid {
    const lv = snapClipLevels(H, 0);
    const ptX = (wall: number, bp: number): [number, number] => [wall, bp];
    const box = draw([0, -GU / 2])
      .lineTo([GU, -GU / 2])
      .lineTo([GU, GU / 2])
      .lineTo([0, GU / 2])
      .close()
      .sketchOnPlane('XY', 0)
      .extrude(-H);
    const cutters = makeSnapPocket(ptX, 0, 0, -1, lv) as ValidSolid[];
    const plate = unwrap(cutAll(box as ValidSolid, cutters));
    cutters.forEach((c) => c.delete());
    if ((plate as Shape3D) !== box) box.delete();
    return plate;
  }

  it('seats with clearance but blocks the plate from being pulled apart', () => {
    const clip = buildSnapClip(H, GU); // seam at x=0

    // Seated: a clearance fit, so essentially no interference (sub-tolerance
    // contact from the fillet/corner mismatch between the crisp pocket and the
    // filleted clip is expected).
    const seated = rightPlateWithPocket();
    expect(overlap(clip, seated), 'seated clearance fit').toBeLessThan(0.2);
    seated.delete();

    // Pulled away from the seam: the clip must now bear against the plate.
    const plate = rightPlateWithPocket();
    const pulled = translate(plate, [PULL, 0, 0]);
    plate.delete();
    expect(overlap(clip, pulled), 'clip blocks pull-apart').toBeGreaterThan(0.5);
    pulled.delete();
    clip.delete();
  }, 60_000);
});
