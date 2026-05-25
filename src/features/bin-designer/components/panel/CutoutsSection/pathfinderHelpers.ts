/**
 * Pure helpers for the Pathfinder / Transform multi-select controls.
 *
 * Lives in its own module so the React component files can re-export them
 * for unit tests without breaking the React-refresh "only export
 * components" rule.
 */

import type { Cutout, GroupOp } from '@/features/bin-designer/types';
import { computeBounds, getEffectiveBounds, clampRotationToBounds } from './geometry';

/**
 * The active op is well-defined only when every selected cutout belongs to
 * the same single group AND that group has no extra (non-selected) members.
 * Otherwise return null so no Pathfinder button gets the "current op"
 * highlight.
 */
export function resolveActiveOp(
  selectedIds: readonly string[],
  cutouts: readonly Cutout[]
): { readonly groupId: string; readonly op: GroupOp } | null {
  if (selectedIds.length === 0) return null;
  const selected = cutouts.filter((c) => selectedIds.includes(c.id));
  if (selected.length === 0) return null;
  const firstGroup = selected[0].groupId;
  if (firstGroup === null) return null;
  for (const c of selected) {
    if (c.groupId !== firstGroup) return null;
  }
  for (const c of cutouts) {
    if (c.groupId === firstGroup && !selectedIds.includes(c.id)) return null;
  }
  return { groupId: firstGroup, op: selected[0].groupOp ?? 'union' };
}

/**
 * Rotate `(x, y)` around `(cx, cy)` by `deg` degrees CCW.
 */
function rotateAroundCenter(
  x: number,
  y: number,
  cx: number,
  cy: number,
  deg: number
): { readonly x: number; readonly y: number } {
  if (deg === 0) return { x, y };
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

/**
 * Compute updates that rotate every selected cutout `deg` around the
 * group's bounding-box center.
 *
 * Returns position (x/y) AND rotation updates per member. The rotation
 * applies on top of the existing per-cutout rotation. Locked cutouts are
 * skipped silently.
 */
export function buildGroupRotationUpdates(
  selected: readonly Cutout[],
  deg: number,
  binWidth: number,
  binDepth: number
): Map<string, Partial<Cutout>> {
  const updates = new Map<string, Partial<Cutout>>();
  if (selected.length === 0 || deg === 0) return updates;
  const bounds = computeBounds(selected);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  for (const cutout of selected) {
    if (cutout.locked) continue;
    const eb = getEffectiveBounds(cutout);
    const centerX = (eb.minX + eb.maxX) / 2;
    const centerY = (eb.minY + eb.maxY) / 2;
    const rotated = rotateAroundCenter(centerX, centerY, cx, cy, deg);
    const newRotation = (((cutout.rotation + deg) % 360) + 360) % 360;
    const newX = rotated.x - cutout.width / 2;
    const newY = rotated.y - cutout.depth / 2;
    // Clamp against the cutout at its post-rotation position — checking the
    // old position can OK an angle that still overflows once the cutout has
    // moved across the bin during the group rotation.
    const clampedRotation = clampRotationToBounds(
      { ...cutout, x: newX, y: newY },
      newRotation,
      binWidth,
      binDepth
    );
    updates.set(cutout.id, { x: newX, y: newY, rotation: clampedRotation });
  }
  return updates;
}
