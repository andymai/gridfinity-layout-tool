// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { faceGeomType, getFaces, mesh } from 'brepjs';
import type { MagnetHoleStyle } from '@/shared/generation/magnetHoleStyle';
import { initBrepjs, getKernelName } from './__kernel-tests__/wasmInit';
import { expectRibbedSection, sliceAround } from './__kernel-tests__/boreSection';
import { buildMagnetHoleCutter } from './magnetHoleCutter';

const R = 3.25;
const HEIGHT = 2.4;
const RIBS: MagnetHoleStyle = { crushRibs: true, chamfer: false };

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

describe('buildMagnetHoleCutter', () => {
  it('a ribbed bore carries the rib wave on a mid-bore slice', () => {
    const cutter = buildMagnetHoleCutter({ radius: R, height: HEIGHT, style: RIBS });
    try {
      const m = mesh(cutter, { tolerance: 0.01, angularTolerance: 0.1 });
      const points = sliceAround(
        { vertices: m.vertices, indices: m.triangles },
        0,
        0,
        HEIGHT * (2 / 3),
        R + 0.5
      );
      expectRibbedSection(points, R, `ribbed cutter (${getKernelName()})`);
    } finally {
      cutter.delete();
    }
  });

  // One curved wall face is what keeps the exact booleans as fast as a
  // cylinder's; a faceted bore costs several times more per hole there.
  it.runIf(getKernelName() === 'occt-wasm')(
    'the exact ribbed bore is one extruded-spline wall between two caps',
    () => {
      const cutter = buildMagnetHoleCutter({ radius: R, height: HEIGHT, style: RIBS });
      try {
        const types = getFaces(cutter).map((f) => faceGeomType(f));
        expect([...types].sort()).toEqual(['EXTRUSION_SURFACE', 'PLANE', 'PLANE']);
      } finally {
        cutter.delete();
      }
    }
  );
});
