/**
 * Pure helpers for cutout interaction: cloning with group-id remapping,
 * paste-position clamping, and default cutout construction.
 */

import type { Cutout, CutoutShape } from '@/features/bin-designer/types';

export interface ClonedCutout extends Cutout {
  readonly originalId: string;
}

/**
 * Clone cutouts and remap any shared groupId so the clones form their own
 * independent group (preserves "selected together" semantics for paste).
 * `offsetFn` lets callers reposition each clone relative to its source.
 */
export function cloneCutoutsWithGroups(
  originals: readonly Cutout[],
  offsetFn?: (original: Cutout) => { x: number; y: number }
): readonly ClonedCutout[] {
  const groupMap = new Map<string, string>();
  return originals.map((original) => {
    const newId = crypto.randomUUID();
    let newGroupId: string | null = null;
    if (original.groupId) {
      if (!groupMap.has(original.groupId)) {
        groupMap.set(original.groupId, crypto.randomUUID());
      }
      newGroupId = groupMap.get(original.groupId) ?? null;
    }
    const pos = offsetFn ? offsetFn(original) : { x: original.x, y: original.y };
    return {
      ...original,
      id: newId,
      x: pos.x,
      y: pos.y,
      groupId: newGroupId,
      originalId: original.id,
    };
  });
}

/** Clamp a position so the cutout stays within bin bounds (both lower and upper). */
export function clampedOffset(
  original: Cutout,
  offset: number,
  binWidth: number,
  binDepth: number
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(original.x + offset, binWidth - original.width)),
    y: Math.max(0, Math.min(original.y + offset, binDepth - original.depth)),
  };
}

/**
 * Clone cutouts, add each to the layout, and select the new set.
 * Returns the cloned cutouts (with originalId) for further use.
 */
export function addClonedCutouts(
  originals: readonly Cutout[],
  onAdd: (cutout: Cutout) => void,
  setSelection: (sel: ReadonlySet<string>) => void,
  offsetFn?: (original: Cutout) => { x: number; y: number }
): readonly ClonedCutout[] {
  const clones = cloneCutoutsWithGroups(originals, offsetFn);
  for (const { originalId: _, ...cutout } of clones) {
    onAdd(cutout);
  }
  setSelection(new Set(clones.map((c) => c.id)));
  return clones;
}

/** Default cutout properties shared by click-to-place and draw-to-place. */
export function createDefaultCutout(
  id: string,
  shape: CutoutShape,
  x: number,
  y: number,
  width: number,
  depth: number
): Cutout {
  return {
    id,
    shape,
    x,
    y,
    width,
    depth,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
  };
}
