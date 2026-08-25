// @vitest-environment node
/**
 * A repeat's per-copy labels must each reach the final mesh.
 *
 * The engraver used to walk `params.cutouts`, so a repeat produced ONE caption
 * beside the master no matter how many holes it cut. Tool-level tests cannot
 * prove what survives the boolean stage, so this asserts at mesh level: three
 * differently-labelled copies engrave more glyph geometry than one shared
 * caption does, and a repeat with no list still engraves exactly once.
 *
 * That last case is the compatibility guarantee. Every design stored before the
 * list existed has to keep printing the part it printed.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadTestFonts } from '@/test/loadTestFonts';
import { loadFont, isErr } from 'brepjs';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, CutoutArrayConfig } from '@/shared/types/bin';
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

/** Three holes in a row, wide enough apart to label without collisions. */
const ROW: CutoutArrayConfig = {
  mode: 'grid',
  cols: 3,
  rows: 1,
  pitchX: 26,
  pitchY: 26,
  count: 3,
  radius: 20,
  startAngle: 0,
  rotateToCenter: false,
};

function binWithRepeat(labels?: string[]): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 1,
    height: 3,
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
    cutoutConfig: { topOffset: 0 },
    cutouts: [
      {
        id: 'c1',
        shape: 'circle',
        x: 8,
        y: 14,
        width: 12,
        depth: 12,
        cutDepth: 4,
        rotation: 0,
        cornerRadius: 0,
        label: 'AAA',
        engraveLabel: true,
        textAnchor: 'top',
        groupId: null,
        array: labels === undefined ? ROW : { ...ROW, labels },
      },
    ],
  };
}

describe('per-copy repeat labels', () => {
  it('engraves one caption per copy once a list exists, and only one without', () => {
    const generateBin = getGenerateBin();

    const bare = generateBin({ ...binWithRepeat(), cutouts: [] });
    const noList = generateBin(binWithRepeat());
    const listed = generateBin(binWithRepeat(['AAA', 'AAA', 'AAA']));

    // Every variant must actually build.
    for (const mesh of [bare, noList, listed]) {
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(mesh.vertices.some((v) => !Number.isFinite(v))).toBe(false);
    }

    // Three copies of the same caption carry appreciably more glyph geometry
    // than the single caption the same repeat engraves without a list. Compared
    // against each other rather than to an absolute count, so the assertion
    // does not encode font metrics.
    const oneCaption = noList.triangleCount;
    const threeCaptions = listed.triangleCount;
    expect(threeCaptions).toBeGreaterThan(oneCaption);

    // ...and by roughly the two extra captions' worth, not a rounding wobble.
    // An all-blank list is the zero-caption baseline: blanks written INSIDE the
    // list leave their holes bare.
    const noCaptions = generateBin(binWithRepeat(['', '', ''])).triangleCount;
    const perCaption = oneCaption - noCaptions;
    expect(perCaption).toBeGreaterThan(0);
    expect(threeCaptions - oneCaption).toBeGreaterThan(perCaption);
  }, 240000);

  it("falls back to the master's label past the end of a short list", () => {
    const generateBin = getGenerateBin();
    // One blank entry, two copies past the list's end. The blank is honoured
    // and the two beyond it inherit 'AAA', so this must land between a fully
    // blank repeat and a fully captioned one rather than on either.
    const short = generateBin(binWithRepeat([''])).triangleCount;
    const none = generateBin(binWithRepeat(['', '', ''])).triangleCount;
    const all = generateBin(binWithRepeat(['AAA', 'AAA', 'AAA'])).triangleCount;
    expect(short).toBeGreaterThan(none);
    expect(short).toBeLessThan(all);
  }, 240000);

  it('gives each copy its own word', () => {
    const generateBin = getGenerateBin();
    // Distinct glyph counts per copy: a build that captioned every copy with
    // the master's label would be identical for both of these.
    const wide = generateBin(binWithRepeat(['AAA', 'AAA', 'AAA']));
    const narrow = generateBin(binWithRepeat(['AAA', 'I', 'I']));
    expect(narrow.triangleCount).toBeLessThan(wide.triangleCount);
    expect(narrow.vertices.some((v) => !Number.isFinite(v))).toBe(false);
  }, 240000);
});
