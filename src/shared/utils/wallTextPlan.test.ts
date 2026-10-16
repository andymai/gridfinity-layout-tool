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
import { resolve } from 'node:path';
import { loadFont, getFont } from 'brepjs/text';
import { computeWallTextLayouts, wallTextReadingSign } from './wallTextPlan';
import type { WallTextDims } from './wallTextPlan';
import { createTypeMeasurer, type GlyphFont, type TypeMeasurer } from './typePlan';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_TEXT_STYLE_DEFAULTS } from '@/shared/types/bin';
import type { BinParams } from '@/shared/types/bin';

const FONT_DIR = resolve(import.meta.dirname, '..', 'fonts', 'assets');

let measurer: TypeMeasurer;

beforeAll(async () => {
  const buf = readFileSync(resolve(FONT_DIR, 'AtkinsonHyperlegible-Regular.ttf'));
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

  it('keeps flat text above a tapered flared band, where the face leaves the rim plane', () => {
    const BAND = 12;
    const tapered = (mode: 'flat' | 'engrave'): Partial<BinParams> => ({
      overhang: {
        left: 0,
        right: 0,
        front: 3,
        back: 0,
        feet: false,
        taper: {
          enabled: true,
          profile: 'chamfer',
          bandHeight: BAND,
          left: 0,
          right: 0,
          front: 3,
          back: 0,
        },
      },
      surfaceText: { walls: { front: 'CABLES' }, style: { mode, anchor: 'bottom' } },
    });
    const inkBottom = (l: { centerZ: number; textH: number }): number => l.centerZ - l.textH / 2;

    const [flat] = computeWallTextLayouts(params(tapered('flat')), DIMS, measurer);
    expect(inkBottom(flat)).toBeGreaterThanOrEqual(BAND);
    const [engraved] = computeWallTextLayouts(params(tapered('engrave')), DIMS, measurer);
    expect(inkBottom(engraved)).toBeLessThan(BAND);
  });
});

describe('inside-facing wall text', () => {
  const inside = (
    over: Partial<NonNullable<BinParams['surfaceText']>> = {},
    extra: Partial<BinParams> = {}
  ): BinParams =>
    params({
      surfaceText: {
        walls: { back: 'CABLES' },
        wallFaces: { back: 'inside' },
        ...over,
      },
      ...extra,
    });

  it('reads from inside, so its reading direction is the outside one reversed', () => {
    for (const side of ['front', 'back', 'left', 'right'] as const) {
      expect(wallTextReadingSign(side, 'inside')).toBe(-wallTextReadingSign(side));
    }
  });

  it('places a left-anchored caption on the reader-left end of the wall', () => {
    const at = (face: 'inside' | 'outside'): number => {
      const [layout] = computeWallTextLayouts(
        params({
          surfaceText: {
            walls: { back: 'CABLES' },
            ...(face === 'inside' ? { wallFaces: { back: 'inside' as const } } : {}),
            style: { anchor: 'center' },
            insideStyle: { anchor: 'left' },
            wallStyles: { back: { anchor: 'left' } },
          },
        }),
        DIMS,
        measurer
      );
      expect(layout.face).toBe(face);
      return layout.centerU;
    };
    // Facing the back wall from inside, its left end is at -X; from outside, +X.
    expect(at('inside')).toBeLessThan(0);
    expect(at('outside')).toBeGreaterThan(0);
  });

  it('stays between the floor and the lip support', () => {
    const [layout] = computeWallTextLayouts(
      inside({ insideStyle: { anchor: 'top' } }),
      DIMS,
      measurer
    );
    expect(layout.centerZ + layout.textH / 2).toBeLessThanOrEqual(DIMS.wallHeight - 2.6);
    const [low] = computeWallTextLayouts(
      inside({ insideStyle: { anchor: 'bottom' } }),
      DIMS,
      measurer
    );
    expect(low.centerZ - low.textH / 2).toBeGreaterThan(2);
  });

  it('takes the reader-left stretch between dividers for a left anchor', () => {
    const compartments = {
      ...DEFAULT_BIN_PARAMS.compartments,
      cols: 3,
      rows: 1,
      cells: [0, 1, 2],
    };
    const firstDivider = -DIMS.innerW / 2 + DIMS.innerW / 3;
    const lastDivider = DIMS.innerW / 2 - DIMS.innerW / 3;
    const [left] = computeWallTextLayouts(
      inside({ walls: { back: 'AB' }, insideStyle: { anchor: 'top-left' } }, { compartments }),
      DIMS,
      measurer
    );
    expect(left.centerU + left.textW / 2).toBeLessThan(firstDivider);
    const [right] = computeWallTextLayouts(
      inside({ walls: { back: 'AB' }, insideStyle: { anchor: 'top-right' } }, { compartments }),
      DIMS,
      measurer
    );
    expect(right.centerU - right.textW / 2).toBeGreaterThan(lastDivider);
  });

  it('skips a scooped wall and a solid bin, which have no face to cut', () => {
    const scoop = { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, side: 'back' as const };
    expect(computeWallTextLayouts(inside({}, { scoop }), DIMS, measurer)).toEqual([]);
    expect(computeWallTextLayouts(inside(), { ...DIMS, solid: true }, measurer)).toEqual([]);
  });

  it('uses the inside style only for walls that face inside', () => {
    const layouts = computeWallTextLayouts(
      params({
        surfaceText: {
          walls: { front: 'CABLES', back: 'CABLES' },
          wallFaces: { back: 'inside' },
          insideStyle: { mode: 'emboss' },
        },
      }),
      DIMS,
      measurer
    );
    const bySide = Object.fromEntries(layouts.map((l) => [l.side, l]));
    expect(bySide.back.mode).toBe('emboss');
    expect(bySide.front.mode).not.toBe('emboss');
  });
});
