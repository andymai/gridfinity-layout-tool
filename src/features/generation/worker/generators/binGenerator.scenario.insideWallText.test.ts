/**
 * Inside-facing wall text.
 *
 * Positional claims a snapshot can't express: an inside caption must leave the
 * outer bbox alone whatever its mode, cut or stand on the inner face rather
 * than the outer one, and read the right way round from inside the bin.
 *
 *   pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario.insideWallText
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadTestFonts } from '@/test/loadTestFonts';
import { loadFont, isErr } from 'brepjs';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  assertWatertight,
  boundingBox,
  meshVolume,
} from './__kernel-tests__/meshAssertions';
import type { BoundingBox } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, SurfaceTextConfig } from '@/shared/types/bin';
import { FeatureTag } from './featureTags';
import type { MeshData } from '@/features/generation/bridge/types';

beforeAll(async () => {
  await initBrepjs();
  await loadTestFonts();
  for (const [file, family] of [
    ['AtkinsonHyperlegible-Regular.ttf', 'atkinson'],
    ['AllertaStencil-Regular.ttf', 'allerta-stencil'],
  ] as const) {
    const buf = readFileSync(resolve(__dirname, `../../../../shared/fonts/assets/${file}`));
    const result = await loadFont(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      family
    );
    if (isErr(result)) throw new Error(`Font load failed: ${result.error.message}`);
  }
}, 30_000);

function makeParams(surfaceText?: SurfaceTextConfig, extra: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 4,
    textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, font: 'atkinson' },
    ...extra,
    ...(surfaceText !== undefined ? { surfaceText } : {}),
  };
}

const backInside = (text: string, style: SurfaceTextConfig['style'] = {}): SurfaceTextConfig => ({
  walls: { back: text },
  wallFaces: { back: 'inside' },
  style,
});

/** Every vertex of a triangle carrying `tag`, as [x, y, z]. */
function taggedVertices(m: MeshData, tag: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const fg of m.faceGroups ?? []) {
    if (fg.tag !== tag) continue;
    for (let i = fg.start; i < fg.start + fg.count; i++) {
      const v = m.indices[i] * 3;
      out.push([m.vertices[v], m.vertices[v + 1], m.vertices[v + 2]]);
    }
  }
  return out;
}

const textVertices = (m: MeshData): [number, number, number][] =>
  taggedVertices(m, FeatureTag.TEXT);

const WALL = DEFAULT_BIN_PARAMS.wallThickness;

describe('inside wall text scenarios', () => {
  let generateBin: ReturnType<typeof getGenerateBin>;
  let plain: MeshData;
  let outer: BoundingBox;
  let innerBackY: number;

  beforeAll(() => {
    generateBin = getGenerateBin();
    plain = generateBin(makeParams());
    outer = boundingBox(plain.vertices);
    innerBackY = outer.maxY - WALL;
  });

  it.each(['engrave', 'emboss', 'through-cut'] as const)(
    '%s on the back wall keeps the outer bbox and works on the inner face',
    (mode) => {
      const result = generateBin(makeParams(backInside('ABC', { mode })));
      assertStructurallyValid(result, `inside ${mode}`);
      const box = boundingBox(result.vertices);
      for (const key of ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ'] as const) {
        expect(Math.abs(box[key] - outer[key]), key).toBeLessThan(0.01);
      }

      const ys = textVertices(result).map(([, y]) => y);
      expect(ys.length).toBeGreaterThan(0);
      if (mode === 'emboss') {
        expect(meshVolume(result)).toBeGreaterThan(meshVolume(plain));
        expect(Math.max(...ys)).toBeLessThan(innerBackY + 0.05);
        expect(Math.min(...ys)).toBeLessThan(innerBackY - 0.3);
      } else {
        expect(meshVolume(result)).toBeLessThan(meshVolume(plain));
        expect(Math.min(...ys)).toBeGreaterThan(innerBackY - 0.05);
        if (mode === 'engrave') expect(Math.max(...ys)).toBeLessThan(outer.maxY - 0.3);
      }
    }
  );

  // An L's top is its stem alone, so where the top sits says which way it reads.
  it('reads from inside the bin, mirrored against the same wall read from outside', () => {
    const stemSide = (surfaceText: SurfaceTextConfig): number => {
      const verts = textVertices(generateBin(makeParams(surfaceText)));
      const zs = verts.map(([, , z]) => z);
      const zTop = Math.max(...zs);
      const zSpan = zTop - Math.min(...zs);
      const meanX = (vs: typeof verts): number => vs.reduce((s, [x]) => s + x, 0) / vs.length;
      return meanX(verts.filter(([, , z]) => z > zTop - zSpan * 0.25)) - meanX(verts);
    };
    // Facing the back wall from inside, reading runs +X, so the stem is at -X.
    expect(stemSide(backInside('L'))).toBeLessThan(0);
    expect(stemSide({ walls: { back: 'L' } })).toBeGreaterThan(0);
  });

  it('stays in one compartment when dividers meet the wall', () => {
    const compartments = {
      ...DEFAULT_BIN_PARAMS.compartments,
      cols: 3,
      rows: 1,
      cells: [0, 1, 2],
    };
    const result = generateBin(
      makeParams({ ...backInside('AB'), insideStyle: { anchor: 'top-left' } }, { compartments })
    );
    assertStructurallyValid(result, 'inside text between dividers');
    const xs = textVertices(result).map(([x]) => x);
    expect(xs.length).toBeGreaterThan(0);
    const firstDivider = (outer.minX + outer.maxX) / 2 - (outer.maxX - outer.minX - 2 * WALL) / 6;
    expect(Math.max(...xs)).toBeLessThan(firstDivider);
  });

  it('goes under a label shelf on the same wall', () => {
    const label = { ...DEFAULT_BIN_PARAMS.label, enabled: true };
    const shelfOnly = generateBin(makeParams(undefined, { label }));
    const result = generateBin(makeParams(backInside('AB'), { label }));
    assertStructurallyValid(result, 'inside text + label shelf');
    expect(result.triangleCount).not.toBe(shelfOnly.triangleCount);
    const zs = textVertices(result).map(([, , z]) => z);
    expect(zs.length).toBeGreaterThan(0);
    const shelfZs = [FeatureTag.LABEL_TAB, FeatureTag.LABEL_SUPPORT].flatMap((tag) =>
      taggedVertices(shelfOnly, tag).map(([, , z]) => z)
    );
    expect(shelfZs.length).toBeGreaterThan(0);
    expect(Math.max(...zs)).toBeLessThan(Math.min(...shelfZs));
  });

  it('cuts nothing on a scooped wall', () => {
    const scoop = { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, side: 'back' as const };
    const scoopOnly = generateBin(makeParams(undefined, { scoop }));
    const result = generateBin(makeParams(backInside('AB'), { scoop }));
    expect(result.triangleCount).toBe(scoopOnly.triangleCount);
  });

  it('exports watertight', () => {
    const result = generateBin(makeParams(backInside('ABC')), undefined, true);
    assertWatertight(result, 'inside wall text export');
  });
});
