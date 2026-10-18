import {
  isSlideLid,
  LID_CORNER_RADIUS,
  LID_FIT_CLEARANCE,
  LID_MIN_RAIL_LENGTH,
  type BinParams,
  type Cutout,
  type LidClickRails,
  type LidConfig,
  type LidRailSide,
} from '@/features/bin-designer/types';
import { binDimensions, cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { slideLidFillOffsetMm } from '@/features/bin-designer/utils/slideLidPlanForParams';
import { cutoutDepthShortfall } from '../CutoutsSection/cutoutDepthShortfall';
import type { useTranslation } from '@/i18n';
import {
  railSegmentsClearOfBlocks,
  railSegmentsClearOfLabelTabs,
} from '@/shared/utils/labelTabPlan';
import type { LabelTabFootprint, WallSpanBlock } from '@/shared/utils/labelTabPlan';
import { railSegmentsClearOfPolygonGaps } from '@/shared/utils/lipGapPlan';
import type { PolygonLipGap } from '@/shared/utils/lipGapPlan';
import {
  isPartialMask,
  maskToPolygon,
  MASK_CELL_SIZE,
  type CellMask,
} from '@/shared/utils/cellMask';
import type {
  LidCompatibilityId,
  LidCompatibilityIssue,
  LidCompatibilitySide,
} from '@/features/bin-designer/utils/lidCompatibility';
/**
 * View-layer projection of the lid's top-face treatment. The persisted model
 * keeps `stackableTop` and `tray.enabled` as independent booleans (whose mutual
 * exclusion the store enforces); the panel presents them as one three-way
 * choice. No change to `LidConfig` — this is purely how the UI groups them.
 */
export type LidTopSurface = 'flat' | 'stackable' | 'tray';
export const LID_TOP_SURFACES: readonly LidTopSurface[] = ['flat', 'stackable', 'tray'] as const;

/**
 * Pure value-summary string for a lid (attachment mode + rail status). Shared
 * by the section body and the collapsed group header so the header can
 * subscribe to just `lid` rather than re-running the whole section hook (with
 * its broad params subscription and compatibility scan).
 */
export function lidValueSummary(lid: LidConfig, t: ReturnType<typeof useTranslation>): string {
  if (lid.attachment === 'friction') return t('binDesigner.lid.summaryFriction');
  // Before the rail fall-through: a slide config KEEPS its inert per-side rail
  // selection across an attachment switch, so falling through would caption a
  // sliding lid "{coverage}% rails".
  if (isSlideLid(lid)) return t('binDesigner.lid.summarySlide');
  if (lid.attachment === 'magnetic') {
    return t('binDesigner.lid.summaryMagnetic', {
      diameter: lid.retentionMagnet.diameter.toFixed(1),
      depth: lid.retentionMagnet.depth.toFixed(1),
    });
  }
  const railSideCount =
    (lid.clickRails.front ? 1 : 0) +
    (lid.clickRails.back ? 1 : 0) +
    (lid.clickRails.left ? 1 : 0) +
    (lid.clickRails.right ? 1 : 0);
  if (railSideCount === 0) return t('binDesigner.lid.summaryNoRails');
  if (railSideCount < 4) {
    return t('binDesigner.lid.summaryPartialRails', {
      coverage: lid.clickRailCoverage,
      sides: railSideCount,
    });
  }
  return t('binDesigner.lid.summary', { coverage: lid.clickRailCoverage });
}

/**
 * Build the `disabledReason` text shown on the lid toggle when blockers
 * are present. Single blocker → specific fix instruction; multiple →
 * generic "{count} conflicts" message so the tooltip stays compact.
 * Returns null when there are no blockers.
 */
export function buildBlockerReason(
  blockers: readonly LidCompatibilityIssue[],
  t: ReturnType<typeof useTranslation>
): string | null {
  if (blockers.length === 0) return null;
  if (blockers.length === 1) {
    // A slant leaves nothing to fix, only a fact to state.
    if (blockers[0].id === 'slanted') return t('binDesigner.lid.compat.slanted');
    const fixKey = `binDesigner.lid.compat.fix.${blockers[0].id}`;
    return t('binDesigner.lid.compat.disabledOne', { detail: t(fixKey) });
  }
  return t('binDesigner.lid.compat.disabledMany', { count: blockers.length });
}

/** Rail summary for display: count of walls per length tier. */
export interface RailSummary {
  /** Total walls that will receive a rail (after coverage + min-length + label-omit filters). */
  readonly count: number;
  /** Lengths that appear, sorted descending. Empty when count === 0. */
  readonly lengths: readonly number[];
  /** When polygon: the min and max rail length across walls (mm). Undefined for rectangles. */
  readonly polygonRange?: { min: number; max: number };
}

/**
 * Compute the rails-per-wall summary the LidSection panel displays. Mirrors
 * the geometry math in `lidBuilder.railPlacementsForRectangle/Polygon` but
 * yields display-only data — does not touch brepjs.
 */
export function computeRailSummary(
  width: number,
  depth: number,
  gridUnitMm: number,
  coveragePercent: number,
  disabledRails: ReadonlySet<LidCompatibilitySide>,
  cellMask: CellMask | undefined,
  clickRails: LidClickRails,
  // Y-axis pitch for non-square grids; defaults to the X pitch (square).
  gridUnitMmY: number = gridUnitMm,
  /**
   * Label tabs that foul the rail band. Empty for a bin without them, and for
   * polygon bins, whose tabs the builder gates off.
   */
  footprints: readonly LabelTabFootprint[] = [],
  /**
   * Per-axis overhang growth, from `overhangExpansion`. The lid wraps the
   * bin's expanded body, so without this the readout's wall lines sit inboard
   * of the worker's — and since those lines are what the footprints are
   * compared against, an overhang bin could disagree on the rail COUNT near a
   * tab edge, not merely on the length.
   */
  outerExpansion: { readonly addW: number; readonly addD: number } = { addW: 0, addD: 0 },
  /**
   * Stretches denied to a rail by a compartment divider or by a wall
   * cutout or handle hole that has taken the lip away. Empty for a bin
   * with none of the three. Without them the readout counts rails the worker
   * will not build.
   */
  wallBlocks: readonly WallSpanBlock[] = [],
  /**
   * Lip gaps on a custom-shape footprint, matched per EDGE rather than
   * per side. Empty for a rectangle, which uses `wallBlocks` instead.
   */
  polygonGaps: readonly PolygonLipGap[] = []
): RailSummary {
  const fitClearance = LID_FIT_CLEARANCE;
  const lidCornerR = LID_CORNER_RADIUS - fitClearance;
  const coverage = coveragePercent / 100;

  // Polygon path: per-edge length analysis from the mask outline.
  if (isPartialMask(cellMask)) {
    const outer = maskToPolygon(cellMask)[0] ?? [];
    const halfW = (cellMask.cols * MASK_CELL_SIZE * gridUnitMm) / 2;
    const halfD = (cellMask.rows * MASK_CELL_SIZE * gridUnitMmY) / 2;
    const lengths: number[] = [];
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i];
      const b = outer[(i + 1) % outer.length];
      const ax = a.x * gridUnitMm - halfW;
      const ay = a.y * gridUnitMmY - halfD;
      const bx = b.x * gridUnitMm - halfW;
      const by = b.y * gridUnitMmY - halfD;
      const dx = bx - ax;
      const dy = by - ay;
      // Classify by outward direction to apply the per-side toggle and
      // the feature-conflict skip — mirrors the worker's railPlacementsForPolygon.
      const edgeDirX = Math.sign(dx);
      const edgeDirY = Math.sign(dy);
      const outX = edgeDirY;
      const outY = -edgeDirX;
      let side: LidRailSide;
      if (outX === 0 && outY === 1) side = 'back';
      else if (outX === 0 && outY === -1) side = 'front';
      else if (outX === 1 && outY === 0) side = 'right';
      else if (outX === -1 && outY === 0) side = 'left';
      else continue;
      if (!clickRails[side]) continue;
      if (disabledRails.has(side)) continue;
      // Segmented around this edge's lip gaps, exactly as the worker does — a
      // polygon wall with a cutout yields two short rails, not one long one.
      const alongX = dy === 0;
      const alongLo = Math.min(alongX ? ax : ay, alongX ? bx : by) + lidCornerR;
      const alongHi = Math.max(alongX ? ax : ay, alongX ? bx : by) - lidCornerR;
      if (alongHi <= alongLo) continue;
      for (const seg of railSegmentsClearOfPolygonGaps(
        [{ lo: alongLo, hi: alongHi }],
        side,
        alongX ? ay : ax,
        polygonGaps
      )) {
        const railLen = (seg.hi - seg.lo) * coverage;
        if (railLen >= LID_MIN_RAIL_LENGTH) lengths.push(railLen);
      }
    }
    if (lengths.length === 0) return { count: 0, lengths: [] };
    const sorted = [...lengths].sort((a, b) => b - a);
    return {
      count: lengths.length,
      lengths: sorted,
      polygonRange: { min: sorted[sorted.length - 1], max: sorted[0] },
    };
  }

  // Rectangular path. Label tabs, dividers and lip gaps each cut the run into
  // stretches, so this walks the same passes the worker places rails from
  // rather than assuming one full-length rail per enabled wall: a wall they
  // cover yields nothing, and a partly-covered one yields several short rails.
  const lidOuterW = width * gridUnitMm - 2 * fitClearance + outerExpansion.addW;
  const lidOuterD = depth * gridUnitMmY - 2 * fitClearance + outerExpansion.addD;
  const corneredOuterX = lidOuterW / 2 - lidCornerR;
  const corneredOuterY = lidOuterD / 2 - lidCornerR;

  const lengths: number[] = [];
  const collect = (side: LidRailSide, alongX: boolean, railCross: number): void => {
    if (!clickRails[side] || disabledRails.has(side)) return;
    const half = alongX ? corneredOuterX : corneredOuterY;
    for (const seg of railSegmentsClearOfBlocks(
      railSegmentsClearOfLabelTabs(-half, half, alongX, railCross, footprints),
      side,
      wallBlocks
    )) {
      const len = (seg.hi - seg.lo) * coverage;
      if (len >= LID_MIN_RAIL_LENGTH) lengths.push(len);
    }
  };
  collect('back', true, corneredOuterY);
  collect('front', true, -corneredOuterY);
  collect('right', false, corneredOuterX);
  collect('left', false, -corneredOuterX);

  return { count: lengths.length, lengths: lengths.sort((a, b) => b - a) };
}

