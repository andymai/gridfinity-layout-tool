// @vitest-environment node
/**
 * An explicit per-cutout label size is a target, not a ceiling.
 *
 * Auto-fit caps a labelled repeat's captions to the pitch so neighbours meet
 * instead of printing over each other; an explicit `sizeMode: 'fixed'` on the
 * cutout has to beat that cap and the anchor band, shrinking only when the bin
 * interior itself runs out. Tool-level tests cannot prove what survives the
 * boolean stage, so this measures at mesh level: with embossed text and no
 * stacking lip, every vertex above the fill top belongs to a glyph, and the
 * glyph Y-extent is the rendered text height.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadTestFonts } from '@/test/loadTestFonts';
import { loadFont, isErr } from 'brepjs';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, TextStyleOverride } from '@/shared/types/bin';
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

/** Three holes at a tight pitch — the case auto-fit caps captions hard. */
function binWithLabelledRow(label: string, textStyle?: TextStyleOverride): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 3,
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
    textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, mode: 'emboss' },
    cutoutConfig: { topOffset: 0 },
    cutouts: [
      {
        id: 'c1',
        shape: 'circle',
        x: 8,
        y: 8,
        width: 12,
        depth: 12,
        cutDepth: 4,
        rotation: 0,
        cornerRadius: 0,
        label,
        engraveLabel: label !== '',
        textAnchor: 'top',
        groupId: null,
        textStyle,
        array: {
          mode: 'grid',
          cols: 3,
          rows: 1,
          pitchX: 14,
          pitchY: 14,
          count: 3,
          radius: 20,
          startAngle: 0,
          rotateToCenter: false,
          labels: label === '' ? undefined : [label, label, label],
        },
      },
    ],
  };
}

/** Y-extent of every vertex above `topZ` — the rendered glyph height. */
function glyphYSpan(vertices: Float32Array | number[], topZ: number): number {
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 2; i < vertices.length; i += 3) {
    if (vertices[i] > topZ + 0.05) {
      const y = vertices[i - 1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxY > minY ? maxY - minY : 0;
}

describe('explicit cutout label size', () => {
  it('renders past the pitch cap at the asked-for size, auto stays capped', () => {
    const generateBin = getGenerateBin();

    const bare = generateBin(binWithLabelledRow(''));
    const topZ = (() => {
      let max = -Infinity;
      for (let i = 2; i < bare.vertices.length; i += 3) {
        if (bare.vertices[i] > max) max = bare.vertices[i];
      }
      return max;
    })();

    const auto = generateBin(binWithLabelledRow('II'));
    const exact = generateBin(binWithLabelledRow('II', { sizeMode: 'fixed', fixedSize: 18 }));

    for (const mesh of [bare, auto, exact]) {
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(mesh.vertices.some((v) => !Number.isFinite(v))).toBe(false);
    }

    const autoSpan = glyphYSpan(auto.vertices, topZ);
    const exactSpan = glyphYSpan(exact.vertices, topZ);

    // Auto-fit is pitch-capped: the caption cannot exceed the 14mm the copy
    // owns, minus margins. The glyph extent is the cap-height fraction of
    // that, so anything approaching the pitch means the cap failed.
    expect(autoSpan).toBeGreaterThan(0);
    expect(autoSpan).toBeLessThan(14);

    // The explicit 18mm ignores the pitch cap and the anchor band, so its
    // glyphs measure well past both the auto size and the pitch itself.
    expect(exactSpan).toBeGreaterThan(autoSpan * 1.5);
    expect(exactSpan).toBeGreaterThan(14 * 0.7);
  }, 240000);
});
