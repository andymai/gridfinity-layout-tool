// @vitest-environment node
/**
 * A caption on a split pocket's floor follows the floor: where it crosses the
 * line, each side's glyphs sit on that side's floor rather than buried under
 * the shallow one or hanging over the deep one.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadTestFonts } from '@/test/loadTestFonts';
import { loadFont, isErr } from 'brepjs';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import { FeatureTag } from './featureTags';

beforeAll(async () => {
  await initBrepjs();
  await loadTestFonts();
  const buffer = readFileSync(
    resolve(__dirname, '../../../../shared/fonts/assets/AtkinsonHyperlegible-Regular.ttf')
  );
  const result = await loadFont(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    'atkinson'
  );
  if (isErr(result)) throw new Error(`Font load failed: ${result.error.message}`);
}, 60000);

const DEEP = 8;
const SHALLOW = 3;

function splitBin(label: string, mode: BinParams['textDefaults']['mode'], deep = DEEP): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 1,
    depth: 1,
    height: 3,
    textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, mode },
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
    cutoutConfig: { topOffset: 0 },
    cutouts: [
      {
        id: 'c1',
        shape: 'rectangle',
        x: 10,
        y: 10,
        width: 20,
        depth: 20,
        cutDepth: deep,
        rotation: 0,
        cornerRadius: 0,
        label,
        engraveLabel: true,
        textAnchor: 'center',
        groupId: null,
        split: { a: { x: 0, y: -10 }, b: { x: 0, y: 10 }, cutDepth: SHALLOW },
      },
    ],
  };
}

type Mesh = ReturnType<ReturnType<typeof getGenerateBin>>;

/** Text vertices off the line, as [x, z], with the line's x in the mesh frame. */
function textVertices(mesh: Mesh, params: BinParams): { line: number; points: [number, number][] } {
  const bb = boundingBox(mesh.vertices);
  const innerW = bb.maxX - bb.minX - 2 * params.wallThickness;
  const line = -innerW / 2 + 20;
  const points: [number, number][] = [];
  for (const fg of mesh.faceGroups ?? []) {
    if (fg.tag !== FeatureTag.TEXT) continue;
    for (let i = fg.start; i < fg.start + fg.count; i++) {
      const v = mesh.indices[i] * 3;
      const x = mesh.vertices[v];
      if (Math.abs(x - line) > 0.05) points.push([x, mesh.vertices[v + 2]]);
    }
  }
  return { line, points };
}

describe('a caption across a split pocket', () => {
  // A flat caption's prism stands 0.2 mm proud of the floor inside the cavity
  // tool, and an engraving's tool starts a hair above it.
  it.each([
    ['flat', 0, 0.25],
    ['engrave', DEFAULT_BIN_PARAMS.textDefaults.depth, 0.05],
  ] as const)(
    'lays %s glyphs on the floor of the side they sit on',
    (mode, below, above) => {
      const generateBin = getGenerateBin();
      const params = splitBin('HIHIHI', mode);
      const mesh = generateBin(params);
      const top = boundingBox(mesh.vertices).maxZ;
      const { line, points } = textVertices(mesh, params);
      const sides = { a: 0, b: 0 };
      for (const [x, z] of points) {
        const floor = top - (x < line ? DEEP : SHALLOW);
        sides[x < line ? 'a' : 'b']++;
        expect(z).toBeGreaterThanOrEqual(floor - below - 1e-3);
        expect(z).toBeLessThanOrEqual(floor + above + 1e-3);
      }
      expect(sides.a).toBeGreaterThan(0);
      expect(sides.b).toBeGreaterThan(0);
    },
    180000
  );

  // Side A cuts the whole fill, so it has no floor for flat text; the glyphs
  // over side B's floor still print.
  it('keeps the glyphs over a floor when the other side has none', () => {
    const generateBin = getGenerateBin();
    const params = splitBin('HIHIHI', 'flat', 100);
    const mesh = generateBin(params);
    const top = boundingBox(mesh.vertices).maxZ;
    const { line, points } = textVertices(mesh, params);
    expect(points.length).toBeGreaterThan(0);
    for (const [x, z] of points) {
      expect(x).toBeGreaterThan(line);
      expect(z).toBeGreaterThanOrEqual(top - SHALLOW - 1e-3);
      expect(z).toBeLessThanOrEqual(top - SHALLOW + 0.25);
    }
  }, 180000);
});
