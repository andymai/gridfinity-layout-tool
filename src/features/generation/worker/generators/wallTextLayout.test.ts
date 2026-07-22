/**
 * Wall-text placement solver tests (issue #2695).
 *
 * Runs against real brepjs WASM because auto-fit measures glyphs through the
 * kernel's font engine — fonts must be loaded or every layout is skipped
 * (which is itself asserted, since that is the draft-kernel behavior).
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadFont, isErr } from 'brepjs';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import {
  computeHandleHoleGeometry,
  computeWallHandleSegments,
} from '@/shared/utils/handleCutoutClip';
import { getSlotFreeWalls, TOP_KEEP_OUT, BOTTOM_SOLID_SKIRT } from './wallPatterns';
import {
  computeWallTextLayouts,
  wallTextReadingSign,
  WALL_TEXT_MAX_EMBOSS,
  WALL_TEXT_ENGRAVE_FLOOR,
  type WallTextDims,
} from './wallTextLayout';

beforeAll(async () => {
  await initBrepjs();
  for (const [file, family] of [
    ['AtkinsonHyperlegible-Regular.ttf', 'atkinson'],
    ['AllertaStencil-Regular.ttf', 'allerta-stencil'],
  ] as const) {
    const buf = readFileSync(resolve(__dirname, `../assets/fonts/${file}`));
    const result = await loadFont(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      family
    );
    if (isErr(result)) throw new Error(`Font load failed: ${result.error.message}`);
  }
}, 30_000);

/** 2×2×4 bin-ish dims (values mirror deriveDimensions for the default pitch). */
const DIMS: WallTextDims = {
  innerW: 81.1,
  innerD: 81.1,
  wallHeight: 23.25,
  interiorHeight: 22.55,
  solid: false,
  isSlotted: false,
};

function makeParams(
  walls: NonNullable<BinParams['surfaceText']>['walls'],
  extra: Partial<BinParams> = {},
  surfaceExtra: Partial<NonNullable<BinParams['surfaceText']>> = {}
): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 4,
    ...extra,
    surfaceText: { walls, ...surfaceExtra },
  };
}

