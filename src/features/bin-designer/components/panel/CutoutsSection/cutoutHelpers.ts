/**
 * Pure helpers for cutout interaction: cloning with group-id remapping,
 * paste-position clamping, and default cutout construction.
 */

import type { Cutout, CutoutShape } from '@/features/bin-designer/types';
import {
  DEFAULT_POLYGON_SIDES,
  DEFAULT_CUTOUT_CLEARANCE,
  CLEARANCE_SHAPES,
  defaultEntryChamfer,
} from '@/features/bin-designer/types';
import { polygonBoxFromAcrossFlats } from '@/shared/utils/cutoutPolygon';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import { DEFAULT_KNIFE_PRESET } from './knifeSlotPresets';
import { KNIFE_SLOT_DEFAULT_CHAMFER, knifeSlotDimensions } from '@/features/bin-designer/types';
import { translatePathPoints } from './pathGeometry';
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

/** Move a cutout by (dx, dy), carrying a path's absolute vertices along. */
export function translateCutout(cutout: Cutout, dx: number, dy: number): Cutout {
  const moved = { ...cutout, x: cutout.x + dx, y: cutout.y + dy };
  if (cutout.shape !== 'path' || !cutout.path || (dx === 0 && dy === 0)) return moved;
  return { ...moved, path: translatePathPoints(cutout.path, dx, dy) };
}

/**
 * Apply a transform preview patch, moving a path cutout's vertices in lockstep
 * with its x/y. Mirrors what the drag commit writes to the store, so validators
 * run against the geometry the commit will actually produce rather than against
 * the position the cutout is leaving.
 */
export function translateCutoutPreview(cutout: Cutout, patch: Partial<Cutout>): Cutout {
  const dx = (patch.x ?? cutout.x) - cutout.x;
  const dy = (patch.y ?? cutout.y) - cutout.y;
  return { ...translateCutout(cutout, dx, dy), ...patch };
}

/** Clamp a position so the cutout stays within bin bounds (both lower and upper). */
export function clampedOffset(
  original: Cutout,
  offset: number,
  binWidth: number,
  binDepth: number
): { x: number; y: number } {
  return clampedDelta(original, offset, offset, binWidth, binDepth);
}

/** Per-axis form, for the step-and-repeat chain's arbitrary offset. */
export function clampedDelta(
  original: Cutout,
  dx: number,
  dy: number,
  binWidth: number,
  binDepth: number
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(original.x + dx, binWidth - original.width)),
    y: Math.max(0, Math.min(original.y + dy, binDepth - original.depth)),
  };
}

/**
 * Clone cutouts, add each to the layout, and select the new set.
 *
 * Returns only the clones that were actually stored (with originalId). A lid at
 * its cap refuses the tail of the batch, and selecting ids that were never added
 * leaves the editor holding a selection of shapes that do not exist — which the
 * step-and-repeat chain then measures its next offset against.
 */
export function addClonedCutouts(
  originals: readonly Cutout[],
  onAdd: (cutout: Cutout) => boolean,
  setSelection: (sel: ReadonlySet<string>) => void,
  offsetFn?: (original: Cutout) => { x: number; y: number },
  onClipped?: (landed: number, requested: number) => void
): readonly ClonedCutout[] {
  const landed = cloneCutoutsWithGroups(originals, offsetFn).filter((clone) => {
    const { originalId: _, ...cutout } = clone;
    return onAdd(cutout);
  });
  setSelection(new Set(landed.map((c) => c.id)));
  // A cap refusal that only clears the selection reads as the command doing
  // nothing — the same silent truncation the SVG import already reports.
  if (landed.length < originals.length) onClipped?.(landed.length, originals.length);
  return landed;
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
    case 'knifeSlot': {
      const dims = knifeSlotDimensions(DEFAULT_KNIFE_PRESET.knife);
      return { width: dims.widthMm, depth: dims.depthMm };
    }
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
 * store callbacks. Shared by the full-screen workspace and the sidebar editor so
 * both flatten identically.
 *
 * Returns `'flattened'`, `'not-an-array'` when the id has no repeat, or
 * `'no-room'` when `capacity` cannot take every instance.
 *
 * The capacity check has to happen HERE, before the first write. `masterPatch`
 * strips the master's repeat config, so a run that fills the lid part way
 * through leaves the design with neither the array nor the instances it stood
 * for: at the cap it would lose the repeat and gain nothing. Declining whole is
 * the only outcome the user can undo by not having done it.
 */
export function applyFlattenArray(
  id: string,
  cutouts: readonly Cutout[],
  updateCutout: (id: string, patch: Partial<Cutout>) => void,
  addCutout: (cutout: Cutout) => boolean,
  capacity: number,
  transaction: { readonly start: () => void; readonly commit: () => void }
): 'flattened' | 'not-an-array' | 'no-room' {
  const master = cutouts.find((c) => c.id === id);
  if (!master?.array) return 'not-an-array';
  const { masterPatch, added } = flattenCutoutArray(master);
  if (added.length > capacity) return 'no-room';
  // One undo step for the whole flatten: outside a transaction each addCutout
  // pushes its own history entry, so reversing a 4x4 repeat took 17 presses
  // where the SVG import of the same shapes takes one.
  transaction.start();
  try {
    updateCutout(id, masterPatch);
    for (const cutout of added) addCutout(cutout);
  } finally {
    transaction.commit();
  }
  return 'flattened';
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
  const cutDepth = 5;
  return {
    id,
    shape,
    x,
    y,
    width,
    depth,
    cutDepth,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    // Hexagon by default — the bit-organizer staple. Ignored for other shapes.
    ...(shape === 'polygon' ? { sides: DEFAULT_POLYGON_SIDES } : {}),
    // Insert shapes get a small fit allowance plus a self-centering entry
    // chamfer so spec-sized parts drop in cleanly and the top rim looks finished.
    ...(CLEARANCE_SHAPES.includes(shape)
      ? {
          clearance: DEFAULT_CUTOUT_CLEARANCE,
          chamferWidth: defaultEntryChamfer(Math.min(width, depth), cutDepth),
        }
      : {}),
    // Knife slots carry their knife's measurements (clearance is baked into
    // the slot dims, so no `clearance` field) and a wide drop-in flare.
    ...(shape === 'knifeSlot'
      ? {
          cutDepth: knifeSlotDimensions(DEFAULT_KNIFE_PRESET.knife).cutDepthMm,
          knife: DEFAULT_KNIFE_PRESET.knife,
          chamferWidth: KNIFE_SLOT_DEFAULT_CHAMFER,
        }
      : {}),
  };
}
