/**
 * Pure helpers for cutout interaction: cloning with group-id remapping,
 * paste-position clamping, and default cutout construction.
 */

import type { Cutout, CutoutShape } from '@/features/bin-designer/types';
import {
  DEFAULT_POLYGON_SIDES,
  DEFAULT_CUTOUT_CLEARANCE,
  CLEARANCE_SHAPES,
} from '@/features/bin-designer/types';
import { polygonBoxFromAcrossFlats } from '@/shared/utils/cutoutPolygon';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import {
  DEFAULT_RECT_SIZE,
  DEFAULT_CIRCLE_SIZE,
  DEFAULT_POLYGON_ACROSS_FLATS,
  DEFAULT_SLOT_WIDTH,
  DEFAULT_SLOT_DEPTH,
} from './cutoutInteractionTypes';

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

/** Width × depth of a click-to-placed cutout, per shape (mm). */
export function defaultPlaceSize(shape: CutoutShape): { width: number; depth: number } {
  switch (shape) {
    case 'circle':
      return { width: DEFAULT_CIRCLE_SIZE, depth: DEFAULT_CIRCLE_SIZE };
    case 'polygon':
      return polygonBoxFromAcrossFlats(DEFAULT_POLYGON_SIDES, DEFAULT_POLYGON_ACROSS_FLATS);
    case 'slot':
      return { width: DEFAULT_SLOT_WIDTH, depth: DEFAULT_SLOT_DEPTH };
    default:
      return { width: DEFAULT_RECT_SIZE, depth: DEFAULT_RECT_SIZE };
  }
}

/**
 * Resize a cutout to `newWidth × newDepth` while keeping its center fixed, then
 * clamp the origin into `[0, max]`. Used when polygon side-count / across-flats
 * edits change the bounding box and we don't want the shape to jump.
 */
export function resizeKeepingCenter(
  cutout: Pick<Cutout, 'x' | 'y' | 'width' | 'depth'>,
  newWidth: number,
  newDepth: number,
  maxWidth: number,
  maxDepth: number
): { x: number; y: number; width: number; depth: number } {
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  const width = Math.min(newWidth, maxWidth);
  const depth = Math.min(newDepth, maxDepth);
  const x = Math.max(0, Math.min(cx - width / 2, maxWidth - width));
  const y = Math.max(0, Math.min(cy - depth / 2, maxDepth - depth));
  return { x, y, width, depth };
}

/**
 * Bake an array master into independent cutouts. The master keeps its id (array
 * stripped, still at instance-0 position); the other instances become new
 * cutouts with fresh ids. Returns the patch for the master plus the cutouts to
 * add. No-op shape when there's no array.
 */
export function flattenCutoutArray(master: Cutout): {
  masterPatch: Partial<Cutout>;
  added: Cutout[];
} {
  if (!master.array) return { masterPatch: {}, added: [] };
  const instances = expandCutoutArray(master);
  const added = instances.slice(1).map((inst) => ({ ...inst, id: crypto.randomUUID() }));
  return { masterPatch: { array: undefined }, added };
}

/**
 * Look up an array master by id and bake it into independent cutouts via the
 * store callbacks. No-op when the id isn't an array master. Shared by the
 * full-screen workspace and the sidebar editor so both flatten identically.
 */
export function applyFlattenArray(
  id: string,
  cutouts: readonly Cutout[],
  updateCutout: (id: string, patch: Partial<Cutout>) => void,
  addCutout: (cutout: Cutout) => void
): void {
  const master = cutouts.find((c) => c.id === id);
  if (!master?.array) return;
  const { masterPatch, added } = flattenCutoutArray(master);
  updateCutout(id, masterPatch);
  for (const cutout of added) addCutout(cutout);
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
    // Hexagon by default — the bit-organizer staple. Ignored for other shapes.
    ...(shape === 'polygon' ? { sides: DEFAULT_POLYGON_SIDES } : {}),
    // Insert shapes get a small fit allowance so spec-sized parts drop in.
    ...(CLEARANCE_SHAPES.includes(shape) ? { clearance: DEFAULT_CUTOUT_CLEARANCE } : {}),
  };
}
