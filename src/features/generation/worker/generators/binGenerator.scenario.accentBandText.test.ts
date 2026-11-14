// @vitest-environment node
/**
 * Both rules lean on the kernel keeping `FeatureTag.TEXT` on every glyph face
 * through the booleans, which a hand-built triangle cannot show. An untagged
 * glyph side would still lift the band's datum, so these read generated meshes.
 * Exact kernel only: a Manifold draft tags nothing, so no zone paints until the
 * exact mesh supersedes it.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { makeCutout } from './__kernel-tests__/scenarioTypes';
import { loadTestFonts } from '@/test/loadTestFonts';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { computeActiveZones, getZoneColor } from '@/features/bin-designer/types/featureColors';
import { buildMultiColorGroups } from '@/features/bin-designer/utils/multiColorGroups';
import { buildSinglePiece3MFObject } from '@/features/bin-designer/utils/binDownloadHelpers';
import { buildSTLBufferFromIndexed } from '@/shared/generation/export';
import type { BinParams, TextMode } from '@/shared/types/bin';

const BODY = '#444444';
const BAND = '#b00000';
const TEXT = '#f5f5f5';
const BAND_MM = 2;
const MODEL_TOP_MM = 28;

beforeAll(async () => {
  await initBrepjs();
  await loadTestFonts();
}, 60_000);

function colored(params: Partial<BinParams>, mode: TextMode): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    height: 4,
    ...params,
    textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, mode, depth: 1 },
    featureColors: {
      ...DEFAULT_BIN_PARAMS.featureColors,
      enabled: true,
      body: BODY,
      labelTab: BODY,
      text: TEXT,
      topAccent: { enabled: true, heightMm: BAND_MM, color: BAND },
    },
  };
}

function tabBin(mode: TextMode): BinParams {
  return colored(
    {
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, compartmentTexts: ['M4x20'] },
    },
    mode
  );
}

function solidBinWithCaption(mode: TextMode): BinParams {
  return colored(
    {
      width: 3,
      depth: 2,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutouts: [
        makeCutout({
          id: 'c',
          x: 40,
          y: 20,
          width: 30,
          depth: 20,
          cutDepth: 8,
          label: 'M4',
          engraveLabel: true,
          textAnchor: 'top',
        }),
      ],
    },
    mode
  );
}

interface PaintedTriangle {
  readonly hex: string;
  readonly minZ: number;
  readonly maxZ: number;
}

function painted(flat: ArrayLike<number>, hexOf: (tri: number) => string): PaintedTriangle[] {
  const out: PaintedTriangle[] = [];
  for (let i = 0; i < flat.length / 9; i++) {
    const zs = [flat[i * 9 + 2], flat[i * 9 + 5], flat[i * 9 + 8]];
    out.push({ hex: hexOf(i), minZ: Math.min(...zs), maxZ: Math.max(...zs) });
  }
  return out;
}

function paintPreview(params: BinParams): PaintedTriangle[] {
  const mesh = getGenerateBin()(params);
  const result = buildMultiColorGroups(
    mesh.faceGroups ?? [],
    mesh.vertices,
    mesh.indices,
    params.featureColors,
    computeActiveZones(params)
  );
  if (!result?.meshOverride) throw new Error('a live band always re-tessellates');
  const { triZones } = result;
  return painted(result.meshOverride.vertices, (i) =>
    getZoneColor(params.featureColors, triZones[i])
  );
}

function paintExport(params: BinParams): PaintedTriangle[] {
  const mesh = getGenerateBin()(params, undefined, true);
  const stl = buildSTLBufferFromIndexed(mesh.vertices, mesh.normals, mesh.indices);
  const object = buildSinglePiece3MFObject(stl, mesh.faceGroups ?? [], params, 'x', true);
  const config = object.colorConfig;
  if (!config) throw new Error('a live band always exports colored');
  return painted(object.vertices, (i) => config.materials[config.triangleMaterialIndices[i]].color);
}

const PIPELINES = [
  ['preview', paintPreview],
  ['export', paintExport],
] as const;

describe.each(PIPELINES)('accent band around text (%s)', (_name, paint) => {
  it.each([
    ['label tab', tabBin('emboss')],
    ['solid bin caption', solidBinWithCaption('emboss')],
  ])('hangs the band from the model under embossed text: %s', (_host, params) => {
    const triangles = paint(params);

    const band = triangles.filter((t) => t.hex === BAND);
    expect(Math.min(...band.map((t) => t.minZ))).toBeCloseTo(MODEL_TOP_MM - BAND_MM, 1);

    const raised = triangles.filter((t) => t.maxZ > MODEL_TOP_MM + 0.1);
    expect(raised.length).toBeGreaterThan(0);
    expect(new Set(raised.map((t) => t.hex))).toEqual(new Set([TEXT]));
  });

  it.each([
    ['engraved tab', tabBin('engrave')],
    ['flat tab', tabBin('flat')],
    ['engraved caption', solidBinWithCaption('engrave')],
    ['flat caption', solidBinWithCaption('flat')],
  ])('keeps the Text color inside the band: %s', (_host, params) => {
    const insideBand = paint(params).filter((t) => t.minZ > MODEL_TOP_MM - BAND_MM);

    expect(insideBand.some((t) => t.hex === BAND)).toBe(true);
    expect(insideBand.some((t) => t.hex === TEXT)).toBe(true);
  });
});
