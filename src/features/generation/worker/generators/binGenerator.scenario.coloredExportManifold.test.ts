// @vitest-environment node
/**
 * A colored 3MF must stay as closed as the single-color one. The lip seam
 * split re-tessellates the mesh after the kernel, so a cut that leaves a
 * T-junction or two unwelded copies of one vertex opens edges that only the
 * colored file has. Slicers report those files as invalid. The check reads the
 * written 3MF itself, after the exporter's vertex weld.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { loadTestFonts } from '@/test/loadTestFonts';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { makeUniformLipCells } from '@/features/bin-designer/types/featureColors';
import type { LipAxisCount } from '@/features/bin-designer/types/featureColors';
import { buildSinglePiece3MF } from '@/features/bin-designer/utils/binDownloadHelpers';
import type { BinParams } from '@/shared/types/bin';
import { buildSTLBufferFromIndexed } from '@/shared/generation/export';

beforeAll(async () => {
  await initBrepjs();
  await loadTestFonts();
}, 60_000);

async function edgeStats(blob: Blob): Promise<{ open: number; nonManifold: number }> {
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const xml = strFromU8(files['3D/3dmodel.model']);
  const uses = new Map<string, number>();
  for (const m of xml.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g)) {
    const v = [Number(m[1]), Number(m[2]), Number(m[3])];
    for (let e = 0; e < 3; e++) {
      const a = v[e];
      const b = v[(e + 1) % 3];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      uses.set(key, (uses.get(key) ?? 0) + 1);
    }
  }
  let open = 0;
  let nonManifold = 0;
  for (const n of uses.values()) {
    if (n === 1) open++;
    else if (n > 2) nonManifold++;
  }
  return { open, nonManifold };
}

function coloredParams(corners: LipAxisCount, bands: LipAxisCount, accent: boolean): BinParams {
  const palette = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'];
  const cells = Object.fromEntries(
    Object.keys(makeUniformLipCells('#000000')).map((id, i) => [id, palette[i % palette.length]])
  );
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 4,
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    compartments: {
      ...DEFAULT_BIN_PARAMS.compartments,
      compartmentTexts: ['SCREWS'],
    },
    featureColors: {
      ...DEFAULT_BIN_PARAMS.featureColors,
      enabled: true,
      labelTab: '#222222',
      text: '#111111',
      lip: { corners, bands, cells },
      topAccent: { enabled: accent, heightMm: 3, color: '#123456' },
    },
  };
}

describe('colored 3MF export stays closed', () => {
  it.each([
    { corners: 2, bands: 2, accent: false },
    { corners: 4, bands: 4, accent: true },
  ] as const)(
    'lip grid $corners x $bands (accent: $accent) has no open or non-manifold edges',
    async ({ corners, bands, accent }) => {
      const params = coloredParams(corners, bands, accent);
      const mesh = getGenerateBin()(params, undefined, true);
      const stl = buildSTLBufferFromIndexed(mesh.vertices, mesh.normals, mesh.indices);
      const faceGroups = mesh.faceGroups ?? [];

      const plain = await edgeStats(buildSinglePiece3MF(stl, faceGroups, params, 'x', {}, false));
      expect(plain).toEqual({ open: 0, nonManifold: 0 });

      const colored = buildSinglePiece3MF(stl, faceGroups, params, 'x', {}, true);
      const model = strFromU8(
        unzipSync(new Uint8Array(await colored.arrayBuffer()))['3D/3dmodel.model']
      );
      expect(model).toContain('paint_color=');
      expect(await edgeStats(colored)).toEqual({ open: 0, nonManifold: 0 });
    }
  );
});
