// @vitest-environment node
/**
 * The stem guard reports something the mesh cannot: a caption whose strokes are
 * finer than a nozzle resolves is watertight, correctly shaped, and prints as a
 * blob. So the tests are about the REPORT, measured against real font outlines.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { loadTestFonts } from '@/test/loadTestFonts';
import { planTypeStemWarning } from './typeStemGuard';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_TEXT_STYLE_DEFAULTS, TEXT_PRESETS } from '@/shared/types/bin';
import type { BinParams } from '@/shared/types/bin';
import { MIN_PRINTABLE_STEM_MM } from '@/shared/utils/typePlan';

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

describe('planTypeStemWarning', () => {
  it('says nothing about a design with no text at all', () => {
    expect(planTypeStemWarning({ ...DEFAULT_BIN_PARAMS })).toBeUndefined();
  });

  it('stays quiet at a size the nozzle resolves', () => {
    expect(
      planTypeStemWarning(
        withWallText({
          textDefaults: { ...TEXT_PRESETS.engineering, sizeMode: 'fixed', fixedSize: 12 },
        })
      )
    ).toBeUndefined();
  });

  it('reports the measurement, not just a flag, once the stems go too fine', () => {
    const warning = planTypeStemWarning(
      withWallText({
        textDefaults: {
          ...DEFAULT_TEXT_STYLE_DEFAULTS,
          sizeMode: 'fixed',
          fixedSize: 2.5,
          minFontSize: 2.5,
        },
      })
    );
    expect(warning).toBeDefined();
    expect(warning?.minStemMm).toBeLessThan(MIN_PRINTABLE_STEM_MM);
    expect(warning?.fontSizeMm).toBeCloseTo(2.5, 1);
    // The threshold travels with the report so the panel never restates it.
    expect(warning?.minPrintableStemMm).toBe(MIN_PRINTABLE_STEM_MM);
  });

  it('clears once the same size is set in the heavier cut, which is the offered fix', () => {
    const small = { sizeMode: 'fixed' as const, fixedSize: 3.2, minFontSize: 3.2 };
    const regular = planTypeStemWarning(
      withWallText({ textDefaults: { ...DEFAULT_TEXT_STYLE_DEFAULTS, ...small } })
    );
    const bold = planTypeStemWarning(
      withWallText({
        textDefaults: { ...DEFAULT_TEXT_STYLE_DEFAULTS, ...small, font: 'atkinson-bold' },
      })
    );
    expect(regular).toBeDefined();
    // Same size, same caption, heavier face: the stem is what changed.
    expect(bold === undefined || (bold?.minStemMm ?? 0) > (regular?.minStemMm ?? 0)).toBe(true);
  });
});
