/**
 * Wall-text placement solver (issue #2695).
 *
 * Computes where each wall's surface text lands on the bin's outer wall
 * faces: auto-fit into the largest clear region that avoids wall cutouts and
 * handles (plus the pattern border margin), vertically aligned per the
 * design's `wallAlign`. Shared by `wallTextBuilder` (which builds the glyph
 * solids there) and `wallPatternBuilder` (which clears the hex pattern
 * behind the same rect) so geometry and pattern clipping can never drift.
 *
 * Coordinate convention — "clip frame", matching the handle/pattern clip
 * boxes: `u` runs along +X for front/back walls and +Y for left/right walls,
 * centered on the cavity axis; `z` is wall height above the box bottom
 * (socket excluded, same frame the feature builders use). Reading-direction
 * conversion for glyph placement happens in `wallTextBuilder` via
 * {@link wallTextReadingSign}.
 *
 * Skipped entirely for polygon (cellMask) bins and solid-mode bins (the
 * solid-mode features stage doesn't run generic builders), and per-wall for
 * slot-occupied walls — mirrored in the WallsSection UI gating.
 */

import type { BinParams, TextFontFamily, TextMode, WallTextSide } from '@/shared/types/bin';
import { WALL_TEXT_SIDES } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import {
  computeHandleHoleGeometry,
  computeWallHandleSegments,
} from '@/shared/utils/handleCutoutClip';
import { computeMultiHandleOffsets } from '@/shared/utils/handleLayout';
import { isOk } from '@/core/result';
import { BOX_CORNER_RADIUS } from './generatorConstants';
import {
  getSlotFreeWalls,
  TOP_KEEP_OUT,
  BOTTOM_SOLID_SKIRT,
  CUTOUT_BORDER_WIDTH,
} from './wallPatterns';
import { fitFontSize, measureText, resolveEffectiveFont } from './textBuilder';

/** Solid material kept behind an engraved wall glyph (mm). */
export const WALL_TEXT_ENGRAVE_FLOOR = 0.4;

/**
 * Cap on embossed wall-text relief (mm). Adjacent bins sit ~0.5mm apart on
 * the grid, so an unbounded emboss would ram the neighbor; a shallow relief
 * keeps the label printable and grid-safe.
 */
export const WALL_TEXT_MAX_EMBOSS = 1.5;

/** Effective engrave depth below which the cut is skipped as unprintable. */
const MIN_ENGRAVE_DEPTH = 0.05;

/** Reading-direction sign: converts a clip-frame `u` into the glyph-run
 *  coordinate `buildTextSolid` sees before the per-wall yaw. A viewer facing
 *  each wall reads left-to-right along +X (front), −X (back), −Y (left),
 *  +Y (right). */
export function wallTextReadingSign(side: WallTextSide): 1 | -1 {
  return side === 'back' || side === 'left' ? -1 : 1;
}

