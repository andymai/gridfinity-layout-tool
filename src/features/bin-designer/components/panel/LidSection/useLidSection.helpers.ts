import {
  LID_CORNER_RADIUS,
  LID_FIT_CLEARANCE,
  LID_MIN_RAIL_LENGTH,
  type LidClickRails,
  type LidConfig,
  type LidRailSide,
} from '@/features/bin-designer/types';
import type { useTranslation } from '@/i18n';
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
  gridUnitMmY: number = gridUnitMm
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
      const railLen = (Math.abs(dx) + Math.abs(dy) - 2 * lidCornerR) * coverage;
      if (railLen >= LID_MIN_RAIL_LENGTH) lengths.push(railLen);
    }
    if (lengths.length === 0) return { count: 0, lengths: [] };
    const sorted = [...lengths].sort((a, b) => b - a);
    return {
      count: lengths.length,
      lengths: sorted,
      polygonRange: { min: sorted[sorted.length - 1], max: sorted[0] },
    };
  }

  // Rectangular path: at most two distinct lengths (X-axis walls vs Y-axis walls).
  const lidOuterW = width * gridUnitMm - 2 * fitClearance;
  const lidOuterD = depth * gridUnitMmY - 2 * fitClearance;
  const railLenX = (lidOuterW - 2 * lidCornerR) * coverage;
  const railLenY = (lidOuterD - 2 * lidCornerR) * coverage;
  // Per-side count: 1 if that wall has a rail enabled AND its side isn't
  // disabled by a feature conflict. Front+back run along X axis.
  const railOn = (side: LidRailSide) => clickRails[side] && !disabledRails.has(side);
  const countX = (railOn('back') ? 1 : 0) + (railOn('front') ? 1 : 0);
  const countY = (railOn('right') ? 1 : 0) + (railOn('left') ? 1 : 0);
  const xValid = railLenX >= LID_MIN_RAIL_LENGTH ? countX : 0;
  const yValid = railLenY >= LID_MIN_RAIL_LENGTH ? countY : 0;
  const lengths: number[] = [];
  for (let i = 0; i < xValid; i++) lengths.push(railLenX);
  for (let i = 0; i < yValid; i++) lengths.push(railLenY);
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
export const FIXABLE_IDS: ReadonlySet<LidCompatibilityId> = new Set<LidCompatibilityId>([
  'wallCutouts',
  'wallCutoutsAllSides',
  'wallPattern',
  'labelTabs',
  'handles',
  'handlesAllSides',
  'tallDividerPieces',
]);
