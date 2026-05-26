/**
 * Semantic round-trip tests for multi-color 3MF export.
 *
 * The existing test files (`materialMapping.test.ts`, `binDownloadHelpers.test.ts`,
 * `threemfExporter.test.ts`) cover the layers in isolation. This file pins the
 * end-to-end semantic invariants on the assembled output of
 * `buildSinglePiece3MF` / `buildMultiObject3MF`:
 *
 *   1. FeatureTag → p1 round-trip — every triangle in a face group emits the
 *      `p1` index of that feature's configured zone color.
 *   2. Lip corner round-trip — lip triangles in each XY quadrant carry the
 *      configured corner color's `p1`.
 *   3. Single-color short-circuit — all-same-color (incl. mixed-case hex) emits
 *      no `<m:colorgroup>`; mixed-case dedup yields one material, not two.
 *   4. Multi-object color contract — only the first piece (bin) carries colors;
 *      ancillary pieces (dividers, lid) ship solid-color.
 *
 * All recent multi-color bugs (text zone missing from preview, mixed-case dedup
 * gap, isSingleColor case inconsistency) would have been caught by these.
 *
 * Inputs are hand-crafted: a tiny synthetic binary STL plus face groups that
 * partition the triangle range. Real worker output is too expensive for
 * synthetic breadth; format/integration coverage lives elsewhere.
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { FeatureTag } from '@/shared/types/generation';
import type { FaceGroupData } from '@/shared/types/generation';
import {
  buildSinglePiece3MF,
  buildMultiObject3MF,
} from '@/features/bin-designer/utils/binDownloadHelpers';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/features/bin-designer/types';
import type { ThreeMFPrintSettings } from '@/shared/generation/export';

// ─── helpers ─────────────────────────────────────────────────────────────

/**
 * Encode a flat triangle array as a binary STL ArrayBuffer.
 * `triangles` is `[x1, y1, z1, x2, y2, z2, x3, y3, z3, ...]` — 9 floats per
 * triangle. Normal is zero-filled (replicated by parser; not used downstream).
 */
function buildBinarySTL(triangles: readonly number[]): ArrayBuffer {
  const count = triangles.length / 9;
  const HEADER = 80;
  const PER_TRI = 50;
  const buf = new ArrayBuffer(HEADER + 4 + count * PER_TRI);
  const view = new DataView(buf);
  view.setUint32(HEADER, count, true);

  let offset = HEADER + 4;
  for (let t = 0; t < count; t++) {
    view.setFloat32(offset, 0, true);
    view.setFloat32(offset + 4, 0, true);
    view.setFloat32(offset + 8, 0, true);
    offset += 12;
    for (let v = 0; v < 3; v++) {
      const base = t * 9 + v * 3;
      view.setFloat32(offset, triangles[base], true);
      view.setFloat32(offset + 4, triangles[base + 1], true);
      view.setFloat32(offset + 8, triangles[base + 2], true);
      offset += 12;
    }
    view.setUint16(offset, 0, true);
    offset += 2;
  }
  return buf;
}

/** Single degenerate triangle at (x, y, 0). */
function tri(x: number, y: number): number[] {
  return [x, y, 0, x, y, 0, x, y, 0];
}

async function blobToModelXml(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const entries = unzipSync(bytes);
  const model = entries['3D/3dmodel.model'];
  if (!model) {
    throw new Error(
      `3MF missing 3D/3dmodel.model; got entries: ${Object.keys(entries).join(', ')}`
    );
  }
  return strFromU8(model);
}

interface Material {
  readonly color: string;
}

const COLORGROUP_BLOCK_RE = /<m:colorgroup\s+id="(\d+)">([\s\S]*?)<\/m:colorgroup>/;
const COLOR_ENTRY_RE = /<m:color\s+color="([^"]*)"\s*\/>/g;

/** Extract `<m:color>` entries from inside a `<m:colorgroup>` block, in order. */
function parseMaterials(xml: string): Material[] {
  const block = COLORGROUP_BLOCK_RE.exec(xml);
  if (!block) return [];
  const out: Material[] = [];
  for (const m of block[2].matchAll(COLOR_ENTRY_RE)) {
    out.push({ color: m[1] });
  }
  return out;
}

/** Triangle in document order with its emitted `p1` (or `null` if none). */
interface Triangle {
  readonly p1: number | null;
  readonly pid: number | null;
}

function parseTriangles(xml: string): Triangle[] {
  const out: Triangle[] = [];
  for (const m of xml.matchAll(
    /<triangle\s+v1="\d+"\s+v2="\d+"\s+v3="\d+"(?:\s+pid="(\d+)"\s+p1="(\d+)")?\s*\/>/g
  )) {
    out.push({
      pid: m[1] !== undefined ? Number(m[1]) : null,
      p1: m[2] !== undefined ? Number(m[2]) : null,
    });
  }
  return out;
}