interface Rect {
  readonly minU: number;
  readonly maxU: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface WallTextLayout {
  readonly side: WallTextSide;
  readonly text: string;
  readonly font: TextFontFamily;
  readonly mode: TextMode;
  /** Effective depth after the per-mode clamp (unused for through-cut). */
  readonly depth: number;
  readonly margin: number;
  readonly minFontSize: number;
  readonly maxFontSize: number;
  readonly fontSizeOverride?: number;
  /** Chosen clear-rect dims fed to `buildTextSolid` (margins not yet subtracted). */
  readonly availW: number;
  readonly availD: number;
  /** Text-bbox center in the clip frame. */
  readonly centerU: number;
  readonly centerZ: number;
  /** Fitted glyph bbox (no margin) — drives the pattern clip box. */
  readonly textW: number;
  readonly textH: number;
}

/** Dimensions subset the solver needs (from `PipelineContext.dimensions`). */
export interface WallTextDims {
  readonly innerW: number;
  readonly innerD: number;
  readonly wallHeight: number;
  readonly interiorHeight: number;
  readonly solid: boolean;
  readonly isSlotted: boolean;
}

function obstacleRects(
  params: BinParams,
  side: WallTextSide,
  wallSpan: number,
  wallHeight: number,
  isSlotted: boolean
): Rect[] {
  const rects: Rect[] = [];

  const cutout = params.walls.enabled ? params.walls[side] : undefined;
  if (cutout?.enabled) {
    const cutWidth =
      cutout.widthMm !== null
        ? Math.min(cutout.widthMm, wallSpan)
        : wallSpan * (cutout.width / 100);
    const interiorWallHeight = wallHeight - params.wallThickness;
    const cutHeight = interiorWallHeight * (cutout.depth / 100);
    if (cutWidth >= 0.1 && cutHeight >= 0.1) {
      const centerU = computeCutoutCenter(
        wallSpan,
        cutWidth,
        params.wallThickness,
        cutout.alignment,
        cutout.offset
      );
      // Wall cutouts are U-notches opening at the wall top.
      rects.push({
        minU: centerU - cutWidth / 2,
        maxU: centerU + cutWidth / 2,
        minZ: wallHeight - cutHeight,
        maxZ: wallHeight,
      });
    }
  }

  const handleSide = params.handles[side];
  if (
    params.handles.enabled &&
    !isSlotted &&
    handleSide.enabled &&
    !(side === 'back' && params.label.enabled)
  ) {
    const sideWidth = handleSide.width ?? params.handles.width;
    const sideHeight = handleSide.height ?? params.handles.height;
    // interiorHeight ≈ wallHeight; the handle Z math anchors on the interior.
    const { centerZ, effectiveHeight } = computeHandleHoleGeometry(
      wallHeight,
      sideHeight,
      params.handles.verticalPosition
    );
    if (effectiveHeight >= 1) {
      const segments = computeWallHandleSegments(wallSpan, sideWidth, params.wallThickness, cutout);
      if (segments) {
        const handleWidthMm = wallSpan * (sideWidth / 100);
        const offsets = computeMultiHandleOffsets(params.handles.count, wallSpan, handleWidthMm);
        for (const handleOffset of offsets) {
          for (const seg of segments) {
            rects.push({
              minU: seg.offset + handleOffset - seg.width / 2,
              maxU: seg.offset + handleOffset + seg.width / 2,
              minZ: centerZ - effectiveHeight / 2,
              maxZ: centerZ + effectiveHeight / 2,
            });
          }
        }
      }
    }
  }

  return rects;
}

/**
 * Candidate clear rects: the full band when unobstructed, otherwise the four
 * bands around the border-expanded union of every obstacle. Bands (not a
 * general largest-empty-rectangle search) match how the obstacles actually
 * occur — a centered U-notch or a handle row — and keep placement stable.
 */
function candidateRects(bounds: Rect, obstacles: readonly Rect[]): Rect[] {
  if (obstacles.length === 0) return [bounds];
  const border = CUTOUT_BORDER_WIDTH;
  let minU = Infinity;
  let maxU = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const o of obstacles) {
    minU = Math.min(minU, o.minU - border);
    maxU = Math.max(maxU, o.maxU + border);
    minZ = Math.min(minZ, o.minZ - border);
    maxZ = Math.max(maxZ, o.maxZ + border);
  }
  const candidates: Rect[] = [
    { minU: bounds.minU, maxU: bounds.maxU, minZ: bounds.minZ, maxZ: Math.min(minZ, bounds.maxZ) },
    { minU: bounds.minU, maxU: bounds.maxU, minZ: Math.max(maxZ, bounds.minZ), maxZ: bounds.maxZ },
    { minU: bounds.minU, maxU: Math.min(minU, bounds.maxU), minZ: bounds.minZ, maxZ: bounds.maxZ },
    { minU: Math.max(maxU, bounds.minU), maxU: bounds.maxU, minZ: bounds.minZ, maxZ: bounds.maxZ },
  ];
  return candidates.filter((r) => r.maxU - r.minU > 0 && r.maxZ - r.minZ > 0);
}

/**
 * Compute the placement for every wall carrying text. Returns [] when the
 * feature doesn't apply (no strings, polygon or solid bin) and silently skips
 * walls whose clear regions can't fit the text at `minFontSize` — the
 * established convention for undersized features.
 */
