/**
 * Placement validation: can a bin go where the user wants it?
 *
 * `canPlaceBin` is the single source of truth used by:
 *   - drag/drop interactions (live preview)
 *   - import / salvage validators (dry-run before commit)
 *   - draw/resize tools (highlight invalid drops)
 *
 * Returns a discriminated `ValidationResult` so callers can route on the
 * specific failure (`out_of_bounds`, `collision`, `blocked_zone`, etc.)
 * and translate to a user-facing message via `getPlacementErrorMessage`.
 */

import type {
  Bin,
  BlockingInfo,
  DesignId,
  HeightUnits,
  Layout,
  ValidationResult,
  Rect,
  BinId,
  LayerId,
} from '@/core/types';
import { isFootprintInsideOutline } from './drawerOutlineGeometry';
import { drawerFrameOutline } from './outlineFrame';
import {
  binId as toBinId,
  categoryId as toCategoryId,
  effectiveGridUnitMmY,
  HEIGHT_UNIT_STEP,
  heightUnits,
} from '@/core/types';
import { CONSTRAINTS } from '@/core/constants';
import { footprintsOverlap } from './collision';
import type { RestingStack } from './restingStack';
import { getRestingStack, maxBinHeight, newViolations, restack } from './restingStack';

function blockingInfoFor(bin: Bin, layers: Layout['layers']): BlockingInfo {
  return {
    binId: bin.id,
    layerId: bin.layerId,
    layerName: layers.find((l) => l.id === bin.layerId)?.name ?? bin.layerId,
  };
}

/**
 * Everything about a placement that does not depend on what else is
 * stacked: bounds, the drawer shape, the layer, and same-layer overlap.
 * Loading a saved or shared layout checks only this; a stack past the drawer
 * or on clearance is shown and fixed in the editor, not refused or stashed.
 */
export function canPlaceFootprint(
  rect: Rect,
  layerId: LayerId,
  layout: Layout,
  excludeBinId?: BinId,
  excludeBinIds?: Set<BinId>
): ValidationResult {
  const { drawer, layers, bins } = layout;

  // Bounds check
  if (rect.x < 0 || rect.y < 0) {
    return { valid: false, reason: 'out_of_bounds' };
  }
  if (rect.x + rect.width > drawer.width) {
    return { valid: false, reason: 'exceeds_width' };
  }
  if (rect.y + rect.depth > drawer.depth) {
    return { valid: false, reason: 'exceeds_depth' };
  }

  // Non-rectangular drawers: the footprint must sit fully inside the outline
  // (boundary-flush placements count as inside). One check here covers every
  // interaction — draw, drag, resize, staging drop, paint, fill, import.
  // The outline is read through the shared grid↔perimeter frame so a
  // placeable cell here is exactly a socket the printed plate keeps.
  const frameOutline = drawerFrameOutline(
    drawer,
    layout.baseplateParams,
    layout.gridUnitMm,
    effectiveGridUnitMmY(layout)
  );
  if (
    frameOutline !== undefined &&
    !isFootprintInsideOutline(rect, frameOutline, layout.gridUnitMm, effectiveGridUnitMmY(layout))
  ) {
    return { valid: false, reason: 'outside_drawer' };
  }

  const layer = layers.find((l) => l.id === layerId);
  if (!layer) {
    return { valid: false, reason: 'invalid_layer' };
  }

  // Only bins sharing a layer can collide; across layers the upper one rests
  // on the lower one instead.
  for (const other of bins) {
    if (other.layerId !== layerId || other.id === excludeBinId || excludeBinIds?.has(other.id)) {
      continue;
    }
    if (footprintsOverlap(rect, other)) {
      return { valid: false, reason: 'collision', blockingInfo: blockingInfoFor(other, layers) };
    }
  }

  return { valid: true };
}

/**
 * Validate if a bin can be placed at the given position: its footprint, and
 * where it would rest along with everything that would rest on it.
 * @param excludeBinId - The bin being moved or resized, replaced by the candidate
 * @param excludeBinIds - Other bins moving with it, ignored for same-layer overlap
 */
