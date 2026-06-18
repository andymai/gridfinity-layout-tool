// @vitest-environment node
import { describe, it, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin, getKernelName } from './wasmInit';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

describe('wall-cutout probe', () => {
  it('2x2 wall cutouts triangle/time', () => {
    const gen = getGenerateBin();
    const params = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      walls: {
        enabled: true,
        shape: 'u-shape' as const,
        width: 0,
        depth: 0,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        back: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        right: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        interior: DISABLED_WALL_CUTOUT,
      },
    };
    const start = performance.now();
    const result = gen(params, undefined, false);
    const ms = performance.now() - start;

    console.error(
      `PROBE kernel=${getKernelName()} triangles=${result.triangleCount} ms=${ms.toFixed(0)}`
    );
  }, 60_000);
});
