// @vitest-environment node
/**
 * A center-anchored cutout label must survive into the final mesh.
 *
 * The label used to engrave at the un-recessed fill top, so its shallow cut sat
 * entirely inside the volume the cavity removes — the boolean stage subtracted
 * both and the text vanished from the model and every export. Tool-level tests
 * can't prove the end result, so this asserts at mesh level: the labeled bin
 * gains glyph geometry in the engrave band just below the recess floor.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadTestFonts } from '@/test/loadTestFonts';
import { loadFont, isErr } from 'brepjs';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, CutoutTextAnchor } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { meshVolume } from './__kernel-tests__/meshAssertions';
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

const CUT_DEPTH = 5;

function solidBinWithRecessedLabel(
  label: string,
  anchor: CutoutTextAnchor = 'center',
  mode: BinParams['textDefaults']['mode'] = DEFAULT_BIN_PARAMS.textDefaults.mode
): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: anchor === 'center' ? 1 : 2,
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
        cutDepth: CUT_DEPTH,
        rotation: 0,
        cornerRadius: 0,
        label,
        engraveLabel: true,
        textAnchor: anchor,
        groupId: null,
      },
    ],
  };
}

function verticesInBand(vertices: Float32Array, lo: number, hi: number): number {
  let count = 0;
  for (let i = 2; i < vertices.length; i += 3) {
    if (vertices[i] > lo && vertices[i] < hi) count++;
  }
  return count;
}

describe('recessed cutout label (#2726)', () => {
  it('engraves the center-anchored label into the recess floor of the final mesh', () => {
    const generateBin = getGenerateBin();
    const labeled = generateBin(solidBinWithRecessedLabel('HI'));
    const plain = generateBin(solidBinWithRecessedLabel(''));

    expect(labeled.triangleCount).toBeGreaterThan(plain.triangleCount + 50);

    // The engraving's bottom faces sit `textDefaults.depth` below the recess
    // floor — a z-slab the unlabeled bin has no geometry in (its first surface
    // below the floor is the socket region much further down). Glyph wall
    // vertices land exactly at floor and floor − depth, so the band includes
    // the engrave bottom but stays clear of the floor plane itself.
    let topZ = -Infinity;
    for (let i = 2; i < plain.vertices.length; i += 3) {
      if (plain.vertices[i] > topZ) topZ = plain.vertices[i];
    }
    const floorZ = topZ - CUT_DEPTH;
    const engraveDepth = DEFAULT_BIN_PARAMS.textDefaults.depth;
    const lo = floorZ - engraveDepth - 0.1;
    const hi = floorZ - 0.05;
    expect(verticesInBand(plain.vertices, lo, hi)).toBe(0);
    expect(verticesInBand(labeled.vertices, lo, hi)).toBeGreaterThan(0);
  }, 180000);
});

function topZOf(vertices: Float32Array): number {
  let topZ = -Infinity;
  for (let i = 2; i < vertices.length; i += 3) topZ = Math.max(topZ, vertices[i]);
  return topZ;
}

describe('flat cutout labels', () => {
  it('lays a label beside the cutout flat in the fill top', () => {
    const generateBin = getGenerateBin();
    const labeled = generateBin(solidBinWithRecessedLabel('HI', 'right', 'flat'));
    const plain = generateBin(solidBinWithRecessedLabel('', 'right', 'flat'));
    const topZ = topZOf(plain.vertices);

    let textVerts = 0;
    for (const fg of labeled.faceGroups ?? []) {
      if (fg.tag !== FeatureTag.TEXT) continue;
      for (let i = fg.start; i < fg.start + fg.count; i++) {
        expect(labeled.vertices[labeled.indices[i] * 3 + 2]).toBeCloseTo(topZ, 3);
        textVerts++;
      }
    }
    expect(textVerts).toBeGreaterThan(0);
    expect(meshVolume(labeled)).toBeCloseTo(meshVolume(plain), 1);
  }, 180000);

  it('engraves a flat label that sits on the recess floor', () => {
    const generateBin = getGenerateBin();
    const labeled = generateBin(solidBinWithRecessedLabel('HI', 'center', 'flat'));
    const plain = generateBin(solidBinWithRecessedLabel('', 'center', 'flat'));
    const floorZ = topZOf(plain.vertices) - CUT_DEPTH;
    const engraveDepth = DEFAULT_BIN_PARAMS.textDefaults.depth;
    expect(
      verticesInBand(labeled.vertices, floorZ - engraveDepth - 0.1, floorZ - 0.05)
    ).toBeGreaterThan(0);
  }, 180000);
});
