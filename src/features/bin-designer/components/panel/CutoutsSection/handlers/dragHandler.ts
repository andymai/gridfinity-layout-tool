/**
 * Handler for the 'dragging' interaction mode.
 *
 * Manages dead-zone detection, axis-locking (shift), group constraint,
 * snap-to-grid, clamping to bin bounds, and alignment guide computation.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { constrainGroupDrag, computeBounds, findAlignmentGuides } from '../geometry';
import { cutoutFitsInMask } from '../maskFit';
import type { InteractionMode } from '../useCutoutInteraction';
import type { PointerMoveEvent, BinBounds, SnapFn, PreviewSetters, DeadZoneRef } from './types';

/** Dead zone in mm before drag starts updating preview. */
const DEAD_ZONE_MM = 0.5;

/** Mode state for dragging, derived from the global InteractionMode union. */
type DraggingMode = Extract<InteractionMode, { type: 'dragging' }>;

/**
 * Compute drag preview positions for all selected cutouts.
 */
export function handleDragMove(
  mode: DraggingMode,
  event: PointerMoveEvent,
  cutouts: readonly Cutout[],
  bounds: BinBounds,
  snap: SnapFn,
  deadZoneRef: DeadZoneRef,
  setters: Pick<PreviewSetters, 'setPreview' | 'setActiveGuides'>
): void {
  // Dead zone check
  if (!deadZoneRef.current) {
    const dist = Math.sqrt((event.mmX - mode.startX) ** 2 + (event.mmY - mode.startY) ** 2);
    if (dist < DEAD_ZONE_MM) return;
    deadZoneRef.current = true;
  }

  // Compute raw deltas
  const rawDx = event.mmX - mode.startX;
  const rawDy = event.mmY - mode.startY;

  // Shift: axis-lock — constrain to dominant axis (Figma-style)
  let constrainedDx = rawDx;
  let constrainedDy = rawDy;
  if (event.shiftKey) {
    if (Math.abs(rawDx) >= Math.abs(rawDy)) {
      constrainedDy = 0;
    } else {
      constrainedDx = 0;
    }
  }

  // Get selected cutouts for clamping
  const selectedCutouts = cutouts.filter((c) => mode.offsets.has(c.id));
  const { dx, dy } = constrainGroupDrag(
    selectedCutouts,
    constrainedDx,
    constrainedDy,
    bounds.binWidth,
    bounds.binDepth
  );

  const nextPreview = new Map<string, Partial<Cutout>>();
  for (const [id, offset] of mode.offsets) {
    const cutout = cutouts.find((c) => c.id === id);
    if (!cutout) continue;
    // Snap, then clamp to bin bounds (snap can round past non-integer edges)
    nextPreview.set(id, {
      x: Math.max(0, Math.min(snap(mode.startX + dx + offset.dx), bounds.binWidth - cutout.width)),
      y: Math.max(0, Math.min(snap(mode.startY + dy + offset.dy), bounds.binDepth - cutout.depth)),
    });
  }

  // Polygon mask: hard-reject moves that would overhang the polygon — preview
  // stays at its last valid state so the drag "sticks" like the bin-bounds clamp.
  if (bounds.cellMask && bounds.maskCellSize) {
    for (const [id, updates] of nextPreview) {
      const orig = cutouts.find((c) => c.id === id);
      if (!orig) continue;
      const candidate = { ...orig, ...updates };
      if (!cutoutFitsInMask(candidate, bounds.cellMask, bounds.maskCellSize)) {
        return;
      }
    }
  }

  setters.setPreview(nextPreview);

  // Compute alignment guides
  const stationaryIds = new Set(cutouts.map((c) => c.id));
  for (const id of mode.offsets.keys()) stationaryIds.delete(id);
  const stationary = cutouts.filter((c) => stationaryIds.has(c.id));

  // Compute bounds of moving cutouts using preview positions
  const movingCutouts = [...nextPreview.entries()]
    .map(([id, updates]) => {
      const orig = cutouts.find((c) => c.id === id);
      return orig ? { ...orig, ...updates } : null;
    })
    .filter((c): c is Cutout => c !== null);

  const movingBounds = computeBounds(movingCutouts);
  const guides = findAlignmentGuides(movingBounds, stationary);
  setters.setActiveGuides(guides);
}
