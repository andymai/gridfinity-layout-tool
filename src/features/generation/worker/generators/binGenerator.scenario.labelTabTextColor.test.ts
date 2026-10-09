// @vitest-environment node
/**
 * Label-tab glyphs carry FeatureTag.TEXT, so a multi-color export paints them
 * the text zone's filament instead of folding them into the tab colour.
 * Asserted on the worker mesh and on the 3MF XML built from it.
 */
import { describe, it, beforeAll, beforeEach, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { loadTestFonts } from '@/test/loadTestFonts';
import { clearAllCaches } from './shapeCache';
import { FeatureTag } from './featureTags';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { buildTriangleMaterialIndices } from '@/features/bin-designer/utils/materialMapping';
import { computeActiveZones } from '@/features/bin-designer/types/featureColors';
import { build3MFBuffer, FILAMENT_PAINT_CODES } from '@/features/generation/export/threemfExporter';
import { assertWatertight, meshVolume } from './__kernel-tests__/meshAssertions';
import type { BinParams, TextMode } from '@/shared/types/bin';
import type { FaceGroupData } from '@/shared/types/generation';

beforeAll(async () => {
  await initBrepjs();
  await loadTestFonts();
}, 60_000);

beforeEach(() => clearAllCaches());

const TEXT_HEX = '#ff0000';
const TAB_HEX = '#2255aa';

function params(
  mode: TextMode,
  scoop = false,
  colors: Partial<BinParams['featureColors']> = {},
  label: Partial<BinParams['label']> = {}
): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 1,
    height: 3,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: scoop },
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, textStyle: { mode }, ...label },
    compartments: {
      ...DEFAULT_BIN_PARAMS.compartments,
      cols: 2,
      rows: 1,
      cells: [0, 1],
      compartmentTexts: ['BOLTS', ''],
    },
    featureColors: {
      ...DEFAULT_BIN_PARAMS.featureColors,
      enabled: true,
      labelTab: TAB_HEX,
      text: TEXT_HEX,
      ...colors,
    },
  };
}

interface Tri {
  readonly tag: number;
  readonly zs: readonly number[];
  readonly cx: number;
}

function triangles(m: {
  vertices: ArrayLike<number>;
  indices: ArrayLike<number>;
  faceGroups?: readonly FaceGroupData[];
}): Tri[] {
  const out: Tri[] = [];
  for (const fg of m.faceGroups ?? []) {
    for (let t = 0; t < fg.count / 3; t++) {
      const vs = [0, 1, 2].map((k) => m.indices[fg.start + t * 3 + k] * 3);
      out.push({
        tag: fg.tag,
        zs: vs.map((v) => m.vertices[v + 2]),
        cx: vs.reduce((sum, v) => sum + m.vertices[v], 0) / 3,
      });
    }
  }
  return out;
}

function midX(vertices: ArrayLike<number>): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    lo = Math.min(lo, vertices[i]);
    hi = Math.max(hi, vertices[i]);
  }
  return (lo + hi) / 2;
}

function tabTopZ(tris: readonly Tri[]): number {
  return Math.max(...tris.filter((t) => t.tag === FeatureTag.LABEL_TAB).flatMap((t) => [...t.zs]));
}