const PRINT_SETTINGS: ThreeMFPrintSettings = {
  layerHeight: 0.2,
  infillPercent: 20,
  material: 'PLA',
  supportRequired: false,
};

/**
 * Build a multi-color-enabled BinParams where:
 *   1. Every zone (including all four lip corners) defaults to `body` unless
 *      overridden. Without this, the DEFAULT_BIN_PARAMS lip corners (a
 *      different hex from a custom body) would silently introduce an extra
 *      material slot in every test, masking the feature under test.
 *   2. `label.enabled` and `scoop.enabled` are turned on so that `labelTab`
 *      and `scoop` zones count as active in `computeActiveZones`. Divergent
 *      zones get filtered out when their feature is disabled, which would
 *      make a `{ labelTab: '#ff0000' }` override look like single-color.
 */
function withColors(overrides: Partial<BinParams['featureColors']> = {}): BinParams {
  const body = overrides.body ?? DEFAULT_BIN_PARAMS.featureColors.body;
  const lipOverride = overrides.lip;
  const lip = {
    frontLeft: lipOverride?.frontLeft ?? body,
    frontRight: lipOverride?.frontRight ?? body,
    backRight: lipOverride?.backRight ?? body,
    backLeft: lipOverride?.backLeft ?? body,
  };
  return {
    ...DEFAULT_BIN_PARAMS,
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
    featureColors: {
      enabled: true,
      body,
      lip,
      labelTab: overrides.labelTab ?? body,
      base: overrides.base ?? body,
      scoop: overrides.scoop ?? body,
      dividers: overrides.dividers ?? body,
      text: overrides.text ?? body,
    },
  };
}

// ─── tests ───────────────────────────────────────────────────────────────