export function canPlaceBin(
  rect: Rect & {
    height: HeightUnits;
    /**
     * These two keys, when present (even as undefined), override the excluded
     * bin's own values; when absent, the candidate inherits them.
     */
    clearanceHeight?: HeightUnits;
    linkedDesignId?: DesignId;
  },
  layerId: LayerId,
  layout: Layout,
  excludeBinId?: BinId,
  excludeBinIds?: Set<BinId>
): ValidationResult {
  const footprint = canPlaceFootprint(rect, layerId, layout, excludeBinId, excludeBinIds);
  if (!footprint.valid) return footprint;

  const { drawer, layers, bins } = layout;

  // A caller moving or resizing an existing bin usually passes only the new
  // footprint and height; the bin's clearance and linked rise travel with it.
  const existing = excludeBinId !== undefined ? bins.find((b) => b.id === excludeBinId) : undefined;
  const testBin: Bin = {
    id: excludeBinId ?? toBinId('__test__'),
    layerId,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    depth: rect.depth,
    height: rect.height,
    clearanceHeight: 'clearanceHeight' in rect ? rect.clearanceHeight : existing?.clearanceHeight,
    linkedDesignId: 'linkedDesignId' in rect ? rect.linkedDesignId : existing?.linkedDesignId,
    category: toCategoryId(''),
    label: '',
    notes: '',
  };

  // Other bins of a group move are checked where they stand, as the commit
  // applies one move at a time: removing them here would drop whatever they
  // carry and refuse a move that is safe.
  const before = getRestingStack(bins, layers);
  const after = restack(before, bins, layers, new Set(), [testBin]);
  const fresh = newViolations(before, after, drawer.height);
  const infoFor = (id: BinId): BlockingInfo | undefined => {
    const bin = bins.find((b) => b.id === id);
    return bin && blockingInfoFor(bin, layers);
  };

  const onClearance = fresh.find((v) => v.kind === 'clearance' && v.binId === testBin.id);
  if (onClearance?.kind === 'clearance') {
    return {
      valid: false,
      reason: 'blocked_zone',
      blockingInfo: infoFor(onClearance.clearanceOf),
    };
  }
  if (fresh.some((v) => v.kind === 'exceeds_height' && v.binId === testBin.id)) {
    return { valid: false, reason: 'exceeds_height' };
  }

  // Lifting this bin lifts everything resting on it, and moving it away lets
  // that drop: either can push another stack past the drawer or onto
  // clearance reserved above some other bin.
  const knockOn = fresh.find((v) => v.binId !== testBin.id);
  if (knockOn !== undefined) {
    return {
      valid: false,
      reason: knockOn.kind === 'clearance' ? 'blocked_zone' : 'exceeds_height',
      blockingInfo: infoFor(knockOn.binId),
    };
  }

  return { valid: true };
}

/**
 * The tallest `bin` can be made and still pass `canPlaceBin`, from the
 * drawer-only `maxBinHeight` down a unit at a time: lifting a bin can also
 * carry another bin's clearance up under a bin above, which only placement
 * checks. `clearanceGivesWay` matches an edit that keeps height plus
 * clearance fixed. Returns below the minimum height when nothing fits.
 */
export function maxPlaceableHeight(
  bin: Bin,
  layout: Layout,
  options: { clearanceGivesWay?: boolean; stack?: RestingStack } = {}
): number {
  const inLayout = layout.bins.some((b) => b.id === bin.id);
  const total = bin.height + (bin.clearanceHeight ?? 0);
  const fits = (height: number): boolean =>
    canPlaceBin(
      {
        x: bin.x,
        y: bin.y,
        width: bin.width,
        depth: bin.depth,
        height: heightUnits(height),
        clearanceHeight:
          options.clearanceGivesWay && (bin.clearanceHeight ?? 0) > 0
            ? heightUnits(Math.max(0, total - height))
            : bin.clearanceHeight,
        linkedDesignId: bin.linkedDesignId,
      },
      bin.layerId,
      layout,
      inLayout ? bin.id : undefined
    ).valid;

  const limit = maxBinHeight(bin, layout.bins, layout.layers, layout.drawer.height, options);
  if (limit < CONSTRAINTS.MIN_BIN_HEIGHT || fits(limit)) return limit;
  let failing = limit;
  for (let height = Math.ceil(limit) - 1; height >= CONSTRAINTS.MIN_BIN_HEIGHT; height--) {
    if (!fits(height)) {
      failing = height;
      continue;
    }
    // A clearance stops being a support conflict exactly where it ties a
    // solid top, which can fall between whole units.
    const perUnit = Math.round(1 / HEIGHT_UNIT_STEP);
    let lo = height * perUnit;
    let hi = Math.ceil(failing * perUnit - 1e-6);
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (fits(mid / perUnit)) lo = mid;
      else hi = mid;
    }
    return lo / perUnit;
  }
  return CONSTRAINTS.MIN_BIN_HEIGHT - 1;
}