describe('label-tab text color tag', () => {
  it('tags embossed glyphs TEXT, only on the captioned tab, above the shelf', () => {
    const m = getGenerateBin()(params('emboss'));
    const tris = triangles(m);
    const text = tris.filter((t) => t.tag === FeatureTag.TEXT);
    expect(text.length).toBeGreaterThan(0);

    const mid = midX(m.vertices);
    expect(text.every((t) => t.cx < mid)).toBe(true);

    const shelfTop = tabTopZ(tris);
    expect(Math.min(...text.flatMap((t) => [...t.zs]))).toBeGreaterThanOrEqual(shelfTop - 0.05);
  }, 120_000);

  it('tags engraved glyph walls and floors TEXT, below the shelf top', () => {
    const m = getGenerateBin()(params('engrave'));
    const tris = triangles(m);
    const text = tris.filter((t) => t.tag === FeatureTag.TEXT);
    expect(text.length).toBeGreaterThan(0);

    const shelfTop = tabTopZ(tris);
    expect(Math.max(...text.flatMap((t) => [...t.zs]))).toBeLessThanOrEqual(shelfTop + 0.02);
    expect(text.some((t) => Math.max(...t.zs) < shelfTop - 0.1)).toBe(true);
  }, 120_000);

  it('keeps the TEXT tag when the label tab comes from the feature cache', () => {
    const cold = triangles(getGenerateBin()(params('emboss')));
    const warm = triangles(getGenerateBin()(params('emboss', true)));
    const count = (tris: readonly Tri[]): number =>
      tris.filter((t) => t.tag === FeatureTag.TEXT).length;
    expect(count(cold)).toBeGreaterThan(0);
    expect(count(warm)).toBe(count(cold));
  }, 180_000);

  it('paints the glyph triangles with the text filament in the 3MF', () => {
    const p = params('emboss');
    const m = getGenerateBin()(p);
    const faceGroups = m.faceGroups ?? [];
    const triCount = m.indices.length / 3;
    const flat = new Float32Array(triCount * 9);
    for (let t = 0; t < triCount; t++) {
      for (let k = 0; k < 3; k++) {
        const v = m.indices[t * 3 + k] * 3;
        flat.set([m.vertices[v], m.vertices[v + 1], m.vertices[v + 2]], t * 9 + k * 3);
      }
    }
    const mapping = buildTriangleMaterialIndices(
      faceGroups,
      p.featureColors,
      triCount,
      flat,
      computeActiveZones(p)
    );
    expect(mapping).not.toBeNull();
    if (!mapping) return;
    const vertices = mapping.vertices ?? flat;
    const buffer = build3MFBuffer(vertices, mapping.normals ?? new Float32Array(vertices.length), {
      name: 'text-color',
      colorConfig: mapping.config,
    });
    const files = unzipSync(buffer);

    const palette = mapping.config.materials.map((mat) => mat.color.toLowerCase());
    const textCode = FILAMENT_PAINT_CODES[palette.indexOf(TEXT_HEX) + 1];
    const tabCode = FILAMENT_PAINT_CODES[palette.indexOf(TAB_HEX) + 1];

    const model = strFromU8(files['3D/3dmodel.model']);
    const codes = [...model.matchAll(/<triangle [^>]*paint_color="([^"]+)"/g)].map((r) => r[1]);
    const textTris = triangles(m).filter((t) => t.tag === FeatureTag.TEXT).length;
    expect(textTris).toBeGreaterThan(0);
    expect(codes.filter((c) => c === textCode)).toHaveLength(textTris);
    expect(codes.filter((c) => c === tabCode).length).toBeGreaterThan(0);
  }, 120_000);
});

function paintCodes(p: BinParams): {
  tris: Tri[];
  codes: string[];
  codeFor: (hex: string) => string | undefined;
} {
  const m = getGenerateBin()(p);
  const triCount = m.indices.length / 3;
  const flat = new Float32Array(triCount * 9);
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const v = m.indices[t * 3 + k] * 3;
      flat.set([m.vertices[v], m.vertices[v + 1], m.vertices[v + 2]], t * 9 + k * 3);
    }
  }
  const mapping = buildTriangleMaterialIndices(
    m.faceGroups ?? [],
    p.featureColors,
    triCount,
    flat,
    computeActiveZones(p)
  );
  if (!mapping) throw new Error('no material mapping');
  const vertices = mapping.vertices ?? flat;
  const files = unzipSync(
    build3MFBuffer(vertices, mapping.normals ?? new Float32Array(vertices.length), {
      name: 'support-color',
      colorConfig: mapping.config,
    })
  );
  const palette = mapping.config.materials.map((mat) => mat.color.toLowerCase());
  const model = strFromU8(files['3D/3dmodel.model']);
  return {
    tris: triangles(m),
    codes: [...model.matchAll(/<triangle [^>]*paint_color="([^"]+)"/g)].map((r) => r[1]),
    codeFor: (hex) => FILAMENT_PAINT_CODES[palette.indexOf(hex) + 1],
  };
}

