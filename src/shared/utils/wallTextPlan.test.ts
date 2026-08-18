// @vitest-environment node
/**
 * Parity between the solver's two entry points.
 *
 * The worker builds glyph solids from this plan and the designer's ghost
 * overlay draws the same plan on screen. They reach it through different
 * measurers (the worker's kernel font registry, the main thread's own), so the
 * thing worth pinning is that the SOLVER is one implementation and neither side
 * re-derives any of it. A preview that disagrees with a print is exactly what
 * moving this module out of the worker was meant to make impossible.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadFont, getFont } from 'brepjs/text';
import { computeWallTextLayouts } from './wallTextPlan';
import type { WallTextDims } from './wallTextPlan';
import { createTypeMeasurer, type GlyphFont, type TypeMeasurer } from './typePlan';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_TEXT_STYLE_DEFAULTS } from '@/shared/types/bin';
import type { BinParams } from '@/shared/types/bin';

let measurer: TypeMeasurer;

beforeAll(async () => {
  const buf = readFileSync('src/shared/fonts/assets/AtkinsonHyperlegible-Regular.ttf');
  await loadFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), 'atkinson');
  measurer = createTypeMeasurer((f) => getFont(f) as GlyphFont | undefined);
});

const DIMS: WallTextDims = {
  innerW: 81.1,
  innerD: 81.1,
  wallHeight: 23.25,
  interiorHeight: 22.55,
  solid: false,
  isSlotted: false,
};

const params = (over: Partial<BinParams> = {}): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  textDefaults: { ...DEFAULT_TEXT_STYLE_DEFAULTS, font: 'atkinson' },
  width: 2,
  depth: 2,
  height: 4,
  surfaceText: { walls: { front: 'CABLES' } },
  ...over,
});

describe('computeWallTextLayouts', () => {
  it('is deterministic, so two callers of the same solver agree exactly', () => {
    const a = computeWallTextLayouts(params(), DIMS, measurer);
    const b = computeWallTextLayouts(params(), DIMS, measurer);
    expect(a).toEqual(b);
  });

  it('carries the plan itself, not a summary a consumer would have to re-derive', () => {
    const [layout] = computeWallTextLayouts(params(), DIMS, measurer);
    expect(layout.plan.lines.length).toBeGreaterThan(0);
    // The ink box the pattern clip uses is derived FROM the plan, so the two
    // cannot describe different rectangles.
    expect(layout.textW).toBeCloseTo(layout.plan.maxX - layout.plan.minX, 6);
    expect(layout.textH).toBeCloseTo(layout.plan.maxY - layout.plan.minY, 6);
  });

  it('returns nothing when the face has not registered, rather than guessing', () => {
    const blind = createTypeMeasurer(() => undefined);
    expect(computeWallTextLayouts(params(), DIMS, blind)).toEqual([]);
  });

  it('applies a per-wall style over the shared one', () => {
    const [layout] = computeWallTextLayouts(
      params({
        surfaceText: {
          walls: { front: 'CABLES' },
          style: { mode: 'engrave' },
          wallStyles: { front: { mode: 'emboss' } },
        },
      }),
      DIMS,
      measurer
    );
    expect(layout.mode).toBe('emboss');
  });
});