/**
 * Compat IDs that have a clean, single-action fix. Issues NOT in this
 * set (`shortBin`, `tallLidShortBin`, `cellMaskHoles`, `compartmentDividers`,
 * `topDownCutoutsAtLip`) require user judgment to resolve — bumping bin
 * height, lowering the extra lid height, redrawing a shape, removing
 * compartments, or editing a specific cutout — so we don't surface a
 * "Fix" button for them.
 */
// `labelTabs` is deliberately absent. Its one-click fix deleted every label on
// the bin, which was proportionate while a tab cost the whole wall's rail; since
// The rail is only segmented around the tabs, so the button offered to
// destroy user content to recover part of one wall. The warning still explains
// the trade and the user can turn labels off themselves.
const FIXABLE_IDS: ReadonlySet<LidCompatibilityId> = new Set<LidCompatibilityId>([
  'wallCutouts',
  'wallCutoutsAllSides',
  'wallPattern',
  'handles',
  'handlesAllSides',
  'tallDividerPieces',
  // The rim placement's one blocker, and the cleanest fix in the set: the lip
  // is a single Base switch, and the placement the user just chose is what
  // makes it impossible.
  'slideFlushNeedsNoLip',
  'slideFillTooHigh',
  'hingeStackableTop',
]);

const FIXABLE_IDS_WITHOUT_FILL: ReadonlySet<LidCompatibilityId> = new Set(
  [...FIXABLE_IDS].filter((id) => id !== 'slideFillTooHigh')
);