describe('label-tab support color', () => {
  // Each support style is its own solid, and a socket tab thickens the shelf.
  it.each([
    ['bracket', { support: 'bracket' }],
    ['solid', { support: 'solid' }],
    ['fillet', { support: 'fillet' }],
    ['socket', { support: 'bracket', mode: 'socket', depth: 14 }],
  ] as const)(
    'tags the %s support under the shelf LABEL_SUPPORT and keeps the shelf LABEL_TAB',
    (_name, label) => {
      const tris = triangles(getGenerateBin()(params('engrave', false, {}, label)));
      const support = tris.filter((t) => t.tag === FeatureTag.LABEL_SUPPORT);
      expect(support.length).toBeGreaterThan(0);
      const shelfTop = tabTopZ(tris);
      // Under the shelf plate, which is at least one wall thickness deep.
      expect(Math.max(...support.flatMap((t) => [...t.zs]))).toBeLessThan(shelfTop - 1);
    },
    120_000
  );

  it('paints the support in the body filament, and in the label one when asked', () => {
    const body = paintCodes(params('engrave'));
    const tabTris = body.tris.filter((t) => t.tag === FeatureTag.LABEL_TAB).length;
    const supportTris = body.tris.filter((t) => t.tag === FeatureTag.LABEL_SUPPORT).length;
    expect(supportTris).toBeGreaterThan(0);
    expect(body.codes.filter((c) => c === body.codeFor(TAB_HEX))).toHaveLength(tabTris);

    const label = paintCodes(params('engrave', false, { labelSupportsInLabelColor: true }));
    expect(label.codes.filter((c) => c === label.codeFor(TAB_HEX))).toHaveLength(
      tabTris + supportTris
    );
  }, 180_000);
});

describe('flat label-tab text', () => {
  const withoutText = (p: BinParams): BinParams => ({
    ...p,
    compartments: { ...p.compartments, compartmentTexts: ['', ''] },
  });

  it('splits the shelf top into TEXT glyph faces without adding or removing material', () => {
    const p = params('flat');
    const m = getGenerateBin()(p);
    const tris = triangles(m);
    const text = tris.filter((t) => t.tag === FeatureTag.TEXT);
    expect(text.length).toBeGreaterThan(0);

    const mid = midX(m.vertices);
    expect(text.every((t) => t.cx < mid)).toBe(true);

    const shelfTop = tabTopZ(tris);
    for (const z of text.flatMap((t) => [...t.zs])) expect(z).toBeCloseTo(shelfTop, 3);

    const plain = meshVolume(getGenerateBin()(withoutText(p)));
    expect(Math.abs(meshVolume(m) - plain)).toBeLessThan(plain * 1e-5);
  }, 180_000);

  it('keeps the glyph faces through the export fuse and stays watertight', () => {
    const m = getGenerateBin()(params('flat'), undefined, true);
    assertWatertight(m, 'flat tab text export');
    const tris = triangles(m);
    const text = tris.filter((t) => t.tag === FeatureTag.TEXT);
    expect(text.length).toBeGreaterThan(0);
    const shelfTop = tabTopZ(tris);
    for (const z of text.flatMap((t) => [...t.zs])) expect(z).toBeCloseTo(shelfTop, 3);
  }, 180_000);

  it('paints the flat glyphs with the text filament in the 3MF', () => {
    const { tris, codes, codeFor } = paintCodes(params('flat'));
    const textTris = tris.filter((t) => t.tag === FeatureTag.TEXT).length;
    expect(textTris).toBeGreaterThan(0);
    expect(codes.filter((c) => c === codeFor(TEXT_HEX))).toHaveLength(textTris);
  }, 120_000);
});
