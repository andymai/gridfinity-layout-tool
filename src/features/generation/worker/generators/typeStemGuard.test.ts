// @vitest-environment node
/**
 * The stem guard reports something the mesh cannot: a caption whose strokes are
 * finer than a nozzle resolves is watertight, correctly shaped, and prints as a
 * blob. So the tests are about the REPORT, measured against real font outlines.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { loadTestFonts } from '@/test/loadTestFonts';
import { planTypeStem } from './typeStemGuard';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_TEXT_STYLE_DEFAULTS } from '@/shared/types/bin';
import type { BinParams } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
  await loadTestFonts();
}, 30_000);

const withWallText = (over: Partial<BinParams> = {}): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  width: 3,
  depth: 3,
  height: 6,
  surfaceText: { walls: { front: 'CABLES' } },
  ...over,
});

describe('planTypeStem', () => {
  it('says nothing about a design with no text at all', () => {
    expect(planTypeStem({ ...DEFAULT_BIN_PARAMS })).toBeUndefined();
  });

  it('scales the stem with the rendered size, so the panel can judge any nozzle', () => {
    const at = (fixedSize: number) =>
      planTypeStem(
        withWallText({
          textDefaults: {
            ...DEFAULT_TEXT_STYLE_DEFAULTS,
            sizeMode: 'fixed',
            fixedSize,
            minFontSize: fixedSize,
          },
        })
      );
    const small = at(2.5);
    const large = at(12);
    expect(small?.fontSizeMm).toBeCloseTo(2.5, 1);
    expect(large?.fontSizeMm).toBeCloseTo(12, 1);
    expect(small?.minStemMm).toBeLessThan(0.8);
    expect(large?.minStemMm).toBeGreaterThan(0.8);
  });

  it('measures a wider stem in the heavier cut, which is the offered fix', () => {
    const small = { sizeMode: 'fixed' as const, fixedSize: 3.2, minFontSize: 3.2 };
    const regular = planTypeStem(
      withWallText({ textDefaults: { ...DEFAULT_TEXT_STYLE_DEFAULTS, ...small } })
    );
    const bold = planTypeStem(
      withWallText({
        textDefaults: { ...DEFAULT_TEXT_STYLE_DEFAULTS, ...small, font: 'atkinson-bold' },
      })
    );
    // Same size, same caption, heavier face: the stem is what changed.
    expect(bold?.minStemMm ?? 0).toBeGreaterThan(regular?.minStemMm ?? Infinity);
  });
});