describe('multicolor 3MF round-trip', () => {
  describe('FeatureTag → p1 round-trip', () => {
    it('every triangle in a face group emits the configured zone color index', async () => {
      const params = withColors({
        body: '#111111',
        labelTab: '#22ee22',
        base: '#3333ee',
        scoop: '#ee3333',
      });
      const triangles = [
        ...tri(0, 0),
        ...tri(1, 0),
        ...tri(2, 0),
        ...tri(3, 0),
        ...tri(4, 0),
        ...tri(5, 0),
      ];
      const faceGroups: FaceGroupData[] = [
        { start: 0, count: 6, tag: FeatureTag.LABEL_TAB },
        { start: 6, count: 6, tag: FeatureTag.SOCKET }, // → 'base' zone
        { start: 12, count: 6, tag: FeatureTag.SCOOP },
      ];
      const blob = buildSinglePiece3MF(
        buildBinarySTL(triangles),
        faceGroups,
        params,
        'round-trip',
        PRINT_SETTINGS,
        true
      );
      const xml = await blobToModelXml(blob);
      const materials = parseMaterials(xml);
      const tris = parseTriangles(xml);

      // Body always lands at index 0 (per resolveColorMapping).
      const idxFor = (hex: string) => materials.findIndex((m) => m.color === hex);
      expect(idxFor('#111111')).toBe(0);
      expect(idxFor('#22ee22')).toBeGreaterThan(0);
      expect(idxFor('#3333ee')).toBeGreaterThan(0);
      expect(idxFor('#ee3333')).toBeGreaterThan(0);

      expect(tris.map((t) => t.p1)).toEqual([
        idxFor('#22ee22'),
        idxFor('#22ee22'),
        idxFor('#3333ee'),
        idxFor('#3333ee'),
        idxFor('#ee3333'),
        idxFor('#ee3333'),
      ]);
    });

    it('untagged triangles default to body (index 0)', async () => {
      const params = withColors({ body: '#abc123', labelTab: '#deadbe' });
      const triangles = [...tri(0, 0), ...tri(1, 0), ...tri(2, 0), ...tri(3, 0)];
      const faceGroups: FaceGroupData[] = [{ start: 0, count: 6, tag: FeatureTag.LABEL_TAB }];
      const blob = buildSinglePiece3MF(
        buildBinarySTL(triangles),
        faceGroups,
        params,
        'untagged',
        PRINT_SETTINGS,
        true
      );
      const xml = await blobToModelXml(blob);
      const materials = parseMaterials(xml);
      const tris = parseTriangles(xml);

      // Resolve via material list to keep the assertion self-documenting,
      // matching the idxFor pattern used by the other tests in this suite.
      const idxFor = (hex: string) => materials.findIndex((m) => m.color === hex);
      expect(tris[0].p1).toBe(idxFor('#deadbe')); // LABEL_TAB
      expect(tris[1].p1).toBe(idxFor('#deadbe')); // LABEL_TAB
      expect(tris[2].p1).toBe(idxFor('#abc123')); // untagged → body
      expect(tris[3].p1).toBe(idxFor('#abc123')); // untagged → body
    });

    it('TEXT-tagged triangles carry the text zone color when tab/cutout text is active', async () => {
      // Recreates the gap that produced the SlicerHandoffPreview bug at the
      // export layer: a body+text divergence should produce two filaments.
      // text zone is active only when label.enabled + compartmentTexts has content.
      const params: BinParams = {
        ...withColors({ body: '#222222', text: '#ee44ee' }),
        compartments: {
          ...DEFAULT_BIN_PARAMS.compartments,
          compartmentTexts: ['hello'],
        },
      };
      const triangles = [...tri(0, 0), ...tri(1, 0)];
      const faceGroups: FaceGroupData[] = [{ start: 0, count: 6, tag: FeatureTag.TEXT }];
      const blob = buildSinglePiece3MF(
        buildBinarySTL(triangles),
        faceGroups,
        params,
        'text-zone',
        PRINT_SETTINGS,
        true
      );
      const xml = await blobToModelXml(blob);
      const materials = parseMaterials(xml);
      const tris = parseTriangles(xml);

      expect(materials.map((m) => m.color)).toEqual(['#222222', '#ee44ee']);
      expect(tris.map((t) => t.p1)).toEqual([1, 1]);
    });

    it('every emitted pid resolves to the m:colorgroup block (reference integrity)', async () => {
      const params = withColors({ body: '#fff', base: '#000' });
      const triangles = [...tri(0, 0), ...tri(1, 0)];
      const faceGroups: FaceGroupData[] = [{ start: 0, count: 6, tag: FeatureTag.SOCKET }];
      const blob = buildSinglePiece3MF(
        buildBinarySTL(triangles),
        faceGroups,
        params,
        'pid-int',
        PRINT_SETTINGS,
        true
      );
      const xml = await blobToModelXml(blob);
      const pidMatch = /<m:colorgroup\s+id="(\d+)"/.exec(xml);
      const colorgroupId = pidMatch ? Number(pidMatch[1]) : NaN;
      const materialsCount = parseMaterials(xml).length;
      const tris = parseTriangles(xml);

      for (const t of tris) {
        if (t.pid === null) continue;
        expect(t.pid).toBe(colorgroupId);
        expect(t.p1).not.toBeNull();
        expect(t.p1).toBeGreaterThanOrEqual(0);
        expect(t.p1).toBeLessThan(materialsCount);
      }
    });
  });

  describe('lip corner round-trip', () => {
    it('lip triangles in each XY quadrant carry the configured corner color', async () => {
      const params = withColors({
        body: '#000000',
        lip: {
          frontLeft: '#fa0000',
          frontRight: '#00fa00',
          backRight: '#0000fa',
          backLeft: '#ffffff',
        },
      });
      // Four lip triangles, one per quadrant of bbox [0..100] × [0..100].
      const triangles = [...tri(10, 10), ...tri(90, 10), ...tri(90, 90), ...tri(10, 90)];
      const faceGroups: FaceGroupData[] = [{ start: 0, count: 12, tag: FeatureTag.LIP }];
      const blob = buildSinglePiece3MF(
        buildBinarySTL(triangles),
        faceGroups,
        params,
        'lip-corners',
        PRINT_SETTINGS,
        true
      );
      const xml = await blobToModelXml(blob);
      const materials = parseMaterials(xml);
      const tris = parseTriangles(xml);

      const idxFor = (hex: string) => materials.findIndex((m) => m.color === hex);
      expect(tris.map((t) => t.p1)).toEqual([
        idxFor('#fa0000'),
        idxFor('#00fa00'),
        idxFor('#0000fa'),
        idxFor('#ffffff'),
      ]);
    });
  });

  describe('single-color short-circuit', () => {
    it('all-same-color (lowercase) emits no <m:colorgroup>', async () => {
      const params = withColors(); // all zones default to '#d4d8dc'
      const triangles = [...tri(0, 0), ...tri(1, 0)];
      const faceGroups: FaceGroupData[] = [{ start: 0, count: 6, tag: FeatureTag.SOCKET }];
      const blob = buildSinglePiece3MF(
        buildBinarySTL(triangles),
        faceGroups,
        params,
        'single',
        PRINT_SETTINGS,
        true
      );
      const xml = await blobToModelXml(blob);

      expect(xml).not.toMatch(/<m:colorgroup\b/);
      expect(xml).not.toMatch(/\bxmlns:m=/);
      expect(xml).not.toMatch(/\bpid="/);
      expect(xml).not.toMatch(/\bp1="/);
    });

    it('mixed-case AND mixed-length hex collapse to single material (no <m:colorgroup>)', async () => {
      // Regressions for the case-normalization and shorthand-expansion fixes.
      // `#FFF`, `#fff`, `#FFFFFF` all canonicalize to `#ffffff`.
      const params = withColors({ body: '#FFF', base: '#fff', labelTab: '#FFFFFF' });
      const triangles = [...tri(0, 0)];
      const faceGroups: FaceGroupData[] = [{ start: 0, count: 3, tag: FeatureTag.SOCKET }];
      const blob = buildSinglePiece3MF(
        buildBinarySTL(triangles),
        faceGroups,
        params,
        'mixed-case-single',
        PRINT_SETTINGS,
        true
      );
      const xml = await blobToModelXml(blob);

      expect(xml).not.toMatch(/<m:colorgroup\b/);
    });

    it('mixed-case dedup yields N materials, not 2N (only divergent zones add slots)', async () => {
      // Regression for resolveColorMapping case + shorthand normalization:
      // body `#FFF`, base `#ffffff`, labelTab `#FF0000` → 2 materials, not 3.
      const params = withColors({ body: '#FFF', base: '#ffffff', labelTab: '#FF0000' });
      const triangles = [...tri(0, 0), ...tri(1, 0)];
      const faceGroups: FaceGroupData[] = [
        { start: 0, count: 3, tag: FeatureTag.SOCKET },
        { start: 3, count: 3, tag: FeatureTag.LABEL_TAB },
      ];
      const blob = buildSinglePiece3MF(
        buildBinarySTL(triangles),
        faceGroups,
        params,
        'mixed-case-dedup',
        PRINT_SETTINGS,
        true
      );
      const materials = parseMaterials(await blobToModelXml(blob));
      expect(materials).toHaveLength(2);
      // Lowercased per resolveColorMapping's normalization.
      expect(materials.map((m) => m.color)).toEqual(['#ffffff', '#ff0000']);
    });
  });

  describe('multi-object color contract', () => {
    it('only the first piece (bin) carries colorConfig; ancillary pieces ship solid-color', async () => {
      const params = withColors({ body: '#aaaaaa', labelTab: '#0000ff' });
      const pieces = [
        { data: buildBinarySTL([...tri(0, 0)]), label: 'bin' },
        { data: buildBinarySTL([...tri(1, 0)]), label: 'divider-horizontal' },
        { data: buildBinarySTL([...tri(2, 0)]), label: 'lid' },
      ];
      const faceGroups: FaceGroupData[] = [{ start: 0, count: 3, tag: FeatureTag.LABEL_TAB }];

      const blob = buildMultiObject3MF(pieces, faceGroups, params, 'assembly', PRINT_SETTINGS);
      const xml = await blobToModelXml(blob);

      // Exactly one <m:colorgroup> block — for the bin piece.
      const groupBlocks = xml.match(/<m:colorgroup\b/g) ?? [];
      expect(groupBlocks).toHaveLength(1);

      // The materials extension namespace is declared on <model>.
      expect(xml).toMatch(/\bxmlns:m="http:\/\/schemas\.microsoft\.com\/3dmanufacturing\/material/);

      // Three <object> entries (bin, divider, lid).
      const objects = xml.match(/<object\s+id="\d+"/g) ?? [];
      expect(objects).toHaveLength(3);

      // The colorgroup block precedes the first <object> in document order.
      const groupAt = xml.indexOf('<m:colorgroup');
      const firstObjAt = xml.indexOf('<object');
      expect(groupAt).toBeLessThan(firstObjAt);
    });

    it('multi-color disabled at the params level disables colors on every piece', async () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        featureColors: { ...DEFAULT_BIN_PARAMS.featureColors, enabled: false, labelTab: '#0000ff' },
      };
      const blob = buildMultiObject3MF(
        [{ data: buildBinarySTL([...tri(0, 0)]), label: 'bin' }],
        [{ start: 0, count: 3, tag: FeatureTag.LABEL_TAB }],
        params,
        'assembly',
        PRINT_SETTINGS
      );
      const xml = await blobToModelXml(blob);
      expect(xml).not.toMatch(/<m:colorgroup\b/);
      expect(xml).not.toMatch(/\bxmlns:m=/);
      expect(xml).not.toMatch(/\bp1="/);
    });
  });
});
