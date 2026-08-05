// @vitest-environment node
import { describe, expect, it, beforeAll } from 'vitest';
import { DEFAULT_TRAY_BOTTOM } from '@/shared/types/bin';
import type { LidAttachment } from '@/shared/types/bin';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { initBrepjs, getGenerateBin, type GenerateBinFn } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { boundingBox } from './__kernel-tests__/meshAssertions';

let generateBin: GenerateBinFn;
beforeAll(async () => {
  await initBrepjs();
  generateBin = getGenerateBin();
}, 30_000);

describe('tray bin: preview and mesh agree on the floor height', () => {
  it.each<[LidAttachment, number]>([
    ['clickRails', 0],
    ['clickRails', 12],
    ['friction', 0],
    ['magnetic', 6],
  ])('%s attachment with %imm clearance', (attachment, extraHeightMm) => {
    const params = buildParams({
      width: 2,
      depth: 2,
      height: 3,
      // No stacking lip, so the mesh's height is exactly skirt + body and the
      // comparison isolates `floorZ`.
      base: {
        ...buildParams({}).base,
        style: 'lid',
        stackingLip: false,
        trayBottom: { ...DEFAULT_TRAY_BOTTOM, attachment, extraHeightMm },
      },
    });
    const box = boundingBox(generateBin(params).vertices);
    const preview = binDimensions(params);
    // The mesh's total height is the skirt plus the body; `floorZ` is where the
    // preview thinks the interior starts. If they disagree every ghost overlay
    // and every editor bound is off by the difference.
    expect(preview.floorZ + preview.wallHeight).toBeCloseTo(box.maxZ - box.minZ, 1);
  });
});