/**
 * Would a fill at `topOffset` cut any pocket shallower than the current fill does?
 *
 * Every pocket, mesh imprints included, stops at the fill's height. The
 * shortfall helper adds what a lean or a wall takes, but answers null for
 * shapes it does not judge, so it cannot be the only measure.
 */
function fillShortensPockets(params: BinParams, topOffset: number): boolean {
  const { innerW, innerD } = cutoutInterior(params);
  const { wallHeight } = binDimensions(params);
  const reach = (cutout: Cutout, offset: number): number => {
    const fill = wallHeight - offset;
    const clipped = cutoutDepthShortfall(cutout, innerW, innerD, fill)?.achievable ?? Infinity;
    return Math.min(cutout.cutDepth, fill, clipped);
  };
  return params.cutouts.some(
    (c) =>
      c.hidden !== true &&
      c.shape !== 'text' &&
      reach(c, topOffset) < reach(c, params.cutoutConfig.topOffset) - 1e-6
  );
}

/**
 * The issues this design offers a one-click Fix for. Pockets are cut down from
 * the fill, so lowering it can leave a deep one short of its depth; that trade
 * is left to the cutout editor, which reports the shortfall.
 */
export function fixableIdsFor(params: BinParams): ReadonlySet<LidCompatibilityId> {
  const offset = slideLidFillOffsetMm(params);
  return offset !== null && fillShortensPockets(params, offset)
    ? FIXABLE_IDS_WITHOUT_FILL
    : FIXABLE_IDS;
}
