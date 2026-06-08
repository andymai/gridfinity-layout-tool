// @vitest-environment node
/**
 * A seated snap clip must not block bins in the edge sockets flanking its seam.
 *
 * The gridfinity socket mouth opens to the full cell at the slab top
 * (`INSET_TOP = 0`), so a top-inserted staple's flush bridge would otherwise
 * poke into the open socket corners where a bin foot seats. `buildSnapClip`
 * relieves the top-bridge corners against the neighbouring feet; this test seats
 * the clip at a real seam boundary and confirms zero overlap with the adjacent
 * bin feet — while the deep barb/ledge snap zone is left intact.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume, translate, intersect, draw } from 'brepjs';
import { isOk } from '@/core/result';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildSnapClip } from './baseplateConnectors';
import { buildSingleCellSocket } from './socketBuilder';
import { SNAP_CLIP, CLEARANCE } from './generatorConstants';

const vol = (s: Parameters<typeof measureVolume>[0]): number => {
  const r = measureVolume(s);
  if (!isOk(r)) throw new Error('measureVolume failed');
  return r.value;
};

beforeAll(async () => {
  await initBrepjs();
}, 30000);

describe('snap-clip vs edge-socket interference (issue #1610 follow-up)', () => {
  const GU = 42;
  const totalHeight = 5; // SOCKET_HEIGHT slab, no magnets (worst case — through-cut)

  it('seated clip does not intrude into the adjacent edge bin feet', () => {
    const halfW = GU; // width=2 → totalW=84 → seam wall at x=42
    const clip = translate(buildSnapClip(totalHeight, GU), [halfW, 0, 0]);

    // The two edge bin feet flanking the clip (cell centres x=21, y=±21).
    const footSize = GU - CLEARANCE;
    const footA = translate(buildSingleCellSocket(footSize, footSize), [21, 21, 0]);
    const footB = translate(buildSingleCellSocket(footSize, footSize), [21, -21, 0]);

    const iA = intersect(clip, footA);
    const iB = intersect(clip, footB);
    const overlapA = isOk(iA) ? vol(iA.value) : NaN;
    const overlapB = isOk(iB) ? vol(iB.value) : NaN;

    // Nominal (un-relieved) clip overlapped each foot by ~0.73mm³.
    expect(overlapA, 'overlap with foot A').toBeLessThan(0.01);
    expect(overlapB, 'overlap with foot B').toBeLessThan(0.01);
  }, 60_000);

  it('leaves the deep barb/ledge snap zone intact', () => {
    const clip = buildSnapClip(totalHeight, GU); // local frame, seam at x=0
    // Material below the relief floor (−(BRIDGE_THK+0.8)) is the snap zone; the
    // relief never reaches it, so it matches the nominal cross-section.
    const floorZ = -(SNAP_CLIP.BRIDGE_THK + 0.8);
    const below = draw([-10, -10])
      .lineTo([10, -10])
      .lineTo([10, 10])
      .lineTo([-10, 10])
      .close()
      .sketchOnPlane('XY', -totalHeight)
      .extrude(totalHeight + floorZ);
    const snapZone = intersect(clip, below);
    expect(isOk(snapZone) ? vol(snapZone.value) : 0, 'snap-zone volume preserved').toBeGreaterThan(
      20
    );
  }, 60_000);
});
