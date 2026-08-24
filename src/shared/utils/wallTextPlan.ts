/**
 * Wall-text placement solver.
 *
 * Chooses which clear region of each outer wall face carries that wall's
 * caption, then hands the region to the shared type plan
 * (`@/shared/utils/typePlan`) to resolve size, tracking, line breaking and the
 * anchored position inside it. Shared by `wallTextBuilder` (which builds the
 * glyph solids) and `wallPatternBuilder` (which clears the hex pattern behind
 * the same ink box) so geometry and pattern clipping can never drift.
 *
 * Coordinate convention: "clip frame", matching the handle/pattern clip boxes.
 * `u` runs along +X for front/back walls and +Y for left/right walls, centred
 * on the cavity axis; `z` is wall height above the box bottom (socket excluded,
 * same frame the feature builders use). Reading-direction conversion for glyph
 * placement happens in `wallTextBuilder` via {@link wallTextReadingSign}.
 *
 * Skipped entirely for polygon (cellMask) bins, and per-wall for
 * slot-occupied walls, mirrored in the WallsSection UI gating.
 */

import type { BinParams, TextMode, TextStyleDefaults, WallTextSide } from '@/shared/types/bin';
import { WALL_TEXT_SIDES, resolveTextStyle } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import {
  computeHandleHoleGeometry,
  computeWallHandleSegments,
} from '@/shared/utils/handleCutoutClip';
import { computeMultiHandleOffsets } from '@/shared/utils/handleLayout';
import type { TypeBlockPlan } from '@/shared/utils/typePlan';
import { GRIDFINITY } from '@/shared/constants/bin';
import { getSlotFreeWalls } from '@/shared/utils/slotFreeWalls';
import {
  TOP_KEEP_OUT,
  BOTTOM_SOLID_SKIRT,
  CUTOUT_BORDER_WIDTH,
} from '@/shared/constants/wallBands';
import { planTypeBlock, type TypeMeasurer } from '@/shared/utils/typePlan';

const BOX_CORNER_RADIUS = GRIDFINITY.BOX_CORNER_RADIUS;

