// @vitest-environment node
/**
 * A text element is caption only: its label engraves or embosses on the host
 * at the element's own footprint, and nothing is cut for the element itself.
 *
 * Asserted at mesh level with embossed text and no stacking lip, so every
 * vertex above the fill top belongs to a glyph: the glyph block sizes to the
 * explicit style, turns with the element's rotation, and an empty caption
 * leaves the bin byte-identical to one with no element at all — the proof no
 * cavity is cut. The lid case runs the same element through `generateLid`.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadTestFonts } from '@/test/loadTestFonts';
import { loadFont, isErr } from 'brepjs';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';

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

function textElement(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 't1',
    shape: 'text',
    x: 40,
    y: 30,
    width: 18,
    depth: 12,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: 'III',
    groupId: null,
    engraveLabel: true,
    textAnchor: 'center',
    textStyle: { sizeMode: 'fixed', fixedSize: 10 },
    ...overrides,
  };
}

function solidBinWith(cutouts: Cutout[]): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 3,
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
    textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, mode: 'emboss' },
    cutoutConfig: { topOffset: 0 },
    cutouts,
  };
}

function topZOf(vertices: ArrayLike<number>): number {
  let max = -Infinity;
  for (let i = 2; i < vertices.length; i += 3) {
    if (vertices[i] > max) max = vertices[i];
  }
  return max;
}

/** XY extents of every vertex above `topZ` — the rendered glyph block. */
function glyphSpans(
  vertices: ArrayLike<number>,
  topZ: number
): { readonly x: number; readonly y: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 2; i < vertices.length; i += 3) {
    if (vertices[i] > topZ + 0.05) {
      const x = vertices[i - 2];
      const y = vertices[i - 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { x: maxX > minX ? maxX - minX : 0, y: maxY > minY ? maxY - minY : 0 };
}

describe('text element on the bin top', () => {
  it('embosses the caption at the explicit size and cuts no cavity', () => {
    const generateBin = getGenerateBin();

    const bare = generateBin(solidBinWith([]));
    const blank = generateBin(solidBinWith([textElement({ label: '', engraveLabel: false })]));
    const withText = generateBin(solidBinWith([textElement()]));

    for (const mesh of [bare, blank, withText]) {
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(mesh.vertices.some((v) => !Number.isFinite(v))).toBe(false);
    }

    // No cavity: an element with nothing to say changes nothing — the whole
    // tessellation comes out identical, not merely the same size.
    expect(blank.triangleCount).toBe(bare.triangleCount);
    expect(blank.vertices).toEqual(bare.vertices);

    // Glyphs stand above the fill top, sized by the explicit 10mm style: the
    // cap height lands well above half the size and at or below the size.
    const topZ = topZOf(bare.vertices);
    const spans = glyphSpans(withText.vertices, topZ);
    expect(spans.y).toBeGreaterThan(5);
    expect(spans.y).toBeLessThan(11);
    expect(spans.x).toBeGreaterThan(0);
  }, 240000);

  it('ignores stray anchor and offset fields — the caption stays centered', () => {
    const generateBin = getGenerateBin();

    const clean = generateBin(solidBinWith([textElement()]));
    const stray = generateBin(
      solidBinWith([
        textElement({ textAnchor: 'top', textOffset: { x: 15, y: 9 }, textSide: 'left' }),
      ])
    );

    // The editor offers neither control for a text element, so a hand-authored
    // file carrying them must engrave exactly what a clean one does.
    expect(stray.triangleCount).toBe(clean.triangleCount);
    expect(stray.vertices).toEqual(clean.vertices);
  }, 240000);

  it('turns the glyphs with the element rotation', () => {
    const generateBin = getGenerateBin();

    const flat = generateBin(solidBinWith([textElement()]));
    const turned = generateBin(solidBinWith([textElement({ rotation: 90 })]));

    const topZ = topZOf(generateBin(solidBinWith([])).vertices);
    const flatSpans = glyphSpans(flat.vertices, topZ);
    const turnedSpans = glyphSpans(turned.vertices, topZ);

    // A 90° turn swaps the block's extents (within tessellation noise).
    expect(turnedSpans.x).toBeCloseTo(flatSpans.y, 0);
    expect(turnedSpans.y).toBeCloseTo(flatSpans.x, 0);
  }, 240000);
});

describe('text element on a lid', () => {
  it('reaches the lid mesh through the lid cutout pipeline', async () => {
    const { generateLid } = await import('./lidOrchestrator');

    const base: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 3,
      textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, mode: 'emboss' },
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
    };
    const withText: BinParams = {
      ...base,
      lid: { ...base.lid, cutouts: [textElement({ x: 20, y: 20 })] },
    };

    const plain = generateLid(base);
    const texted = generateLid(withText);
    if (!plain || !texted) throw new Error('expected both lids to generate');

    // The caption adds glyph geometry; nothing else about the lid changed.
    expect(texted.triangleCount).toBeGreaterThan(plain.triangleCount);
    expect(texted.vertices.some((v) => !Number.isFinite(v))).toBe(false);
  }, 240000);
});