describe('computeWallTextLayouts', () => {
  it('centers text on an unobstructed wall', () => {
    const layouts = computeWallTextLayouts(makeParams({ front: 'Cables' }), DIMS);
    expect(layouts).toHaveLength(1);
    const l = layouts[0];
    expect(l.side).toBe('front');
    expect(l.centerU).toBeCloseTo(0, 5);
    const bandMid =
      (DEFAULT_BIN_PARAMS.wallThickness + BOTTOM_SOLID_SKIRT + (DIMS.wallHeight - TOP_KEEP_OUT)) /
      2;
    expect(l.centerZ).toBeCloseTo(bandMid, 5);
    expect(l.textW).toBeGreaterThan(0);
    expect(l.textH).toBeGreaterThan(0);
  });

  it('top/bottom alignment shifts the text within the band', () => {
    // Cap the size so the glyphs don't fill the whole band — full-band text
    // leaves alignment nothing to move (all three placements coincide).
    const style = { maxFontSize: 6 };
    const top = computeWallTextLayouts(
      makeParams({ front: 'Cables' }, {}, { wallAlign: 'top', style }),
      DIMS
    )[0];
    const bottom = computeWallTextLayouts(
      makeParams({ front: 'Cables' }, {}, { wallAlign: 'bottom', style }),
      DIMS
    )[0];
    const center = computeWallTextLayouts(makeParams({ front: 'Cables' }, {}, { style }), DIMS)[0];
    expect(top.centerZ).toBeGreaterThan(center.centerZ);
    expect(bottom.centerZ).toBeLessThan(center.centerZ);
    // Text stays inside the band in both cases.
    expect(top.centerZ + top.textH / 2).toBeLessThanOrEqual(DIMS.wallHeight - TOP_KEEP_OUT);
    expect(bottom.centerZ - bottom.textH / 2).toBeGreaterThanOrEqual(
      DEFAULT_BIN_PARAMS.wallThickness + BOTTOM_SOLID_SKIRT
    );
  });

  it('drops below a wall cutout on the same wall (auto-avoid)', () => {
    const params = makeParams(
      { front: 'Cables' },
      {
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          front: { ...DEFAULT_BIN_PARAMS.walls.front, enabled: true, width: 70, depth: 50 },
        },
      }
    );
    const layouts = computeWallTextLayouts(params, DIMS);
    expect(layouts).toHaveLength(1);
    // The U-notch occupies the top half of the wall; the fitted text bbox
    // must clear the cutout's bottom edge.
    const interiorWallHeight = DIMS.wallHeight - DEFAULT_BIN_PARAMS.wallThickness;
    const cutoutBottom = DIMS.wallHeight - interiorWallHeight * 0.5;
    expect(layouts[0].centerZ + layouts[0].textH / 2).toBeLessThan(cutoutBottom);
  });

  it('avoids handle holes (fitted bbox never overlaps the handle rect)', () => {
    const params = makeParams(
      { front: 'Cables' },
      {
        handles: {
          ...DEFAULT_BIN_PARAMS.handles,
          enabled: true,
          front: { ...DEFAULT_BIN_PARAMS.handles.front, enabled: true },
        },
      }
    );
    const layouts = computeWallTextLayouts(params, DIMS);
    expect(layouts).toHaveLength(1);
    const l = layouts[0];

    // Rebuild the handle AABB with the same shared helpers the solver uses.
    const sideHeight = params.handles.front.height ?? params.handles.height;
    const { centerZ, effectiveHeight } = computeHandleHoleGeometry(
      DIMS.wallHeight,
      sideHeight,
      params.handles.verticalPosition
    );
    const sideWidth = params.handles.front.width ?? params.handles.width;
    const segments = computeWallHandleSegments(
      DIMS.innerW,
      sideWidth,
      params.wallThickness,
      undefined
    );
    expect(segments).not.toBeNull();
    const textRect = {
      minU: l.centerU - l.textW / 2,
      maxU: l.centerU + l.textW / 2,
      minZ: l.centerZ - l.textH / 2,
      maxZ: l.centerZ + l.textH / 2,
    };
    for (const seg of segments ?? []) {
      const overlap =
        textRect.maxU > seg.offset - seg.width / 2 &&
        textRect.minU < seg.offset + seg.width / 2 &&
        textRect.maxZ > centerZ - effectiveHeight / 2 &&
        textRect.minZ < centerZ + effectiveHeight / 2;
      expect(overlap).toBe(false);
    }
  });

  it('skips slot-occupied walls on slotted bins but keeps free walls', () => {
    const params = makeParams(
      { front: 'A', back: 'B', left: 'C', right: 'D' },
      { style: 'slotted' }
    );
    const slotFree = getSlotFreeWalls(params);
    const layouts = computeWallTextLayouts(params, { ...DIMS, isSlotted: true });
    const laidOutSides = new Set(layouts.map((l) => l.side));
    for (const side of ['front', 'back', 'left', 'right'] as const) {
      expect(laidOutSides.has(side)).toBe(slotFree[side]);
    }
  });

  it('returns [] for polygon and solid bins', () => {
    const polygon = makeParams(
      { front: 'Cables' },
      { cellMask: { cols: 4, rows: 4, cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0] } }
    );
    expect(computeWallTextLayouts(polygon, DIMS)).toHaveLength(0);
    expect(
      computeWallTextLayouts(makeParams({ front: 'Cables' }), { ...DIMS, solid: true })
    ).toHaveLength(0);
  });

  it('clamps emboss relief and keeps an engrave floor', () => {
    const emboss = computeWallTextLayouts(
      makeParams({ front: 'Cables' }, {}, { style: { mode: 'emboss', depth: 5 } }),
      DIMS
    )[0];
    expect(emboss.depth).toBe(WALL_TEXT_MAX_EMBOSS);

    const engrave = computeWallTextLayouts(
      makeParams({ front: 'Cables' }, {}, { style: { mode: 'engrave', depth: 5 } }),
      DIMS
    )[0];
    expect(engrave.depth).toBeCloseTo(
      DEFAULT_BIN_PARAMS.wallThickness - WALL_TEXT_ENGRAVE_FLOOR,
      5
    );
  });

  it('reading sign flips for back and left walls', () => {
    expect(wallTextReadingSign('front')).toBe(1);
    expect(wallTextReadingSign('right')).toBe(1);
    expect(wallTextReadingSign('back')).toBe(-1);
    expect(wallTextReadingSign('left')).toBe(-1);
  });
});
