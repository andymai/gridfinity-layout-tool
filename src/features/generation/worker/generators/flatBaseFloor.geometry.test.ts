// @vitest-environment node
/**
 * A flat base's floor lies on the bed, so it is built a wall thick rather than
 * to the spec floor a socketed bin carries above its feet. Every probe reads
 * the EXPORT mesh (forExport is the third positional argument), and every
 * column is off both axes so it does not ride a fan-triangulation edge.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DIVIDER_FLOOR_GROOVE_DEPTH } from '@/shared/utils/slotMath';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { initTestKernel } from '@/test/initTestKernel';
import { boundingBox, verticalSolidSpans } from './__kernel-tests__/meshAssertions';

let generateBin: (params: BinParams, onProgress: undefined, forExport: boolean) => MeshData;

beforeAll(async () => {
  await initTestKernel();
  generateBin = (await import('./binOrchestrator')).generateBin;
}, 60000);

function bin(over: Partial<BinParams>, style: BinParams['base']['style'] = 'flat'): MeshData {
  return generateBin(
    {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 6,
      ...over,
      base: { ...DEFAULT_BIN_PARAMS.base, style },
    },
    undefined,
    true
  );
}

/** Clear of every divider and groove in a 2x2. */
const OPEN_FLOOR = { x: 10.3, y: 10.7 };
/** Just off the centre lines, so inside the default slot plan's centre groove. */
const CENTRE_GROOVE = { x: 0.3, y: 0.2 };

function firstSpan(mesh: MeshData, at: { x: number; y: number }): readonly [number, number] {
  const [span] = verticalSolidSpans(mesh, at.x, at.y);
  if (!span) throw new Error(`no material under (${at.x}, ${at.y})`);
  return span;
}

describe('flat base floor', () => {
  it('is as thick as the wall, with the outer height a socketed bin has', () => {
    const wall = DEFAULT_BIN_PARAMS.wallThickness;
    const flat = bin({});
    const [from, to] = firstSpan(flat, OPEN_FLOOR);
    expect(from).toBeCloseTo(0, 3);
    expect(to).toBeCloseTo(wall, 3);
    expect(verticalSolidSpans(flat, OPEN_FLOOR.x, OPEN_FLOOR.y)).toHaveLength(1);

    expect(boundingBox(flat.vertices).maxZ).toBeCloseTo(
      boundingBox(bin({}, 'standard').vertices).maxZ,
      3
    );
  });

  it('follows a thicker wall', () => {
    const [, to] = firstSpan(bin({ wallThickness: 2 }), OPEN_FLOOR);
    expect(to).toBeCloseTo(2, 3);
  });

  it('keeps a wall of floor under a divider groove', () => {
    for (const wall of [0.8, 1.2]) {
      const mesh = bin({ style: 'slotted', wallThickness: wall });
      expect(firstSpan(mesh, OPEN_FLOOR)[1]).toBeCloseTo(wall + DIVIDER_FLOOR_GROOVE_DEPTH, 3);
      expect(firstSpan(mesh, CENTRE_GROOVE)[1]).toBeCloseTo(wall, 3);
      // A raised floor under a sub-millimetre wall used to hang past the bed.
      expect(boundingBox(mesh.vertices).minZ).toBeGreaterThanOrEqual(-1e-4);
    }
  });
});

describe('raised floor under a thin wall', () => {
  it('stays above the gap between a socketed bin’s feet', () => {
    // The centre of a 2x2 is where four feet meet, so this column is open
    // until the body's underside at the socket top.
    const [from] = firstSpan(bin({ wallThickness: 0.8 }, 'standard'), CENTRE_GROOVE);
    expect(from).toBeCloseTo(GRIDFINITY_SPEC.SOCKET_HEIGHT, 3);
  });
});
