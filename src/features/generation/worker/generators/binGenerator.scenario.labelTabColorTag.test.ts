// @vitest-environment node
/**
 * Regression for GH #1654: the label-tab shelf-top surface must carry the
 * LABEL_TAB face tag so multi-color bins paint it the label color rather than
 * the body color. The shelf top used to be coplanar with the bin wall top; the
 * fuse merged the two faces and the merged face lost the LABEL_TAB origin. The
 * fix extrudes the shelf COPLANAR_OVERLAP proud so its top face stays distinct.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { FeatureTag } from './featureTags';
import type { BinParams } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

describe('label tab shelf-top color tag (#1654)', () => {
  it('tags the shelf top LABEL_TAB, not body', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 1,
      height: 3,
      // No stacking lip so the highest faces are the label-tab shelf top.
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      compartments: { cols: 1, rows: 1, cells: [0], thickness: 1.2 },
    };

    const m = getGenerateBin()(params);
    const verts = m.vertices;
    const idx = m.indices;
    const fgs = m.faceGroups ?? [];
    expect(verts.length).toBeGreaterThan(0);

    let zmax = -Infinity;
    for (let i = 2; i < verts.length; i += 3) if (verts[i] > zmax) zmax = verts[i];

    // The shelf is COPLANAR_OVERLAP (0.01mm) proud of the wall top, so the
    // absolute-top faces belong only to the shelf.
    const top = zmax - 0.005;
    let labelTop = 0;
    let bodyTop = 0;
    for (const fg of fgs) {
      for (let t = 0; t < fg.count / 3; t++) {
        const zs = [0, 1, 2].map((k) => verts[idx[fg.start + t * 3 + k] * 3 + 2]);
        if (!zs.every((z) => z >= top)) continue;
        if (fg.tag === FeatureTag.LABEL_TAB) labelTop++;
        // UNKNOWN (255) and BASE (0) both render as the body color.
        else if (fg.tag === FeatureTag.UNKNOWN || fg.tag === FeatureTag.BASE) bodyTop++;
      }
    }

    expect(labelTop).toBeGreaterThan(0);
    expect(bodyTop).toBe(0);
  }, 90_000);
});
