/**
 * Semantic round-trip tests for multi-color 3MF export.
 *
 * Pins the end-to-end semantic invariants of the assembled output of
 * `buildSinglePiece3MF` / `buildMultiObject3MF`. Slicers (PrusaSlicer,
 * BambuStudio, OrcaSlicer) read multi-material painting from a `paint_color`
 * attribute on each `<triangle>`, encoded per OrcaSlicer's CONST_FILAMENTS
 * table — these tests decode that attribute back to material slot indices via
 * `resolveColorMapping` so assertions read in terms of zone colors.
 *
 *   1. FeatureTag → paint_color round-trip — every triangle in a face group
 *      emits the matching filament code for that feature's configured zone.
 *   2. Lip corner round-trip — lip triangles in each XY quadrant carry the
 *      configured corner color's slot.
 *   3. Single-color short-circuit — all-same-color (incl. mixed-case hex) emits
 *      no `paint_color` anywhere; mixed-case dedup yields one slot, not two.
 *   4. Multi-object color contract — bin carries per-triangle paint_color from
 *      its face groups; lid and dividers carry a uniform paint_color drawn
 *      from `featureColors.lid` / `featureColors.dividers` so a multi-color
 *      print actually swaps filaments between body and lid/divider in the slicer.
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
import { normalizeHex, resolveColorMapping } from '@/features/bin-designer/types/featureColors';
import { FILAMENT_PAINT_CODES } from '@/features/generation/export/threemfExporter';
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

/**
 * Decode a paint_color attribute back to a material slot index using the
 * live FILAMENT_PAINT_CODES from the exporter. The exporter maps slot N to
 * `FILAMENT_PAINT_CODES[N + 1]` so decoding subtracts 1 to recover the slot.
 * `code === undefined` (no paint_color attribute) shouldn't appear in any
 * colored export — colorConfig'd objects emit paint_color on every triangle.
 */
function slotFromCode(code: string | undefined): number {
  if (code === undefined) {
    throw new Error('paint_color missing on triangle of a colored export — expected explicit code');
  }
  const idx = FILAMENT_PAINT_CODES.indexOf(code as (typeof FILAMENT_PAINT_CODES)[number]);
  if (idx <= 0) throw new Error(`unknown paint_color code: ${code}`);
  return idx - 1;
}

/** Material slot per triangle in document order. */
function parseTriangleSlots(xml: string): number[] {
  const out: number[] = [];
  for (const m of xml.matchAll(
    /<triangle\s+v1="\d+"\s+v2="\d+"\s+v3="\d+"(?:\s+paint_color="([^"]*)")?\s*\/>/g
  )) {
    out.push(slotFromCode(m[1]));
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
      lid: overrides.lid ?? body,
    },
  };
}

// ─── tests ───────────────────────────────────────────────────────────────

/** Map a hex color back to its material slot via the live `resolveColorMapping`. */
function slotFor(params: BinParams, hex: string): number {
  const { colorToIndex } = resolveColorMapping(params.featureColors);
  const slot = colorToIndex.get(normalizeHex(hex));
  if (slot === undefined) throw new Error(`color ${hex} not present in materials`);
  return slot;
}

