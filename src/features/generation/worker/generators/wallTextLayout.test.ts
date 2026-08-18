/**
 * Wall-text placement solver tests.
 *
 * Runs against real brepjs WASM because auto-fit measures glyphs through the
 * kernel's font engine — fonts must be loaded or every layout is skipped
 * (which is itself asserted, since that is the draft-kernel behavior).
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadTestFonts } from '@/test/loadTestFonts';
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
  await loadTestFonts();
  for (const [file, family] of [
    ['AtkinsonHyperlegible-Regular.ttf', 'atkinson'],
    ['AllertaStencil-Regular.ttf', 'allerta-stencil'],
  ] as const) {
    const buf = readFileSync(resolve(__dirname, `../../../../shared/fonts/assets/${file}`));
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
  it('centers text on an unobstructed wall when told to', () => {
    // Explicit, because the shipped default anchors bottom-left: reading the
    // centred case off the defaults would stop testing centring the moment the
    // default look changed.
    const layouts = computeWallTextLayouts(
      makeParams({ front: 'Cables' }, {}, { style: { anchor: 'center' } }),
      DIMS
    );
    expect(layouts).toHaveLength(1);
    const l = layouts[0];
    expect(l.side).toBe('front');
    expect(l.centerU).toBeCloseTo(0, 5);
    // The BLOCK is centred on the band, so the ink sits a little above its
    // middle: the block reserves a descender this caption does not use, and
    // that reserve is what keeps its baseline level with one that does.
    const bandMin = DEFAULT_BIN_PARAMS.wallThickness + BOTTOM_SOLID_SKIRT;
    const bandMax = DIMS.wallHeight - TOP_KEEP_OUT;
    expect(l.centerZ).toBeGreaterThan((bandMin + bandMax) / 2);
    expect(l.centerZ + l.textH / 2).toBeLessThanOrEqual(bandMax);
    expect(l.centerZ - l.textH / 2).toBeGreaterThanOrEqual(bandMin);
    expect(l.textW).toBeGreaterThan(0);
    expect(l.textH).toBeGreaterThan(0);
  });

  it('reports an ink box that never exceeds the rect it was planned in', () => {
    const l = computeWallTextLayouts(makeParams({ front: 'Cables' }), DIMS)[0];
    // textW/textH drive the wall-pattern clear rect, so a box larger than the
    // region the fit was planned in would clear pattern outside the band and
    // reach the lip taper.
    expect(l.textH).toBeLessThanOrEqual(l.availD);
    expect(l.textW).toBeLessThanOrEqual(l.availW);
  });

  it('anchors the caption to the corner it was told to, inside the band', () => {
    const style = { maxFontSize: 6, anchor: 'bottom-left' as const };
    const l = computeWallTextLayouts(makeParams({ front: 'Cables' }, {}, { style }), DIMS)[0];
    // Bottom-left on the front wall: low in the band and left of centre. Left
    // in the CLIP frame is negative u, and the front wall reads along +u.
    expect(l.centerZ).toBeLessThan(l.rectCenterZ);
    expect(l.centerU).toBeLessThan(0);
  });

  it('mirrors the anchored ink box into the clip frame on a reversed wall', () => {
    // The back wall reads along −u, so a caption anchored to the reader's left
    // sits at POSITIVE u. Getting the sign wrong clears pattern on the opposite
    // side of the wall from the glyphs.
    const style = { maxFontSize: 6, anchor: 'bottom-left' as const };
    const [front, back] = (() => {
      const f = computeWallTextLayouts(makeParams({ front: 'Cables' }, {}, { style }), DIMS)[0];
      const b = computeWallTextLayouts(makeParams({ back: 'Cables' }, {}, { style }), DIMS)[0];
      return [f, b];
    })();
    expect(front.centerU).toBeLessThan(0);
    expect(back.centerU).toBeGreaterThan(0);
    expect(back.centerU).toBeCloseTo(-front.centerU, 5);
  });

  it('resolves one size across the walls when asked, instead of fitting each alone', () => {
    // A short caption on a wide wall and a long one on the same wall: fitted
    // independently they differ, unified they do not.
    const independent = computeWallTextLayouts(
      makeParams(
        { front: 'A', left: 'LONGER CAPTION' },
        {},
        // Both flags stated: the shipped default already unifies, so an
        // "independent" case that inherited it would compare a size with itself.
        { style: { sizeMode: 'auto', maxFontSize: 40, uniformAcrossWalls: false } }
      ),
      DIMS
    );
    expect(independent).toHaveLength(2);
    expect(independent[0].plan.fontSize).not.toBeCloseTo(independent[1].plan.fontSize, 1);

    const unified = computeWallTextLayouts(
      makeParams(
        { front: 'A', left: 'LONGER CAPTION' },
        {},
        { style: { sizeMode: 'auto', maxFontSize: 40, uniformAcrossWalls: true } }
      ),
      DIMS
    );
    expect(unified).toHaveLength(2);
    expect(unified[0].plan.fontSize).toBeCloseTo(unified[1].plan.fontSize, 5);
    // The shared size is the smallest wall's, so nothing is scaled up past
    // what its own wall holds.
    expect(unified[0].plan.fontSize).toBeCloseTo(
      Math.min(independent[0].plan.fontSize, independent[1].plan.fontSize),
      5
    );
  });

  it('top/bottom anchoring shifts the text within the band', () => {
    // Cap the size so the glyphs don't fill the whole band: full-band text
    // leaves anchoring nothing to move (all three placements coincide).
    const top = computeWallTextLayouts(
      makeParams({ front: 'Cables' }, {}, { style: { maxFontSize: 6, anchor: 'top' } }),
      DIMS
    )[0];
    const bottom = computeWallTextLayouts(
      makeParams({ front: 'Cables' }, {}, { style: { maxFontSize: 6, anchor: 'bottom' } }),
      DIMS
    )[0];
    const center = computeWallTextLayouts(
      makeParams({ front: 'Cables' }, {}, { style: { maxFontSize: 6, anchor: 'center' } }),
      DIMS
    )[0];
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
