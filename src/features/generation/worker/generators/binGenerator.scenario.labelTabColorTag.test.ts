// @vitest-environment node
/**
 * Regression for GH: the label-tab shelf-top surface must carry the
 * LABEL_TAB face tag so multi-color bins paint it the label color rather than
 * the body color. The shelf top used to be coplanar with the bin wall top; the
 * fuse merged the two faces and the merged face lost the LABEL_TAB origin. The
 * fix extrudes the shelf COPLANAR_OVERLAP proud so its top face stays distinct.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import type { BoundingBox } from './__kernel-tests__/meshAssertions';
import { loadTestFonts } from '@/test/loadTestFonts';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { FeatureTag } from './featureTags';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/shared/types/generation';

beforeAll(async () => {
  await initBrepjs();
  await loadTestFonts();
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

function tagBoxes(m: MeshData): Map<number, BoundingBox> {
  const coords = new Map<number, number[]>();
  for (const fg of m.faceGroups ?? []) {
    const out = coords.get(fg.tag) ?? [];
    for (let k = fg.start; k < fg.start + fg.count; k++) {
      const v = m.indices[k] * 3;
      out.push(m.vertices[v], m.vertices[v + 1], m.vertices[v + 2]);
    }
    coords.set(fg.tag, out);
  }
  return new Map([...coords].map(([tag, xyz]) => [tag, boundingBox(new Float32Array(xyz))]));
}

// The tab builder used to stamp LABEL_TAB on the whole tab, glyphs included,
// so the text zone color never reached tab text in the preview or the 3MF.
describe('label tab text color tag', () => {
  it.each(['emboss', 'engrave'] as const)(
    '%s tab text carries TEXT in preview and export, inside the tab',
    (mode) => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 1,
        height: 3,
        textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, mode },
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
        compartments: {
          cols: 1,
          rows: 1,
          cells: [0],
          thickness: 1.2,
          compartmentTexts: ['SCREWS'],
        },
      };
      const preview = tagBoxes(getGenerateBin()(params, undefined, false));
      const exported = tagBoxes(getGenerateBin()(params, undefined, true));

      for (const boxes of [preview, exported]) {
        const tab = boxes.get(FeatureTag.LABEL_TAB);
        const text = boxes.get(FeatureTag.TEXT);
        expect(tab).toBeDefined();
        expect(text).toBeDefined();
        if (!tab || !text) return;
        expect(text.minX).toBeGreaterThanOrEqual(tab.minX - 0.01);
        expect(text.maxX).toBeLessThanOrEqual(tab.maxX + 0.01);
        expect(text.minY).toBeGreaterThanOrEqual(tab.minY - 0.01);
        expect(text.maxY).toBeLessThanOrEqual(tab.maxY + 0.01);
      }

      // The tab keeps its own tags, so a stale origin entry from its internal
      // booleans can land on an unrelated bin face. Pin the tab's footprint:
      // export must tag the same region the preview does, not the stacking lip.
      const previewTab = preview.get(FeatureTag.LABEL_TAB);
      const exportTab = exported.get(FeatureTag.LABEL_TAB);
      expect(exportTab?.minY).toBeCloseTo(previewTab?.minY ?? NaN, 2);
      expect(exportTab?.maxZ).toBeCloseTo(previewTab?.maxZ ?? NaN, 2);
    },
    180_000
  );
});