/** A style with every field resolved, plus the legacy shrink-only size cap. */
export type ResolvedTextStyle = TextStyleDefaults & { readonly fontSizeOverride?: number };

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
  readonly mode: TextMode;
  /** Effective depth after the per-mode clamp (unused for through-cut). */
  readonly depth: number;
  readonly style: ResolvedTextStyle;
  /** The resolved glyph placement, relative to the chosen rect's centre. */
  readonly plan: TypeBlockPlan;
  /** Chosen clear-rect dims and centre in the clip frame. */
  readonly availW: number;
  readonly availD: number;
  readonly rectCenterU: number;
  readonly rectCenterZ: number;
  /**
   * Ink box of the PLACED glyphs in the clip frame, which is what the wall
   * pattern has to clear. Not the rect: an anchored caption occupies a corner
   * of its rect, and clearing the whole rect would erase pattern the glyphs
   * never reach.
   */
  readonly centerU: number;
  readonly centerZ: number;
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
  isSlotted: boolean,
  solid: boolean
): Rect[] {
  const rects: Rect[] = [];

  // A solid body generates neither of the obstacles below — the style disables
  // wall cutouts and handles outright. Reading them anyway would shrink the
  // band around a hole nothing cuts, which an imported design can still ask for
  // by carrying the flags the constraint engine clears on the way in.
  if (solid) return rects;

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

/** Per-wall resolved style, layering the wall's own override over the shared one. */
function wallStyle(params: BinParams, side: WallTextSide): ResolvedTextStyle {
  return resolveTextStyle(
    params.textDefaults,
    params.surfaceText?.style,
    params.surfaceText?.wallStyles?.[side]
  );
}

/** Effective engrave/emboss depth, or null when the cut would be unprintable. */
function clampDepth(style: ResolvedTextStyle, wallThickness: number): number | null {
  // Engraving must leave solid wall behind the glyphs; emboss is capped so the
  // relief can't ram an adjacent bin.
  if (style.mode === 'engrave') {
    const depth = Math.min(style.depth, wallThickness - WALL_TEXT_ENGRAVE_FLOOR);
    return depth < MIN_ENGRAVE_DEPTH ? null : depth;
  }
  if (style.mode === 'emboss') return Math.min(style.depth, WALL_TEXT_MAX_EMBOSS);
  return style.depth;
}

interface Candidate {
  readonly rect: Rect;
  readonly availW: number;
  readonly availD: number;
  readonly plan: TypeBlockPlan;
}

/**
 * Fit into each candidate rect, then pick by the anchor's vertical zone: a
 * caption anchored to the top wants the highest region that holds it, one
 * anchored to the bottom the lowest, and a centred one the largest. Choosing
 * the region and then anchoring INSIDE it is what lets a bottom-left caption
 * still find its way around a handle row.
 */
function chooseCandidate(
  text: string,
  style: ResolvedTextStyle,
  rects: readonly Rect[],
  sharedSizeMm: number | undefined,
  measurer: TypeMeasurer
): Candidate | null {
  const fitted: Candidate[] = [];
  for (const rect of rects) {
    const availW = rect.maxU - rect.minU;
    const availD = rect.maxZ - rect.minZ;
    const plan = planTypeBlock(
      {
        text,
        style,
        host: { width: availW, depth: availD },
        ...(sharedSizeMm !== undefined ? { sharedSizeMm } : {}),
      },
      measurer
    );
    if (plan) fitted.push({ rect, availW, availD, plan });
  }
  if (fitted.length === 0) return null;

  const area = (c: Candidate): number => c.availW * c.availD;
  const centerOf = (c: Candidate): number => (c.rect.minZ + c.rect.maxZ) / 2;
  const wantsTop = style.anchor.startsWith('top');
  const wantsBottom = style.anchor.startsWith('bottom');
  return fitted.reduce((best, c) => {
    if (wantsTop && centerOf(c) !== centerOf(best)) return centerOf(c) > centerOf(best) ? c : best;
    if (wantsBottom && centerOf(c) !== centerOf(best))
      return centerOf(c) < centerOf(best) ? c : best;
    return area(c) > area(best) ? c : best;
  });
}

/** The band a wall's text may occupy, before obstacles. */
function wallBounds(params: BinParams, dim: WallTextDims, wallSpan: number): Rect | null {
  // Horizontal limit: the flat face ends where the outer corner rounding
  // begins, so the text bbox must stay inside span/2 + wt − cornerR.
  const uLimit = wallSpan / 2 + params.wallThickness - BOX_CORNER_RADIUS;
  // Vertical band mirrors the wall pattern's keep-outs: solid skirt above the
  // floor slab, and clear of the stacking-lip taper at the top.
  const bounds: Rect = {
    minU: -uLimit,
    maxU: uLimit,
    minZ: params.wallThickness + BOTTOM_SOLID_SKIRT,
    maxZ: dim.wallHeight - TOP_KEEP_OUT,
  };
  return bounds.maxU > bounds.minU && bounds.maxZ > bounds.minZ ? bounds : null;
}

interface SideInput {
  readonly side: WallTextSide;
  readonly text: string;
  readonly style: ResolvedTextStyle;
  readonly depth: number;
  readonly rects: readonly Rect[];
}

/** Walls carrying text, with their styles, depths and candidate regions. */
function collectSides(params: BinParams, dim: WallTextDims): SideInput[] {
  const walls = params.surfaceText?.walls;
  if (!walls) return [];
  const slotFree = getSlotFreeWalls(params);
  const out: SideInput[] = [];

  for (const side of WALL_TEXT_SIDES) {
    const text = walls[side]?.trim() ?? '';
    if (text === '') continue;
    if (!slotFree[side]) continue;

    const style = wallStyle(params, side);
    const depth = clampDepth(style, params.wallThickness);
    if (depth === null) continue;

    const wallSpan = side === 'front' || side === 'back' ? dim.innerW : dim.innerD;
    const bounds = wallBounds(params, dim, wallSpan);
    if (!bounds) continue;

    const obstacles = obstacleRects(
      params,
      side,
      wallSpan,
      dim.wallHeight,
      dim.isSlotted,
      dim.solid
    );
    out.push({ side, text, style, depth, rects: candidateRects(bounds, obstacles) });
  }
  return out;
}

function toLayout(input: SideInput, candidate: Candidate): WallTextLayout {
  const { plan } = candidate;
  const rectCenterU = (candidate.rect.minU + candidate.rect.maxU) / 2;
  const rectCenterZ = (candidate.rect.minZ + candidate.rect.maxZ) / 2;
  // The plan's X is in the READING frame, so it converts into the clip frame
  // through the same sign the builder applies. Getting this wrong mirrors the
  // pattern clip to the opposite side of a left-anchored caption on the back
  // and left walls, where nothing would clear the glyphs.
  const sign = wallTextReadingSign(input.side);
  return {
    side: input.side,
    mode: input.style.mode,
    depth: input.depth,
    style: input.style,
    plan,
    availW: candidate.availW,
    availD: candidate.availD,
    rectCenterU,
    rectCenterZ,
    centerU: rectCenterU + (sign * (plan.minX + plan.maxX)) / 2,
    centerZ: rectCenterZ + (plan.minY + plan.maxY) / 2,
    textW: plan.maxX - plan.minX,
    textH: plan.maxY - plan.minY,
  };
}

/**
 * Compute the placement for every wall carrying text. Returns [] when the
 * feature doesn't apply (no strings, or a polygon bin) and silently skips
 * walls whose clear regions can't hold the text at `minFontSize`, the
 * established convention for undersized features.
 */
export function computeWallTextLayouts(
  params: BinParams,
  dim: WallTextDims,
  measurer: TypeMeasurer
): WallTextLayout[] {
  if (isPartialMask(params.cellMask)) return [];

  const sides = collectSides(params, dim);
  if (sides.length === 0) return [];

  const first = sides
    .map((input) => ({
      input,
      candidate: chooseCandidate(input.text, input.style, input.rects, undefined, measurer),
    }))
    .filter(
      (entry): entry is { input: SideInput; candidate: Candidate } => entry.candidate !== null
    );
  if (first.length === 0) return [];

  // One size across the walls that carry text, so a bin does not read 12mm on
  // the front and 7mm on the left. The smallest fit is the only size every wall
  // is known to hold; re-planning at it can still change which region each wall
  // picks, which is why the second pass is a full re-plan and not a rescale.
  const unify = first.some(
    (e) => e.input.style.uniformAcrossWalls && e.input.style.sizeMode === 'auto'
  );
  if (!unify || first.length < 2) return first.map((e) => toLayout(e.input, e.candidate));

  const shared = Math.min(...first.map((e) => e.candidate.plan.fontSize));
  const layouts: WallTextLayout[] = [];
  for (const { input, candidate } of first) {
    const unified = input.style.uniformAcrossWalls
      ? chooseCandidate(input.text, input.style, input.rects, shared, measurer)
      : null;
    layouts.push(toLayout(input, unified ?? candidate));
  }
  return layouts;
}