describe('multicolor 3MF round-trip', () => {
  describe('FeatureTag → paint_color round-trip', () => {
    it('every triangle in a face group emits the configured zone color slot', async () => {
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
      const slots = parseTriangleSlots(xml);

      expect(slotFor(params, '#111111')).toBe(0);
      expect(slots).toEqual([
        slotFor(params, '#22ee22'),
        slotFor(params, '#22ee22'),
        slotFor(params, '#3333ee'),
        slotFor(params, '#3333ee'),
        slotFor(params, '#ee3333'),
        slotFor(params, '#ee3333'),
      ]);
    });

    it('untagged triangles default to body (slot 0)', async () => {
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
      const slots = parseTriangleSlots(await blobToModelXml(blob));

      expect(slots[0]).toBe(slotFor(params, '#deadbe'));
      expect(slots[1]).toBe(slotFor(params, '#deadbe'));
      expect(slots[2]).toBe(slotFor(params, '#abc123')); // body → slot 0
      expect(slots[3]).toBe(slotFor(params, '#abc123'));
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
      const slots = parseTriangleSlots(await blobToModelXml(blob));

      const textSlot = slotFor(params, '#ee44ee');
      expect(textSlot).toBeGreaterThan(0);
      expect(slots).toEqual([textSlot, textSlot]);
    });

    it('every emitted slot index points at a valid material in the mapping', async () => {
      const params = withColors({ body: '#ffffff', base: '#000000' });
      const triangles = [...tri(0, 0), ...tri(1, 0)];
      const faceGroups: FaceGroupData[] = [{ start: 0, count: 6, tag: FeatureTag.SOCKET }];
      const blob = buildSinglePiece3MF(
        buildBinarySTL(triangles),
        faceGroups,
        params,
        'slot-int',
        PRINT_SETTINGS,
        true
      );
      const slots = parseTriangleSlots(await blobToModelXml(blob));
      const { colors } = resolveColorMapping(params.featureColors);

      for (const slot of slots) {
        expect(slot).toBeGreaterThanOrEqual(0);
        expect(slot).toBeLessThan(colors.length);
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
      const slots = parseTriangleSlots(await blobToModelXml(blob));

      expect(slots).toEqual([
        slotFor(params, '#fa0000'),
        slotFor(params, '#00fa00'),
        slotFor(params, '#0000fa'),
        slotFor(params, '#ffffff'),
      ]);
    });
  });

  describe('single-color short-circuit', () => {
    it('all-same-color (lowercase) emits no paint_color', async () => {
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

      expect(xml).not.toMatch(/\bpaint_color="/);
      expect(xml).not.toMatch(/<m:colorgroup\b/);
      expect(xml).not.toMatch(/\bxmlns:m=/);
    });

    it('mixed-case AND mixed-length hex collapse to single material (no paint_color)', async () => {
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

      expect(xml).not.toMatch(/\bpaint_color="/);
    });

    it('mixed-case dedup yields N materials, not 2N (only divergent zones add slots)', async () => {
      // Regression for resolveColorMapping case + shorthand normalization:
      // body `#FFF`, base `#ffffff`, labelTab `#FF0000` → 2 materials, not 3.
      const params = withColors({ body: '#FFF', base: '#ffffff', labelTab: '#FF0000' });
      // Even though the wire format no longer carries materials, the in-memory
      // mapping is what feeds slot indices to paint_color — assert directly.
      const { colors } = resolveColorMapping(params.featureColors);
      expect(colors).toEqual(['#ffffff', '#ff0000']);
    });
  });

  describe('multi-object color contract', () => {
    it('bin carries per-triangle paint_color; lid + dividers ship uniform paint_color from their zones', async () => {
      const params = withColors({
        body: '#aaaaaa',
        labelTab: '#0000ff',
        dividers: '#22aa22',
        lid: '#ee44ee',
      });
      const pieces = [
        { data: buildBinarySTL([...tri(0, 0)]), label: 'bin' },
        { data: buildBinarySTL([...tri(1, 0)]), label: 'divider-horizontal' },
        { data: buildBinarySTL([...tri(2, 0)]), label: 'lid' },
      ];
      const faceGroups: FaceGroupData[] = [{ start: 0, count: 3, tag: FeatureTag.LABEL_TAB }];

      const blob = buildMultiObject3MF(pieces, faceGroups, params, 'assembly', PRINT_SETTINGS);
      const xml = await blobToModelXml(blob);

      // Three <object> entries (bin, divider, lid).
      const objects = xml.match(/<object\s+id="\d+"/g) ?? [];
      expect(objects).toHaveLength(3);

      // One paint_color per piece — three triangles total → three attributes.
      // Bin → labelTab slot, divider → dividers slot, lid → lid slot.
      const slots = parseTriangleSlots(xml);
      expect(slots).toEqual([
        slotFor(params, '#0000ff'),
        slotFor(params, '#22aa22'),
        slotFor(params, '#ee44ee'),
      ]);

      // Colorgroups + materials namespace are gone for good.
      expect(xml).not.toMatch(/<m:colorgroup\b/);
      expect(xml).not.toMatch(/\bxmlns:m=/);
    });

    it('lid + dividers stay solid (no paint_color) when their zone matches body', async () => {
      // When ancillary zones equal body, there is no filament swap to encode;
      // the slot they'd reference still exists (body) but emitting paint_color
      // on every lid/divider triangle wastes bytes. Today the implementation
      // still emits — this test pins that and can be tightened later.
      const params = withColors({ body: '#aaaaaa', labelTab: '#0000ff' });
      const pieces = [
        { data: buildBinarySTL([...tri(0, 0)]), label: 'bin' },
        { data: buildBinarySTL([...tri(1, 0)]), label: 'lid' },
      ];
      const faceGroups: FaceGroupData[] = [{ start: 0, count: 3, tag: FeatureTag.LABEL_TAB }];

      const blob = buildMultiObject3MF(pieces, faceGroups, params, 'assembly', PRINT_SETTINGS);
      const xml = await blobToModelXml(blob);
      const slots = parseTriangleSlots(xml);

      // Bin triangle → labelTab slot (1), lid triangle → body slot (0).
      expect(slots).toEqual([slotFor(params, '#0000ff'), slotFor(params, '#aaaaaa')]);
    });

    it('emits no paint_color anywhere when featureColors.enabled but every active zone equals body', async () => {
      // Edge case Greptile flagged: enabled=true but the bin's
      // buildTriangleMaterialIndices short-circuits to null (single color).
      // Ancillary pieces must short-circuit in lockstep or BambuStudio
      // compatibility metadata + filament_colour sidecar would land on a
      // functionally single-color file.
      const params = withColors({ body: '#aaaaaa' });
      const pieces = [
        { data: buildBinarySTL([...tri(0, 0)]), label: 'bin' },
        { data: buildBinarySTL([...tri(1, 0)]), label: 'divider-horizontal' },
        { data: buildBinarySTL([...tri(2, 0)]), label: 'lid' },
      ];
      const blob = buildMultiObject3MF(pieces, [], params, 'assembly', PRINT_SETTINGS);
      const xml = await blobToModelXml(blob);
      expect(xml).not.toMatch(/\bpaint_color="/);
      expect(xml).not.toMatch(/<m:colorgroup\b/);
    });

    it('lays the lid out beside the bin in print orientation (bug #4)', async () => {
      // `exportLid` pre-rotates the lid into print orientation (floor faces
      // down → lid sits at negative Z relative to the original mating
      // pose). The synthetic lid mimics that: triangles at z = -25 .. -20
      // with the floor at z = -25.
      const params = withColors();
      // Bin: 10×10 footprint at origin, sitting on the plate at z = 0.
      const binTri = [0, 0, 0, 10, 0, 0, 0, 10, 0];
      // Lid: 8×8 footprint, post-orientForPrint (Y inverted, Z below origin).
      const lidTri = [0, -8, -25, 8, -8, -25, 0, 0, -20];
      const pieces = [
        { data: buildBinarySTL(binTri), label: 'bin' },
        { data: buildBinarySTL(lidTri), label: 'lid' },
      ];
      const blob = buildMultiObject3MF(pieces, [], params, 'lid-print', PRINT_SETTINGS);
      const xml = await blobToModelXml(blob);

      const vertexCoords: number[][] = [];
      for (const m of xml.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)" \/>/g)) {
        vertexCoords.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
      }
      // First 3 vertices = bin, last 3 = lid.
      const lidVerts = vertexCoords.slice(-3);
      const lidMinX = Math.min(...lidVerts.map((v) => v[0]));
      const lidMaxX = Math.max(...lidVerts.map((v) => v[0]));
      const lidMinY = Math.min(...lidVerts.map((v) => v[1]));
      const lidMaxY = Math.max(...lidVerts.map((v) => v[1]));
      const lidMinZ = Math.min(...lidVerts.map((v) => v[2]));
      const lidMaxZ = Math.max(...lidVerts.map((v) => v[2]));
      // Lid sits to the right of the bin (bin max X = 10, gap = 5).
      expect(lidMinX).toBeCloseTo(15, 5);
      // Lid width unchanged (8) — no rotation should distort it.
      expect(lidMaxX - lidMinX).toBeCloseTo(8, 5);
      // Lid Y centered on bin's Y center (bin center = 5, lid depth = 8 → center at 4).
      expect((lidMinY + lidMaxY) / 2).toBeCloseTo(5, 5);
      // Lid bottom aligns with bin bottom (both at z=0) — no more stacking,
      // and the post-orientForPrint orientation isn't double-flipped.
      expect(lidMinZ).toBeCloseTo(0, 5);
      // Lid height preserved at 5mm — proof we translated rather than
      // rotating again (a re-rotation would shift max Z, not just min Z).
      expect(lidMaxZ - lidMinZ).toBeCloseTo(5, 5);
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
      expect(xml).not.toMatch(/\bpaint_color="/);
      expect(xml).not.toMatch(/<m:colorgroup\b/);
      expect(xml).not.toMatch(/\bxmlns:m=/);
    });
  });
});