export function computeWallTextLayouts(params: BinParams, dim: WallTextDims): WallTextLayout[] {
  const walls = params.surfaceText?.walls;
  if (!walls) return [];
  if (isPartialMask(params.cellMask) || dim.solid) return [];

  const style = { ...params.textDefaults, ...params.surfaceText.style };
  const align = params.surfaceText.wallAlign ?? 'center';
  const slotFree = getSlotFreeWalls(params);
  const layouts: WallTextLayout[] = [];

  for (const side of WALL_TEXT_SIDES) {
    const text = walls[side]?.trim() ?? '';
    if (text === '') continue;
    if (!slotFree[side]) continue;

    // Per-mode depth clamps: engraving must leave solid wall behind the
    // glyphs; emboss is capped so the relief can't ram an adjacent bin.
    let depth = style.depth;
    if (style.mode === 'engrave') {
      depth = Math.min(depth, params.wallThickness - WALL_TEXT_ENGRAVE_FLOOR);
      if (depth < MIN_ENGRAVE_DEPTH) continue;
    } else if (style.mode === 'emboss') {
      depth = Math.min(depth, WALL_TEXT_MAX_EMBOSS);
    }

    const wallSpan = side === 'front' || side === 'back' ? dim.innerW : dim.innerD;
    // Horizontal limit: the flat face ends where the outer corner rounding
    // begins, so the text bbox must stay inside span/2 + wt − cornerR.
    const uLimit = wallSpan / 2 + params.wallThickness - BOX_CORNER_RADIUS;
    // Vertical band mirrors the wall pattern's keep-outs: solid skirt above
    // the floor slab, and clear of the stacking-lip taper at the top.
    const bounds: Rect = {
      minU: -uLimit,
      maxU: uLimit,
      minZ: params.wallThickness + BOTTOM_SOLID_SKIRT,
      maxZ: dim.wallHeight - TOP_KEEP_OUT,
    };
    if (bounds.maxU <= bounds.minU || bounds.maxZ <= bounds.minZ) continue;

    const obstacles = obstacleRects(params, side, wallSpan, dim.wallHeight, dim.isSlotted);
    const font = resolveEffectiveFont(style.font, style.mode);

    // Fit into each candidate, keep the ones that hold the text, then pick
    // by the alignment preference (top → highest center, bottom → lowest,
    // center → largest area; area breaks ties for top/bottom).
    const fitted = candidateRects(bounds, obstacles)
      .map((rect) => {
        const availW = rect.maxU - rect.minU;
        const availD = rect.maxZ - rect.minZ;
        const fit = fitFontSize(
          text,
          font,
          availW - 2 * style.margin,
          availD - 2 * style.margin,
          style.minFontSize,
          style.maxFontSize
        );
        return fit.fits ? { rect, availW, availD, fontSize: fit.fontSize } : null;
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
    if (fitted.length === 0) continue;

    const area = (c: (typeof fitted)[number]): number => c.availW * c.availD;
    const centerOf = (c: (typeof fitted)[number]): number => (c.rect.minZ + c.rect.maxZ) / 2;
    const chosen = fitted.reduce((best, c) => {
      if (align === 'top') {
        if (centerOf(c) !== centerOf(best)) return centerOf(c) > centerOf(best) ? c : best;
      } else if (align === 'bottom') {
        if (centerOf(c) !== centerOf(best)) return centerOf(c) < centerOf(best) ? c : best;
      }
      return area(c) > area(best) ? c : best;
    });

    // Mirror buildTextSolid's override clamp so the measured bbox matches the
    // glyphs it will actually build.
    const fontSize =
      style.fontSizeOverride !== undefined
        ? Math.min(chosen.fontSize, Math.max(style.minFontSize, style.fontSizeOverride))
        : chosen.fontSize;
    const metrics = measureText(text, fontSize, font);
    if (!isOk(metrics)) continue;
    const textW = metrics.value.width;
    const textH = metrics.value.ascender - metrics.value.descender;

    // Vertical alignment INSIDE the chosen rect; horizontal always centered.
    const centerZ =
      align === 'top'
        ? chosen.rect.maxZ - style.margin - textH / 2
        : align === 'bottom'
          ? chosen.rect.minZ + style.margin + textH / 2
          : (chosen.rect.minZ + chosen.rect.maxZ) / 2;

    layouts.push({
      side,
      text,
      font: style.font,
      mode: style.mode,
      depth,
      margin: style.margin,
      minFontSize: style.minFontSize,
      maxFontSize: style.maxFontSize,
      ...(style.fontSizeOverride !== undefined ? { fontSizeOverride: style.fontSizeOverride } : {}),
      availW: chosen.availW,
      availD: chosen.availD,
      centerU: (chosen.rect.minU + chosen.rect.maxU) / 2,
      centerZ,
      textW,
      textH,
    });
  }

  return layouts;
}
