// @vitest-environment node
/**
 * The snap-clip barb catches an undercut ledge (the throat→chamber step) in the
 * seam pocket. That ledge must be backed by solid baseplate material or the snap
 * has nothing to engage. The gridfinity sockets eat into the slab near the seam,
 * but the clip sits on a cell BOUNDARY where the sockets' 4mm corner rounding
 * pulls the voids back, leaving a solid ridge. This test confirms the ledge
 * keeps most of its backing on a lightweight (through-cut) plate and ~all of it
 * on a magnet (floored) plate — guarding against socket/clip geometry changes
 * that would quietly destroy the engagement.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume, translate, intersect, cut, draw } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { isOk } from '@/core/result';
import type { BaseplateParams } from '@/shared/types/bin';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildBaseplateSolid } from './baseplateGenerator';
import { buildConnectors } from './baseplateConnectors';
import { snapClipLevels, SOCKET_HEIGHT, MAGNET_FLOOR } from './generatorConstants';

const vol = (s: Parameters<typeof measureVolume>[0]): number => {
  const r = measureVolume(s);
  return isOk(r) ? r.value : NaN;
};

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Shape3D =>
  draw([x0, y0])
    .lineTo([x1, y0])
    .lineTo([x1, y1])
    .lineTo([x0, y1])
    .close()
    .sketchOnPlane('XY', z0)
    .extrude(z1 - z0);

const params: BaseplateParams = {
  width: 2,
  depth: 2,
  gridUnitMm: 42,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  lightweight: true,
  connectorNubs: true,
  connectorStyle: 'snapClip',
  edges: { left: 'exterior', right: 'join', front: 'exterior', back: 'exterior' },
};

beforeAll(async () => {
  await initBrepjs();
}, 30000);

describe('snap-clip catch-ledge backing (issue #1610 follow-up)', () => {
  it.each([
    { label: 'lightweight (through-cut)', magnetHoles: false, minFraction: 0.7, minSolid: 6 },
    { label: 'magnet (floored)', magnetHoles: true, minFraction: 0.95, minSolid: 9 },
  ])(
    'catch ledge stays backed by solid material — $label',
    ({ magnetHoles, minFraction, minSolid }) => {
      const p = { ...params, magnetHoles };
      const totalHeight = magnetHoles
        ? SOCKET_HEIGHT + MAGNET_FLOOR + p.magnetDepth
        : SOCKET_HEIGHT;
      const lv = snapClipLevels(totalHeight, 0);
      const seam = 42; // right edge of the 2x2 plate

      // Throat-wall material just above the catch ledge, over the clip length —
      // the solid that resists pull-out when the barb presses up on the ledge.
      const px0 = seam - lv.chamberDepthX - 1.0;
      const px1 = seam - lv.throatDepthX;
      const probe = (): Shape3D => box(px0, px1, -2.5, 2.5, lv.catchZ, lv.catchZ + 1.5);

      // Real piece. buildBaseplateSolid Z-shifts the output up by totalHeight
      // (bottom at Z=0); shift back so the pre-shift probe coordinates align.
      const real = translate(buildBaseplateSolid(p, true), [0, 0, -totalHeight]);
      const realProbe = intersect(real, probe());
      const realSolid = isOk(realProbe) ? vol(realProbe.value) : NaN;

      // Reference: plain slab (no sockets) with the same snap pockets — the
      // backing the standalone brepjs-verify proof assumed.
      let ref: Shape3D = box(-42, 42, -42, 42, -totalHeight, 0);
      const { holes } = buildConnectors(p, totalHeight, 84, 84, 0, 0);
      for (const h of holes) {
        const c = cut(ref, h);
        if (isOk(c)) ref = c.value;
      }
      const refProbe = intersect(ref, probe());
      const refSolid = isOk(refProbe) ? vol(refProbe.value) : NaN;

      expect(realSolid, 'solid backing the catch ledge').toBeGreaterThan(minSolid);
      expect(realSolid / refSolid, 'fraction of ideal backing retained').toBeGreaterThan(
        minFraction
      );
    },
    60_000
  );
});
